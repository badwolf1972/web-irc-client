=== Badwolf Web IRC Client ===
Contributors: badwolf72
Tags: irc, chat, websocket, real-time, messaging
Requires at least: 5.0
Tested up to: 6.8
Requires PHP: 7.4
Stable tag: 5.2
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

WebSocket IRC client for WordPress with real-time messaging, private chats, and desktop notifications.

# Badwolf Web IRC Client - Version 5.2.0

## Description

A modern, feature-rich WebSocket IRC client for WordPress. Connect your website visitors to your IRC server with real-time chat, private messaging, desktop notifications, and a beautiful tabbed interface.

## Version 5.2.0 - What's New

### 🔧 WordPress 6.9 Compatibility

-   **FIXED**: Plugin now works perfectly with WordPress 6.9
-   **FIXED**: Script loading issues with block themes and Full Site Editing (FSE)
-   **FIXED**: Configuration passing to JavaScript

### 🔌 WebSocket Improvements

-   **FIXED**: Connection stability issues
-   **FIXED**: Binary WebSocket data handling
-   **ADDED**: IRC subprotocol support for UnrealIRCd

### ⚙️ User Experience

-   **ADDED**: Settings link in plugin list for easy access
-   **IMPROVED**: Error handling and logging
-   **IMPROVED**: Connection reliability

## Features

