/**
 * Web IRC Client v5.2 - Enhanced with Private Messaging & Notifications
 * Modern IRC web client with real-time chat, private messaging, and notifications
 * FIXED: Added IRC WebSocket subprotocol support for UnrealIRCd
 */

(function(){
  'use strict';

  console.log('🚀 Web IRC Client v5.2 Loading...', new Date().toISOString());

  // Configuration from WordPress
  var cfg = (typeof window !== 'undefined' && window.WEB_IRC_CLIENT_CFG) ? window.WEB_IRC_CLIENT_CFG : {};
  
  // Default configuration
  var config = {
    wsURL: cfg.ws_url || '',
    channel: cfg.channel || '',
    nickPrefix: cfg.nickname_prefix || 'supportguest',
    realName: cfg.realname || 'Web IRC User',
    theme: cfg.theme || 'light',
    autoConnect: cfg.autoconnect !== 'no',
    reconnectDelay: 5000,
    maxReconnectAttempts: 10,
    messageLimit: 500,
    notificationTimeout: 5000
  };

  // Validate required configuration
  if (!config.channel) {
    console.error('❌ No default channel configured');
    if (elStatus) elStatus.textContent = 'Error: No channel configured';
    return;
  }

  console.log('📋 Configuration:', config);

  // Validate WebSocket URL
  if (!config.wsURL) {
    console.error('❌ No WebSocket URL configured');
    return;
  }

  // Global state
  var ws = null;
  var connected = false;
  var currentNick = '';
  var users = new Set();
  var channels = new Map();
  var privateMessages = new Map();
  var currentWindow = config.channel;
  var reconnectAttempts = 0;
  var messageHistory = [];
  var unreadCounts = new Map();
  var notificationsEnabled = false;
  var lastActivity = Date.now();
  var isWindowFocused = true;

  // DOM elements
  var elContainer, elStatus, elChannel, elWsUrl, elVersion, elUsers, elMessages, elInput, elInputForm;
  var elTabBar, elMain;

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    console.log('🎯 Initializing IRC Client...');
    
    // Get DOM elements
    elContainer = document.getElementById('web-irc-container');
    elStatus = document.getElementById('irc-status');
    elChannel = document.getElementById('irc-channel');
    elWsUrl = document.getElementById('irc-ws-url');
    elVersion = document.getElementById('irc-client-version');
    elUsers = document.getElementById('irc-users');
    elMessages = document.getElementById('irc-messages');
    elInput = document.getElementById('irc-input');
    elInputForm = document.getElementById('irc-input-form');

    if (!elContainer) {
      console.error('❌ IRC container not found');
      return;
    }

    // Set initial values
    if (elWsUrl) elWsUrl.textContent = config.wsURL;
    if (elChannel) elChannel.textContent = config.channel;
    if (elVersion) elVersion.textContent = 'v5.2';

    // Create tab system
    createTabSystem();
    
    // Setup event listeners
    setupEventListeners();
    
    // Request notification permission
    requestNotificationPermission();
    
    // Generate nickname
    currentNick = generateNickname();
    console.log('👤 Generated nickname:', currentNick);

    // Auto-connect if enabled
    if (config.autoConnect) {
      setTimeout(connect, 1000);
    } else {
      setStatus('Ready (click to connect)');
    }

    console.log('✅ IRC Client initialized successfully');
  }

  function createTabSystem() {
    if (!elContainer) return;

  // Don't move anything - just add the tab bar above the messages
    elTabBar = document.createElement('div');
    elTabBar.className = 'irc-tab-bar';
  
  // Insert tab bar before the messages div
    if (elMessages && elMessages.parentNode) {
      elMessages.parentNode.insertBefore(elTabBar, elMessages);
    }
  
  // Set elMain to the existing irc-main div
    elMain = elContainer.querySelector('.irc-main');
  
  // Create window for main channel
    createWindow(config.channel, 'channel');
  }


  function createWindow(name, type) {
    // Create tab
    var tab = document.createElement('div');
    tab.className = 'irc-tab';
    tab.dataset.window = name;
    tab.dataset.type = type;

    var tabName = document.createElement('span');
    tabName.className = 'tab-name';
    tabName.textContent = name;
    tab.appendChild(tabName);

    if (type === 'pm' || (type === 'channel' && name !== config.channel)) {
      var closeBtn = document.createElement('span');
      closeBtn.className = 'close-btn';
      closeBtn.innerHTML = ' ×';
      closeBtn.onclick = function(e) {
        e.stopPropagation();
        closeWindow(name, type);
      };
      tab.appendChild(closeBtn);
    }

    tab.onclick = function() {
      switchToWindow(name);
    };

    elTabBar.appendChild(tab);

    // Create message container for this window
    if (name !== config.channel) {
      var messageContainer = document.createElement('div');
      messageContainer.className = 'irc-messages irc-window';
      messageContainer.id = 'messages-' + sanitizeId(name);
      messageContainer.style.display = 'none';
      elMain.appendChild(messageContainer);
    }

    // Set as active if it's the first tab
    if (elTabBar.children.length === 1) {
      switchToWindow(name);
    }

    return tab;
  }




  function switchToWindow(name) {
    currentWindow = name;

    // Update tab states
    Array.from(elTabBar.children).forEach(function(tab) {
      tab.classList.remove('active');
      if (tab.dataset.window === name) {
        tab.classList.add('active');
        tab.classList.remove('has-unread');
        var badge = tab.querySelector('.unread-badge');
        if (badge) badge.remove();
      }
    });

    // Hide all message containers
    var allMessages = elMain.querySelectorAll('.irc-messages');
    allMessages.forEach(function(container) {
      container.style.display = 'none';
    });

    // Hide all input containers
    var allInputs = elMain.querySelectorAll('.irc-input');
    allInputs.forEach(function(input) {
      input.style.display = 'none';
    });

    if (name.startsWith('#')) {
      // Show channel (could be main or other channels)
      if (name === config.channel) {
        // Main channel
        if (elMessages) elMessages.style.display = 'block';
        var mainInput = elContainer.querySelector('.irc-input');
        if (mainInput) mainInput.style.display = 'block';
      } else {
        // Other channel
        var channelContainer = document.getElementById('messages-' + sanitizeId(name));
        if (channelContainer) channelContainer.style.display = 'block';
        
        // Show or create channel input
        var channelInput = document.getElementById('input-' + sanitizeId(name));
        if (!channelInput) {
          channelInput = document.createElement('div');
          channelInput.className = 'irc-input';
          channelInput.id = 'input-' + sanitizeId(name);
          channelInput.innerHTML = '<form class="irc-input-form" style="display: flex; width: 100%; gap: 6px;"><input type="text" class="window-input" placeholder="Type your message..." autocomplete="off" maxlength="400" /><button type="submit">Send</button></form>';
          elMain.appendChild(channelInput);

          // Add event listener
          var form = channelInput.querySelector('.irc-input-form');
          form.addEventListener('submit', function(e) {
            e.preventDefault();
            var input = this.querySelector('.window-input');
            if (input && input.value.trim()) {
              var message = input.value.trim();
              
              // Handle commands
              if (message.startsWith('/')) {
                handleCommand(message);
              } else {
                // Send regular message
                if (ws && ws.readyState === WebSocket.OPEN) {
                  var ircCommand = 'PRIVMSG ' + name + ' :' + message;
                  ws.send(ircCommand);
                  displayMessage(name, currentNick, message, 'own');
                }
              }
              input.value = '';
            }
          });
        }
        channelInput.style.display = 'block';
      }
    } else {
      // Show PM window
      var pmContainer = document.getElementById('messages-' + sanitizeId(name));
      if (pmContainer) pmContainer.style.display = 'block';

      // Show or create PM input
      var pmInput = document.getElementById('input-' + sanitizeId(name));
      if (!pmInput) {
        pmInput = document.createElement('div');
        pmInput.className = 'irc-input';
        pmInput.id = 'input-' + sanitizeId(name);
        pmInput.innerHTML = '<form class="irc-input-form" style="display: flex; width: 100%; gap: 6px;"><input type="text" class="window-input" placeholder="Type your message..." autocomplete="off" maxlength="400" /><button type="submit">Send</button></form>';
        elMain.appendChild(pmInput);

        // Add event listener to prevent page refresh
        var form = pmInput.querySelector('.irc-input-form');
        form.addEventListener('submit', function(e) {
          e.preventDefault();
          var input = this.querySelector('.window-input');

          if (input && input.value.trim()) {
            var message = input.value.trim();

            // Send private message
            if (ws && ws.readyState === WebSocket.OPEN) {
              var ircCommand = 'PRIVMSG ' + name + ' :' + message;
              console.log('Sending IRC command:', ircCommand);
              ws.send(ircCommand);

              // Display the message in the PM window
              var pmContainer = document.getElementById('messages-' + sanitizeId(name));

              if (pmContainer) {
                var messageDiv = document.createElement('div');
                messageDiv.className = 'irc-message own';
                var safeMessage = message.replace(/</g, '<').replace(/>/g, '>');
                var currentNick = config.nickname || 'You';
                messageDiv.innerHTML = '<span class="meta">[' + new Date().toLocaleTimeString() + ']</span> <span class="nick">' + currentNick + '</span>: ' + safeMessage;
                pmContainer.appendChild(messageDiv);
                pmContainer.scrollTop = pmContainer.scrollHeight;
              }
            } else {
              console.log('WebSocket state:', ws ? ws.readyState : 'ws is null');
            }

            input.value = '';
          }
        });
      }
      pmInput.style.display = 'block';
    }

    // Clear unread count
    unreadCounts.delete(name);

    // Focus input
    var activeInput = document.querySelector('.irc-input[style*="block"] input');
    if (activeInput) activeInput.focus();
  }


  function closeWindow(name, type) {
    if (name === config.channel) return; // Can't close main channel

    // If it's a channel, send PART command first
    if (type === 'channel' && name.startsWith('#')) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        sendRaw('PART ' + name);
      }
    }

    // Remove tab
    var tab = elTabBar.querySelector('[data-window="' + name + '"]');
    if (tab) tab.remove();

    // Remove message container
    var container = document.getElementById('messages-' + sanitizeId(name));
    if (container) container.remove();

    // Remove input container
    var inputContainer = document.getElementById('input-' + sanitizeId(name));
    if (inputContainer) inputContainer.remove();

    // Remove from maps
    privateMessages.delete(name);
    unreadCounts.delete(name);

    // Switch to main channel if this was active
    if (currentWindow === name) {
      switchToWindow(config.channel);
    }
  }




  function setupEventListeners() {
    // Input form submission
    if (elInputForm) {
      elInputForm.addEventListener('submit', function(e) {
        e.preventDefault();
        sendMessage();
      });
    }

    // Input keydown for history
    if (elInput) {
      var historyIndex = -1;
      elInput.addEventListener('keydown', function(e) {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (historyIndex < messageHistory.length - 1) {
            historyIndex++;
            elInput.value = messageHistory[messageHistory.length - 1 - historyIndex] || '';
          }
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (historyIndex > 0) {
            historyIndex--;
            elInput.value = messageHistory[messageHistory.length - 1 - historyIndex] || '';
          } else if (historyIndex === 0) {
            historyIndex = -1;
            elInput.value = '';
          }
        } else if (e.key === 'Tab') {
          e.preventDefault();
          // Tab completion for nicknames
          var value = elInput.value;
          var words = value.split(' ');
          var lastWord = words[words.length - 1];
          if (lastWord) {
            var matches = Array.from(users).filter(function(u) {
              return u.toLowerCase().startsWith(lastWord.toLowerCase());
            });
            if (matches.length === 1) {
              words[words.length - 1] = matches[0];
              elInput.value = words.join(' ');
            }
          }
        }
      });
    }

    // Window focus/blur for notifications
    window.addEventListener('focus', function() {
      isWindowFocused = true;
      lastActivity = Date.now();
    });

    window.addEventListener('blur', function() {
      isWindowFocused = false;
    });

    // Click outside to close menus
    document.addEventListener('click', function(e) {
      var menu = document.querySelector('.user-context-menu');
      if (menu && !menu.contains(e.target)) {
        menu.remove();
      }
    });
  }

  function generateNickname() {
    var suffix = Math.floor(Math.random() * 9000) + 1000;
    return config.nickPrefix + suffix;
  }

  function sanitizeId(str) {
    return str.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  function sanitizeHTML(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function isValidNick(nick) {
    return /^[a-zA-Z0-9_\-\[\]\\`^{}|]+$/.test(nick) && nick.length <= 30;
  }

  function setStatus(status) {
    console.log('📊 Status:', status);
    if (elStatus) {
      elStatus.textContent = status;
      
      // Add status indicator
      var indicator = elStatus.parentNode.querySelector('.irc-status-indicator');
      if (!indicator) {
        indicator = document.createElement('span');
        indicator.className = 'irc-status-indicator';
        elStatus.parentNode.insertBefore(indicator, elStatus);
      }
      
      if (status.includes('Connected')) {
        indicator.style.backgroundColor = '#22c55e';
      } else if (status.includes('Connecting')) {
        indicator.style.backgroundColor = '#f59e0b';
      } else {
        indicator.style.backgroundColor = '#ef4444';
      }
    }
  }

  function connect() {
    if (connected) return;
    
    console.log('🔌 Connecting to:', config.wsURL);
    setStatus('Connecting...');
    
    try {
      // CRITICAL FIX: Add IRC WebSocket subprotocol for UnrealIRCd compatibility
      // UnrealIRCd expects either 'irc' or 'binary.ircv3.net' subprotocol
      ws = new WebSocket(config.wsURL, ['irc', 'binary.ircv3.net']);
    } catch (e) {
      console.error('❌ WebSocket creation failed:', e);
      setStatus('Connection failed: ' + e.message);
      scheduleReconnect();
      return;
    }

    ws.addEventListener('open', function() {
      console.log('✅ WebSocket connected');
      connected = true;
      reconnectAttempts = 0;
      setStatus('Connected - Logging in...');
      
      // Send IRC registration
      sendRaw('NICK ' + currentNick);
      sendRaw('USER ' + currentNick + ' 0 * :' + config.realName);
    });

    ws.addEventListener('message', function(event) {
      handleMessage(event.data);
    });

    ws.addEventListener('close', function(event) {
      console.log('❌ WebSocket closed:', event.code, event.reason);
      connected = false;
      setStatus('Disconnected');
      
      if (event.code !== 1000) { // Not a normal closure
        scheduleReconnect();
      }
    });

    ws.addEventListener('error', function(event) {
      console.error('❌ WebSocket error:', event);
      setStatus('Connection error');
    });
  }

  function scheduleReconnect() {
    if (reconnectAttempts >= config.maxReconnectAttempts) {
      setStatus('Max reconnection attempts reached');
      return;
    }
    
    reconnectAttempts++;
    var delay = config.reconnectDelay * Math.pow(1.5, reconnectAttempts - 1);
    
    console.log('🔄 Scheduling reconnect attempt', reconnectAttempts, 'in', delay, 'ms');
    setStatus('Reconnecting in ' + Math.ceil(delay / 1000) + 's... (attempt ' + reconnectAttempts + ')');
    
    setTimeout(connect, delay);
  }

  function sendRaw(message) {
    if (!connected || !ws) {
      console.warn('⚠ Cannot send message: not connected');
      return false;
    }
    
    console.log('📤 Sending:', message);
    ws.send(message + '\r\n');
    return true;
  }

  function sendMessage() {
    if (!elInput) return;
    
    var message = elInput.value.trim();
    if (!message) return;
    
    // Add to history
    messageHistory.push(message);
    if (messageHistory.length > 50) {
      messageHistory.shift();
    }
    
    elInput.value = '';
    
    // Handle commands
    if (message.startsWith('/')) {
      handleCommand(message);
      return;
    }
    
    // Send regular message
    if (currentWindow.startsWith('#')) {
      // Channel message
      if (sendRaw('PRIVMSG ' + currentWindow + ' :' + message)) {
        displayMessage(currentWindow, currentNick, message, 'own');
      }
    } else {
      // Private message
      if (sendRaw('PRIVMSG ' + currentWindow + ' :' + message)) {
        displayMessage(currentWindow, currentNick, message, 'own', 'pm');
      }
    }
  }


  function handleCommand(command) {
    var parts = command.slice(1).split(' ');
    var cmd = parts[0].toLowerCase();
    var args = parts.slice(1);

    console.log('🎮 Command:', cmd, args);

    switch (cmd) {
      case 'nick':
        if (args[0] && isValidNick(args[0])) {
          sendRaw('NICK ' + args[0]);
        } else {
          displayMessage(currentWindow, '*', 'Invalid nickname', 'system');
        }
        break;

      case 'join':
        if (args[0]) {
          var channel = args[0].startsWith('#') ? args[0] : '#' + args[0];
          sendRaw('JOIN ' + channel);
        }
        break;

      case 'part':
        if (args.length > 0) {
          // Part from specified channel
          var channel = args[0].startsWith('#') ? args[0] : '#' + args[0];
          sendRaw('PART ' + channel);
        } else if (currentWindow.startsWith('#')) {
          // Part from current channel
          sendRaw('PART ' + currentWindow);
        } else {
          displayMessage(currentWindow, '*', 'You must specify a channel to part from', 'system');
        }
        break;

      case 'msg':
      case 'privmsg':
        if (args.length >= 2) {
          var target = args[0];
          var message = args.slice(1).join(' ');
          sendRaw('PRIVMSG ' + target + ' :' + message);
          displayMessage(target, currentNick, message, 'own', 'pm');
          if (!privateMessages.has(target)) {
            startPrivateMessage(target);
          }
        }
        break;

      case 'me':
        var action = args.join(' ');
        if (action) {
          sendRaw('PRIVMSG ' + currentWindow + ' :\x01ACTION ' + action + '\x01');
          displayMessage(currentWindow, currentNick, action, 'action');
        }
        break;

      case 'help':
        displayMessage(currentWindow, '*', 'Available commands: /nick, /join, /part, /msg, /me, /help', 'system');
        break;

      default:
        displayMessage(currentWindow, '*', 'Unknown command: ' + cmd, 'system');
    }
  }



  function handleMessage(data) {
    // Handle Blob data (binary WebSocket)
    if (data instanceof Blob) {
        var reader = new FileReader();
        reader.onload = function() {
            handleMessage(reader.result); // Recursively call with text
        };
        reader.readAsText(data);
        return;
    }
    
    console.log('📨 Raw data:', data);

    var lines = data.trim().split(/\r?\n/);
    lines.forEach(function(line) {
      if (!line.trim()) return;

      console.log('📨 Processing line:', line);

      // Handle PING
      if (line.startsWith('PING ')) {
        var pongData = line.substring(5);
        sendRaw('PONG ' + pongData);
        console.log('🏓 Sent PONG:', pongData);
        return;
      }

      // Parse IRC message - simple parsing that works
      var parts = line.split(' ');

      // Welcome message (001)
      if (parts[1] === '001') {
        console.log('✅ Received welcome message');
        setStatus('Connected - Joining channel...');
        sendRaw('JOIN ' + config.channel);
        return;
      }

      // Names list (353)
      if (parts[1] === '353') {
        var namesStart = line.indexOf(' :');
        if (namesStart !== -1) {
          var names = line.substring(namesStart + 2).split(' ');
          names.forEach(function(name) {
            var cleanName = name.replace(/^[@+%&~]/, '');
            if (cleanName) users.add(cleanName);
          });
        }
        return;
      }

      // End of names (366)
      if (parts[1] === '366') {
        console.log('✅ Joined channel successfully');
        setStatus('Connected to ' + config.channel);
        refreshUsers();
        return;
      }

      // JOIN
      if (parts[1] === 'JOIN') {
        var nick = parts[0].substring(1).split('!')[0];
        var channel = parts[2].replace(':', '');
        
        if (nick === currentNick) {
          // We joined a channel - create tab if it doesn't exist
          if (!elTabBar.querySelector('[data-window="' + channel + '"]')) {
            createWindow(channel, 'channel');
          }
          switchToWindow(channel);
          displayMessage(channel, '*', 'You joined ' + channel, 'system');
        } else {
          users.add(nick);
          displayMessage(channel, '*', nick + ' joined', 'system');
          refreshUsers();
        }
        return;
      }

      // PART
      if (parts[1] === 'PART') {
        var nick = parts[0].substring(1).split('!')[0];
        users.delete(nick);
        displayMessage(currentWindow, '*', nick + ' left', 'system');
        refreshUsers();
        return;
      }

      // QUIT
      if (parts[1] === 'QUIT') {
        var nick = parts[0].substring(1).split('!')[0];
        users.delete(nick);
        displayMessage(currentWindow, '*', nick + ' quit', 'system');
        refreshUsers();
        return;
      }

      // NICK change
      if (parts[1] === 'NICK') {
        var oldNick = parts[0].substring(1).split('!')[0];
        var newNick = parts[2].replace(':', '');
        if (oldNick === currentNick) {
          currentNick = newNick;
          displayMessage(currentWindow, '*', 'You are now known as ' + newNick, 'system');
        } else {
          users.delete(oldNick);
          users.add(newNick);
          displayMessage(currentWindow, '*', oldNick + ' is now known as ' + newNick, 'system');
          refreshUsers();
        }
        return;
      }

      // PRIVMSG
      if (parts[1] === 'PRIVMSG') {
        var nick = parts[0].substring(1).split('!')[0];
        var target = parts[2];
        var messageStart = line.indexOf(' :');
        if (messageStart !== -1) {
          var message = line.substring(messageStart + 2);

          // Check for ACTION
          if (message.startsWith('\x01ACTION ') && message.endsWith('\x01')) {
            message = message.slice(8, -1);
            if (target.startsWith('#')) {
              displayMessage(target, nick, message, 'action');
            } else {
              displayMessage(nick, nick, message, 'action', 'pm');
              if (!privateMessages.has(nick)) {
                startPrivateMessage(nick);
              }
            }
          } else {
            if (target.startsWith('#')) {
              // Channel message
              var type = message.toLowerCase().includes(currentNick.toLowerCase()) ? 'mention' : 'normal';
              displayMessage(target, nick, message, type);

              if (type === 'mention' && !isWindowFocused) {
                showNotification(nick + ' mentioned you in ' + target, message);
              }
            } else {
              // Private message
              displayMessage(nick, nick, message, 'normal', 'pm');
              if (!privateMessages.has(nick)) {
                startPrivateMessage(nick);
              }
              if (!isWindowFocused) {
                showNotification('Private message from ' + nick, message);
              }
            }
          }
        }
        return;
      }
    });
  }


  function displayMessage(window, nick, message, type, messageType) {
    var container;
    
    if (window === config.channel) {
      container = elMessages;
    } else {
      container = document.getElementById('messages-' + sanitizeId(window));
      if (!container && messageType === 'pm') {
        // Create PM window if it doesn't exist
        startPrivateMessage(window);
        container = document.getElementById('messages-' + sanitizeId(window));
      }
    }
    
    if (!container) return;
    
    var msgEl = document.createElement('div');
    msgEl.className = 'irc-message';
    
    if (type) msgEl.classList.add(type);
    
    var timestamp = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    var metaEl = document.createElement('span');
    metaEl.className = 'meta';
    metaEl.style.color = '#666';
    metaEl.textContent = '[' + timestamp + '] ';
    
    var nickEl = document.createElement('span');
    nickEl.className = 'nick';
    nickEl.style.cssText = 'font-weight: bold; cursor: pointer; color: #2563eb;';
    nickEl.textContent = nick;
    
    // Add click handler for nicknames (except system messages)
    if (nick !== '*' && nick !== currentNick) {
      nickEl.addEventListener('click', function(e) {
        showUserMenu(e, nick);
      });
      
      nickEl.addEventListener('mouseenter', function() {
        this.style.textDecoration = 'underline';
      });
      
      nickEl.addEventListener('mouseleave', function() {
        this.style.textDecoration = 'none';
      });
    }
    
    var messageEl = document.createElement('span');
    messageEl.textContent = ': ' + message;
    
    if (type === 'action') {
      msgEl.innerHTML = '<span class="meta" style="color: #666;">[' + timestamp + ']</span> <span class="nick" style="font-weight: bold; color: #2563eb;">* ' + sanitizeHTML(nick) + '</span> ' + sanitizeHTML(message);
    } else if (type === 'system') {
      msgEl.innerHTML = '<span class="meta" style="color: #666;">[' + timestamp + ']</span> ' + sanitizeHTML(message);
    } else {
      msgEl.appendChild(metaEl);
      msgEl.appendChild(nickEl);
      msgEl.appendChild(messageEl);
    }
    
    container.appendChild(msgEl);
    
    // Limit messages
    while (container.children.length > config.messageLimit) {
      container.removeChild(container.firstChild);
    }
    
    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
    
    // Update unread count if not current window
    if (window !== currentWindow) {
      var count = unreadCounts.get(window) || 0;
      unreadCounts.set(window, count + 1);
      updateUnreadBadge(window);
    }
  }

  function updateUnreadBadge(window) {
    var tab = elTabBar.querySelector('[data-window="' + window + '"]');
    if (!tab) return;
    
    var count = unreadCounts.get(window) || 0;
    if (count === 0) return;
    
    tab.classList.add('has-unread');
    
    var badge = tab.querySelector('.unread-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'unread-badge';
      badge.style.cssText = 'background: #ef4444; color: white; border-radius: 10px; padding: 2px 6px; font-size: 11px; margin-left: 8px;';
      tab.appendChild(badge);
    }
    
    badge.textContent = count > 99 ? '99+' : count.toString();
  }

  function refreshUsers() {
    if (!elUsers) return;
    elUsers.innerHTML = '';
    Array.from(users).sort(function(a,b){ return a.localeCompare(b); }).forEach(function(u){
      var li = document.createElement('li');
      li.textContent = u;
      li.style.cursor = 'pointer';
      
      // Add click event listener properly
      li.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('🖱 Clicked user:', u);
        showUserMenu(e, u);
      });
      
      // Add hover effect
      li.addEventListener('mouseenter', function() {
        li.style.backgroundColor = '#e0e0e0';
      });
      
      li.addEventListener('mouseleave', function() {
        li.style.backgroundColor = '';
      });
      
      elUsers.appendChild(li);
    });
  }

  function showUserMenu(event, username) {
    console.log('📋 Showing menu for:', username);
    event.preventDefault();
    event.stopPropagation();
    
    if (!isValidNick(username)) return;
    
    // Remove any existing menu
    var existingMenu = document.querySelector('.user-context-menu');
    if (existingMenu) existingMenu.remove();

    var menu = document.createElement('div');
    menu.className = 'user-context-menu';
    menu.style.cssText = 'position: fixed; background: white; border: 1px solid #ccc; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 9999; min-width: 120px; font-family: Arial, sans-serif;';
    
    // Position menu near click
    var rect = event.target.getBoundingClientRect();
    menu.style.left = Math.min(rect.right + 5, window.innerWidth - 150) + 'px';
    menu.style.top = Math.min(rect.top, window.innerHeight - 50) + 'px';
    
    var ul = document.createElement('ul');
    ul.style.cssText = 'list-style: none; margin: 0; padding: 4px 0;';
    
    var li = document.createElement('li');
    li.textContent = 'Private Message';
    li.style.cssText = 'padding: 8px 12px; cursor: pointer; transition: background-color 0.2s;';
    
    li.addEventListener('mouseenter', function() { 
      this.style.backgroundColor = '#2563eb'; 
      this.style.color = 'white'; 
    });
    
    li.addEventListener('mouseleave', function() { 
      this.style.backgroundColor = 'white'; 
      this.style.color = 'black'; 
    });
    
    li.addEventListener('click', function(e) {
      e.stopPropagation();
      console.log('💬 Starting PM with:', username);
      startPrivateMessage(username);
      menu.remove();
    });
    
    ul.appendChild(li);
    menu.appendChild(ul);
    document.body.appendChild(menu);
    
    console.log('✅ Menu created and added to DOM');
    
    // Close menu when clicking elsewhere
    setTimeout(function() {
      function closeMenu(e) {
        if (!menu.contains(e.target)) {
          console.log('🗑 Closing menu (clicked outside)');
          menu.remove();
          document.removeEventListener('click', closeMenu);
        }
      }
      document.addEventListener('click', closeMenu);
    }, 100);
  }

  function startPrivateMessage(username) {
    if (!isValidNick(username)) return;
    
    console.log('💬 Starting PM with:', username);
    
    // Check if PM window already exists
    var existingTab = elTabBar.querySelector('[data-window="' + username + '"]');
    if (existingTab) {
      switchToWindow(username);
      return;
    }
    
    // Add to private messages map
    privateMessages.set(username, true);
    
    // Create new PM window
    createWindow(username, 'pm');
    
    // Switch to the new window
    switchToWindow(username);
    
    // Display welcome message
    displayMessage(username, '*', 'Private conversation with ' + username, 'system', 'pm');
  }

  function requestNotificationPermission() {
    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(function(permission) {
          notificationsEnabled = (permission === 'granted');
          console.log('🔔 Notification permission:', permission);
        });
      } else {
        notificationsEnabled = (Notification.permission === 'granted');
      }
    }
  }

  function showNotification(title, body) {
    if (!notificationsEnabled || isWindowFocused) return;
    
    try {
      var notification = new Notification(title, {
        body: body,
        icon: '/favicon.ico',
        tag: 'irc-message'
      });
      
      setTimeout(function() {
        notification.close();
      }, config.notificationTimeout);
      
      notification.onclick = function() {
        window.focus();
        notification.close();
      };
    } catch (e) {
      console.warn('⚠ Notification failed:', e);
    }
  }

  // Expose public API for debugging
  window.WebIRCClient = {
    connect: connect,
    disconnect: function() {
      if (ws) ws.close();
    },
    sendMessage: sendMessage,
    getUsers: function() { return Array.from(users); },
    getCurrentNick: function() { return currentNick; },
    isConnected: function() { return connected; }
  };

  console.log('✅ Web IRC Client v5.2 loaded successfully');

})();