-   ✅ Real-time IRC chat via secure WebSocket (wss://)
-   ✅ Private messaging between users
-   ✅ Desktop notifications for mentions and PMs
-   ✅ Multiple channel support with tabbed interface
-   ✅ User list with right-click context menus
-   ✅ Command history (use arrow keys)
-   ✅ Auto-reconnection with smart retry logic
-   ✅ Customizable themes (light/dark)
-   ✅ Mobile-responsive design
-   ✅ IRC commands support (/nick, /join, /part, /msg, /me)
-   ✅ Tab completion for nicknames
-   ✅ Unread message badges
-   ✅ Message history (500 messages per channel)

## Requirements

-   **WordPress**: 5.0 or higher (tested up to 6.9)
-   **PHP**: 7.4 or higher
-   **IRC Server**: UnrealIRCd 6.x with WebSocket support (recommended)
-   **SSL Certificate**: Valid SSL/TLS certificate for secure WebSocket (wss://)

## Installation

1.  Download the plugin
2.  Upload to `/wp-content/plugins/badwolf-web-irc-client/`
3.  Activate the plugin through the 'Plugins' menu in WordPress
4.  Go to **Settings → Badwolf Web IRC Client**
5.  Configure your WebSocket URL and channel
6.  Add `[web_irc_client]` shortcode to any page or post

## Configuration

### WordPress Settings

Navigate to **Settings → Badwolf Web IRC Client** and configure:

-   **WebSocket URL**: Your IRC server WebSocket URL (e.g., `wss://irc.example.com:7443`)
-   **Default Channel**: IRC channel to join (e.g., `#general`)
-   **Nickname Prefix**: Prefix for auto-generated nicknames (e.g., `guest`)
-   **Real Name**: Default real name for users
-   **Theme**: Light or Dark theme
-   **Auto Connect**: Automatically connect when page loads

### UnrealIRCd Server Configuration

Your UnrealIRCd server must have WebSocket support enabled:

```conf
# Load WebSocket module
loadmodule "websocket";

# Configure WebSocket listener
listen {
    ip *;
    port 7443;
    options {
        tls;
        websocket;
    }
    tls-options {
        certificate "/path/to/fullchain.pem";
        key "/path/to/privkey.pem";
        options {
            no-client-certificate;
        }
    }
}
```

### SSL Certificate Setup (Let's Encrypt)

```bash
# Install certbot if not already installed
sudo apt-get install certbot

# Get certificate for your IRC domain
sudo certbot certonly --standalone -d irc.yourdomain.com

# Copy certificates to UnrealIRCd
sudo cp /etc/letsencrypt/live/irc.yourdomain.com/fullchain.pem /path/to/unrealircd/conf/tls/
sudo cp /etc/letsencrypt/live/irc.yourdomain.com/privkey.pem /path/to/unrealircd/conf/tls/

# Set correct permissions
sudo chown unrealircd:unrealircd /path/to/unrealircd/conf/tls/*.pem
sudo chmod 600 /path/to/unrealircd/conf/tls/privkey.pem
sudo chmod 644 /path/to/unrealircd/conf/tls/fullchain.pem

# Restart UnrealIRCd
cd /path/to/unrealircd
./unrealircd restart
```

### Auto-Renewal Setup

Create a renewal hook to automatically copy certificates:

```bash
# Create renewal hook script
sudo nano /etc/letsencrypt/renewal-hooks/deploy/copy-to-unrealircd.sh
```

Add this content:

```bash
#!/bin/bash
cp /etc/letsencrypt/live/irc.yourdomain.com/fullchain.pem /path/to/unrealircd/conf/tls/
cp /etc/letsencrypt/live/irc.yourdomain.com/privkey.pem /path/to/unrealircd/conf/tls/
chown unrealircd:unrealircd /path/to/unrealircd/conf/tls/*.pem
chmod 600 /path/to/unrealircd/conf/tls/privkey.pem
chmod 644 /path/to/unrealircd/conf/tls/fullchain.pem
/path/to/unrealircd/unrealircd rehash
```

Make it executable:

```bash
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/copy-to-unrealircd.sh
```

## Usage

### Basic Shortcode

```
[web_irc_client]
```

### Shortcode with Attributes

```
[web_irc_client theme="dark" width="100%" height="600px"]
```

**Available attributes:**

-   `theme` - Override theme (light or dark)
-   `width` - Set custom width (default: 100%)
-   `height` - Set custom height (default: 70vh)

### IRC Commands

Users can use standard IRC commands:

-   `/nick newname` - Change nickname
-   `/join #channel` - Join a channel
-   `/part` - Leave current channel
-   `/msg username message` - Send private message
-   `/me action` - Send action message
-   `/help` - Show available commands

## Troubleshooting

### Connection Issues

**Problem**: "Reconnecting..." message appears

**Solutions**:

1.  Verify UnrealIRCd is running: `ps aux | grep unrealircd`
2.  Check port is listening: `sudo netstat -tlnp | grep 7443`
3.  Verify SSL certificate is valid and not expired
4.  Check UnrealIRCd logs: `tail -f /path/to/unrealircd/logs/ircd.log`
5.  Test WebSocket connection: [https://www.piesocket.com/websocket-tester](https://www.piesocket.com/websocket-tester)

### SSL Certificate Errors

**Problem**: Certificate expired or invalid

**Solution**:

```bash
# Check certificate expiry
sudo certbot certificates

# Renew if needed
sudo certbot renew --force-renewal

# Copy to UnrealIRCd and restart
sudo cp /etc/letsencrypt/live/irc.yourdomain.com/*.pem /path/to/unrealircd/conf/tls/
./unrealircd restart
```

### Plugin Not Loading

**Problem**: IRC client doesn't appear on page

**Solutions**:

1.  Verify shortcode is correct: `[web_irc_client]`
2.  Clear WordPress cache
3.  Clear browser cache (Ctrl+Shift+R)
4.  Check browser console for JavaScript errors (F12)
5.  Verify WebSocket URL is configured in plugin settings

### WordPress 6.9 Issues

**Problem**: Plugin stopped working after WordPress 6.9 update

**Solution**: Update to version 5.2.0 which includes WordPress 6.9 compatibility fixes.

## Frequently Asked Questions

**Q: Does this work with any IRC server?** A: It's designed for UnrealIRCd with WebSocket support, but should work with any IRC server that supports WebSocket connections with the IRC subprotocol.

**Q: Can I use this without SSL?** A: While technically possible with `ws://` instead of `wss://`, it's strongly discouraged. Modern browsers may block non-secure WebSocket connections.

**Q: How many users can connect?** A: Limited only by your IRC server configuration and hosting resources.

**Q: Can I customize the appearance?** A: Yes! The plugin includes light and dark themes, and you can add custom CSS to further customize the appearance.

**Q: Does it work on mobile?** A: Yes, the interface is fully responsive and works on mobile devices.

## Support

-   **GitHub**: [https://github.com/badwolf1972/web-irc-client](https://github.com/badwolf1972/web-irc-client)
-   **Issues**: [https://github.com/badwolf1972/web-irc-client/issues](https://github.com/badwolf1972/web-irc-client/issues)
-   **WordPress Support**: [https://wordpress.org/support/plugin/badwolf-web-irc-client/](https://wordpress.org/support/plugin/badwolf-web-irc-client/)

## Credits

-   **Author**: Martin Cooper (badwolf72)
-   **Website**: [https://www.oo3dmodels.com](https://www.oo3dmodels.com)
-   **License**: GPL v2 or later

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for detailed version history.

* * *

**Version**: 5.2.0  
**Last Updated**: January 18, 2026  
**Tested up to**: WordPress 6.9  
**Requires PHP**: 7.4+
