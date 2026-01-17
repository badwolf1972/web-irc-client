<?php
/**
 * Plugin Name: Badwolf Web IRC Client
 * Description: WebSocket IRC client for WordPress with real-time messaging, private chats, and desktop notifications. Requires WebSocket-enabled IRC server (UnrealIRCd recommended).
 * Version: 5.2
 * Author: Martin Cooper (badwolf72)
 * Author URI: https://www.oo3dmodels.com
 * Plugin URI: https://github.com/badwolf1972/web-irc-client
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: badwolf-web-irc-client
 * Contributors: badwolf72
 * Requires at least: 5.0
 * Tested up to: 6.9
 * Requires PHP: 7.4
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit('Direct access denied.');
}

// Define plugin constants
define('BADWOLF_WEB_IRC_CLIENT_VERSION', '5.2');
define('BADWOLF_WEB_IRC_CLIENT_PLUGIN_URL', plugin_dir_url(__FILE__));
define('BADWOLF_WEB_IRC_CLIENT_PLUGIN_PATH', plugin_dir_path(__FILE__));
define('BADWOLF_WEB_IRC_CLIENT_PLUGIN_BASENAME', plugin_basename(__FILE__));

// Security: Validate WordPress environment
if (!function_exists('add_action')) {
    exit('WordPress environment not detected.');
}

/**
 * Main plugin class
 */
class WebIRCClient {

    /**
     * Constructor
     */
    public function __construct() {
        add_action('init', array($this, 'init'));
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));
        add_shortcode('web_irc_client', array($this, 'shortcode_handler'));

        // Admin functionality
        if (is_admin()) {
            add_action('admin_menu', array($this, 'admin_menu'));
            add_action('admin_init', array($this, 'admin_init'));
            // Add settings link on plugin page
            add_filter('plugin_action_links_' . BADWOLF_WEB_IRC_CLIENT_PLUGIN_BASENAME, array($this, 'add_settings_link'));
        }

        // Plugin lifecycle hooks
        register_activation_hook(__FILE__, array($this, 'activate'));
        register_deactivation_hook(__FILE__, array($this, 'deactivate'));
        register_uninstall_hook(__FILE__, array('WebIRCClient', 'uninstall'));
    }

    /**
     * Initialize plugin
     */
    public function init() {
        // Initialize plugin - text domain loaded automatically by WordPress.org
    }

    /**
     * Enqueue scripts and styles
     * FIXED FOR WORDPRESS 6.9: Improved shortcode detection that works with block themes and FSE
     */
    public function enqueue_scripts() {
        // Register scripts and styles (always register, enqueue conditionally)
        wp_register_style(
            'badwolf-web-irc-client-css',
            BADWOLF_WEB_IRC_CLIENT_PLUGIN_URL . 'assets/web-irc.css',
            array(),
            BADWOLF_WEB_IRC_CLIENT_VERSION
        );

        wp_register_script(
            'badwolf-web-irc-client-js',
            BADWOLF_WEB_IRC_CLIENT_PLUGIN_URL . 'assets/web-irc.js',
            array(),
            BADWOLF_WEB_IRC_CLIENT_VERSION,
            true
        );

        // WORDPRESS 6.9 FIX: Check for shortcode in multiple ways
        $should_enqueue = false;

        // Method 1: Check global $post (works for classic themes and single posts)
        global $post;
        if (is_a($post, 'WP_Post') && has_shortcode($post->post_content, 'web_irc_client')) {
            $should_enqueue = true;
        }

        // Method 2: Check all posts in query (archives, block themes)
        if (!$should_enqueue) {
            global $wp_query;
            if (isset($wp_query->posts) && is_array($wp_query->posts)) {
                foreach ($wp_query->posts as $query_post) {
                    if (has_shortcode($query_post->post_content, 'web_irc_client')) {
                        $should_enqueue = true;
                        break;
                    }
                }
            }
        }

        // Method 3: Check post meta (page builders like Elementor, Divi)
        if (!$should_enqueue && is_a($post, 'WP_Post')) {
            global $wpdb;
            $result = $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM $wpdb->postmeta " .
                "WHERE post_id = %d AND meta_value LIKE %s",
                $post->ID,
                '%web_irc_client%'
            ));
            if (!empty($result)) {
                $should_enqueue = true;
            }
        }

        // Enqueue if shortcode is detected
        if ($should_enqueue) {
            wp_enqueue_style('badwolf-web-irc-client-css');
            wp_enqueue_script('badwolf-web-irc-client-js');
            
            // CRITICAL FIX: Pass configuration to JavaScript AFTER enqueuing
            $config = array(
                'ws_url' => get_option('web_irc_ws_url', ''),
                'channel' => sanitize_text_field(get_option('web_irc_channel', '')),
                'nickname_prefix' => sanitize_text_field(get_option('web_irc_nickname_prefix', 'supportguest')),
                'realname' => sanitize_text_field(get_option('web_irc_realname', 'Web IRC User')),
                'theme' => sanitize_text_field(get_option('web_irc_theme', 'light')),
                'autoconnect' => sanitize_text_field(get_option('web_irc_autoconnect', 'yes'))
            );
            wp_localize_script('badwolf-web-irc-client-js', 'WEB_IRC_CLIENT_CFG', $config);
        }
    }

    /**
     * Shortcode handler
     * ENHANCED: Also enqueues scripts if they weren't already enqueued
     */
    public function shortcode_handler($atts) {
        // Ensure scripts are enqueued (fallback for edge cases)
        if (!wp_style_is('badwolf-web-irc-client-css', 'enqueued')) {
            wp_enqueue_style('badwolf-web-irc-client-css');
        }
        if (!wp_script_is('badwolf-web-irc-client-js', 'enqueued')) {
            wp_enqueue_script('badwolf-web-irc-client-js');
            
            // Also add config if script wasn't enqueued earlier
            $config = array(
                'ws_url' => get_option('web_irc_ws_url', ''),
                'channel' => sanitize_text_field(get_option('web_irc_channel', '')),
                'nickname_prefix' => sanitize_text_field(get_option('web_irc_nickname_prefix', 'supportguest')),
                'realname' => sanitize_text_field(get_option('web_irc_realname', 'Web IRC User')),
                'theme' => sanitize_text_field(get_option('web_irc_theme', 'light')),
                'autoconnect' => sanitize_text_field(get_option('web_irc_autoconnect', 'yes'))
            );
            wp_localize_script('badwolf-web-irc-client-js', 'WEB_IRC_CLIENT_CFG', $config);
        }

        // Parse attributes with defaults
        $atts = shortcode_atts(array(
            'theme' => get_option('web_irc_theme', 'light'),
            'width' => '100%',
            'height' => '70vh'
        ), $atts, 'web_irc_client');

        // Sanitize attributes
        $theme = sanitize_text_field($atts['theme']);
        $width = sanitize_text_field($atts['width']);
        $height = sanitize_text_field($atts['height']);

        // Validate theme
        if (!in_array($theme, array('light', 'dark'), true)) {
            $theme = 'light';
        }

        // Build HTML output
        ob_start();
        ?>
        <div id="web-irc-container" class="theme-<?php echo esc_attr($theme); ?>" style="width: <?php echo esc_attr($width); ?>; height: <?php echo esc_attr($height); ?>;">
            <div class="irc-sidebar">
                <div class="irc-server-status">
                    <div><strong><?php esc_html_e('Status:', 'badwolf-web-irc-client'); ?></strong> <span id="irc-status"><?php esc_html_e('Not connected', 'badwolf-web-irc-client'); ?></span></div>
                    <div><strong><?php esc_html_e('Channel:', 'badwolf-web-irc-client'); ?></strong> <span id="irc-channel"><?php esc_html_e('None', 'badwolf-web-irc-client'); ?></span></div>
                    <div><strong><?php esc_html_e('WebSocket:', 'badwolf-web-irc-client'); ?></strong> <span id="irc-ws-url"><?php esc_html_e('Not set', 'badwolf-web-irc-client'); ?></span></div>
                    <div><strong><?php esc_html_e('Version:', 'badwolf-web-irc-client'); ?></strong> <span id="irc-client-version"><?php esc_html_e('Loading...', 'badwolf-web-irc-client'); ?></span></div>
                </div>

                <div class="irc-userlist">
                    <h3><?php esc_html_e('Users Online', 'badwolf-web-irc-client'); ?></h3>
                    <ul id="irc-users"></ul>
                </div>
            </div>

            <div class="irc-main">
                <div class="irc-messages" id="irc-messages"></div>

                <div class="irc-input">
                    <form id="irc-input-form" style="display: flex; width: 100%; gap: 6px;">
                        <input type="text" id="irc-input" placeholder="<?php esc_attr_e('Type your message... (or /help for commands)', 'badwolf-web-irc-client'); ?>" autocomplete="off" maxlength="400" />
                        <button type="submit"><?php esc_html_e('Send', 'badwolf-web-irc-client'); ?></button>
                    </form>
                </div>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    /**
     * Add settings link to plugin page
     */
    public function add_settings_link($links) {
        $settings_link = '<a href="' . admin_url('options-general.php?page=badwolf-web-irc-client') . '">' . esc_html__('Settings', 'badwolf-web-irc-client') . '</a>';
        array_unshift($links, $settings_link);
        return $links;
    }

    /**
     * Add admin menu
     */
    public function admin_menu() {
        add_options_page(
            esc_html__('Badwolf Web IRC Client Settings', 'badwolf-web-irc-client'),
            esc_html__('Badwolf Web IRC Client', 'badwolf-web-irc-client'),
            'manage_options',
            'badwolf-web-irc-client',
            array($this, 'admin_page')
        );
    }

    /**
     * Initialize admin settings
     */
    public function admin_init() {
        // Register settings
        register_setting('web_irc_client_settings', 'web_irc_ws_url', array(
            'type' => 'string',
            'sanitize_callback' => array($this, 'sanitize_websocket_url'),
            'default' => ''
        ));

        register_setting('web_irc_client_settings', 'web_irc_channel', array(
            'type' => 'string',
            'sanitize_callback' => array($this, 'sanitize_channel'),
            'default' => ''
        ));

        register_setting('web_irc_client_settings', 'web_irc_nickname_prefix', array(
            'type' => 'string',
            'sanitize_callback' => array($this, 'sanitize_nickname'),
            'default' => 'supportguest'
        ));

        register_setting('web_irc_client_settings', 'web_irc_realname', array(
            'type' => 'string',
            'sanitize_callback' => 'sanitize_text_field',
            'default' => 'Web IRC User'
        ));

        register_setting('web_irc_client_settings', 'web_irc_theme', array(
            'type' => 'string',
            'sanitize_callback' => array($this, 'sanitize_theme'),
            'default' => 'light'
        ));

        register_setting('web_irc_client_settings', 'web_irc_autoconnect', array(
            'type' => 'string',
            'sanitize_callback' => array($this, 'sanitize_boolean'),
            'default' => 'yes'
        ));
    }

    /**
     * Sanitize WebSocket URL
     */
    public function sanitize_websocket_url($url) {
        $url = sanitize_text_field($url);

        // Allow ws:// and wss:// protocols
        if (preg_match('/^wss?:\/\/[a-zA-Z0-9.-]+(?::[0-9]+)?(?:\/.*)?$/', $url)) {
            return $url;
        }

        return '';
    }



    /**
     * Sanitize channel name
     */
    public function sanitize_channel($channel) {
        $channel = sanitize_text_field($channel);

        // Validate that channel is not empty
        if (empty($channel) || trim($channel) === '') {
            add_settings_error('web_irc_client_settings', 'missing_channel', 'Channel is required and cannot be empty.');
            return get_option('web_irc_channel', ''); // Return current value
        }

        if (!empty($channel) && $channel[0] !== '#') {
            $channel = '#' . $channel;
        }
        return preg_replace('/[^#a-zA-Z0-9_-]/', '', $channel);
    }




    /**
     * Sanitize nickname
     */
    public function sanitize_nickname($nickname) {
        return preg_replace('/[^a-zA-Z0-9_-]/', '', sanitize_text_field($nickname));
    }

    /**
     * Sanitize theme
     */
    public function sanitize_theme($theme) {
        return in_array($theme, array('light', 'dark'), true) ? $theme : 'light';
    }

    /**
     * Sanitize boolean
     */
    public function sanitize_boolean($value) {
        return in_array($value, array('yes', 'no'), true) ? $value : 'yes';
    }

    /**
     * Admin page
     */
    public function admin_page() {
        // Check user permissions
        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('You do not have sufficient permissions to access this page.', 'badwolf-web-irc-client'));
        }


        // Get current settings
        $ws_url = get_option('web_irc_ws_url', '');
        $channel = get_option('web_irc_channel', '');
        $nickname_prefix = get_option('web_irc_nickname_prefix', 'supportguest');
        $realname = get_option('web_irc_realname', 'Web IRC User');
        $theme = get_option('web_irc_theme', 'light');
        $autoconnect = get_option('web_irc_autoconnect', 'yes');
        ?>

        <div class="wrap">
            <h1><?php echo esc_html(get_admin_page_title()); ?></h1>

            <?php settings_errors(); ?>

            <form method="post" action="options.php">
                <?php
                settings_fields('web_irc_client_settings');
                do_settings_sections('web_irc_client_settings');
                ?>

                <table class="form-table" role="presentation">
                    <tbody>
                        <tr>
                            <th scope="row">
                                <label for="web_irc_ws_url"><?php esc_html_e('WebSocket URL', 'badwolf-web-irc-client'); ?></label>
                            </th>
                            <td>
                                <input type="url" id="web_irc_ws_url" name="web_irc_ws_url" value="<?php echo esc_attr($ws_url); ?>" class="regular-text" required />
                                <p class="description"><?php esc_html_e('WebSocket server URL (e.g., wss://irc.example.com:6697)', 'badwolf-web-irc-client'); ?></p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row">
                                <label for="web_irc_channel"><?php esc_html_e('Default Channel', 'badwolf-web-irc-client'); ?></label>
                            </th>
                            <td>
                                <input type="text" id="web_irc_channel" name="web_irc_channel" value="<?php echo esc_attr($channel); ?>" class="regular-text" />
                                <p class="description"><?php esc_html_e('Default IRC channel to join (with or without #)', 'badwolf-web-irc-client'); ?></p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row">
                                <label for="web_irc_nickname_prefix"><?php esc_html_e('Nickname Prefix', 'badwolf-web-irc-client'); ?></label>
                            </th>
                            <td>
                                <input type="text" id="web_irc_nickname_prefix" name="web_irc_nickname_prefix" value="<?php echo esc_attr($nickname_prefix); ?>" class="regular-text" />
                                <p class="description"><?php esc_html_e('Prefix for auto-generated nicknames', 'badwolf-web-irc-client'); ?></p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row">
                                <label for="web_irc_realname"><?php esc_html_e('Real Name', 'badwolf-web-irc-client'); ?></label>
                            </th>
                            <td>
                                <input type="text" id="web_irc_realname" name="web_irc_realname" value="<?php echo esc_attr($realname); ?>" class="regular-text" />
                                <p class="description"><?php esc_html_e('Default real name for IRC users', 'badwolf-web-irc-client'); ?></p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row">
                                <label for="web_irc_theme"><?php esc_html_e('Theme', 'badwolf-web-irc-client'); ?></label>
                            </th>
                            <td>
                                <select id="web_irc_theme" name="web_irc_theme">
                                    <option value="light" <?php selected($theme, 'light'); ?>><?php esc_html_e('Light', 'badwolf-web-irc-client'); ?></option>
                                    <option value="dark" <?php selected($theme, 'dark'); ?>><?php esc_html_e('Dark', 'badwolf-web-irc-client'); ?></option>
                                </select>
                                <p class="description"><?php esc_html_e('Default theme for the IRC client', 'badwolf-web-irc-client'); ?></p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row">
                                <label for="web_irc_autoconnect"><?php esc_html_e('Auto Connect', 'badwolf-web-irc-client'); ?></label>
                            </th>
                            <td>
                                <select id="web_irc_autoconnect" name="web_irc_autoconnect">
                                    <option value="yes" <?php selected($autoconnect, 'yes'); ?>><?php esc_html_e('Yes', 'badwolf-web-irc-client'); ?></option>
                                    <option value="no" <?php selected($autoconnect, 'no'); ?>><?php esc_html_e('No', 'badwolf-web-irc-client'); ?></option>
                                </select>
                                <p class="description"><?php esc_html_e('Automatically connect when page loads', 'badwolf-web-irc-client'); ?></p>
                            </td>
                        </tr>
                    </tbody>
                </table>

                <?php submit_button(); ?>
            </form>

            <div class="card" style="margin-top: 20px; padding: 15px;">
                <h2><?php esc_html_e('Usage', 'badwolf-web-irc-client'); ?></h2>
                <p><?php esc_html_e('Add the IRC client to any page or post using the shortcode:', 'badwolf-web-irc-client'); ?></p>
                <code>[web_irc_client]</code>

                <h3><?php esc_html_e('Shortcode Attributes', 'badwolf-web-irc-client'); ?></h3>
                <ul>
                    <li><code>theme</code> - <?php esc_html_e('Override theme (light or dark)', 'badwolf-web-irc-client'); ?></li>
                    <li><code>width</code> - <?php esc_html_e('Set custom width (default: 100%)', 'badwolf-web-irc-client'); ?></li>
                    <li><code>height</code> - <?php esc_html_e('Set custom height (default: 70vh)', 'badwolf-web-irc-client'); ?></li>
                </ul>

                <p><?php esc_html_e('Example:', 'badwolf-web-irc-client'); ?> <code>[web_irc_client theme="dark" height="500px"]</code></p>
            </div>

            <div class="card" style="margin-top: 20px; padding: 15px;">
                <h2><?php esc_html_e('Current Status', 'badwolf-web-irc-client'); ?></h2>
                <ul>
                    <li><strong><?php esc_html_e('WebSocket URL:', 'badwolf-web-irc-client'); ?></strong> <?php echo esc_html($ws_url ?: esc_html__('Not configured', 'badwolf-web-irc-client')); ?></li>
                    <li><strong><?php esc_html_e('Default Channel:', 'badwolf-web-irc-client'); ?></strong> <?php echo esc_html($channel); ?></li>
                    <li><strong><?php esc_html_e('Theme:', 'badwolf-web-irc-client'); ?></strong> <?php echo esc_html(ucfirst($theme)); ?></li>
                    <li><strong><?php esc_html_e('Auto Connect:', 'badwolf-web-irc-client'); ?></strong> <?php echo esc_html(ucfirst($autoconnect)); ?></li>
                    <li><strong><?php esc_html_e('Plugin Version:', 'badwolf-web-irc-client'); ?></strong> <?php echo esc_html(BADWOLF_WEB_IRC_CLIENT_VERSION); ?></li>
                </ul>
            </div>

            <div class="card" style="margin-top: 20px; padding: 15px;">
                <h2><?php esc_html_e('IRC Commands', 'badwolf-web-irc-client'); ?></h2>
                <ul>
                    <li><code>/nick newname</code> - <?php esc_html_e('Change your nickname', 'badwolf-web-irc-client'); ?></li>
                    <li><code>/join #channel</code> - <?php esc_html_e('Join a channel', 'badwolf-web-irc-client'); ?></li>
                    <li><code>/part</code> - <?php esc_html_e('Leave current channel', 'badwolf-web-irc-client'); ?></li>
                    <li><code>/msg nick message</code> - <?php esc_html_e('Send private message', 'badwolf-web-irc-client'); ?></li>
                    <li><code>/me action</code> - <?php esc_html_e('Send action message', 'badwolf-web-irc-client'); ?></li>
                </ul>
            </div>

            <div class="notice notice-info" style="margin-top: 20px;">
                <p><strong><?php esc_html_e('WordPress 6.9 Compatibility:', 'badwolf-web-irc-client'); ?></strong> <?php esc_html_e('This version includes fixes for WordPress 6.9 compatibility issues.', 'badwolf-web-irc-client'); ?></p>
            </div>
        </div>
        <?php
    }

    /**
     * Plugin activation
     */
    public function activate() {
        // Set default options
        add_option('web_irc_ws_url', '');
        add_option('web_irc_channel', '');
        add_option('web_irc_nickname_prefix', 'supportguest');
        add_option('web_irc_realname', 'Web IRC User');
        add_option('web_irc_theme', 'light');
        add_option('web_irc_autoconnect', 'yes');

        // Flush rewrite rules
        flush_rewrite_rules();
    }

    /**
     * Plugin deactivation
     */
    public function deactivate() {
        // Flush rewrite rules
        flush_rewrite_rules();
    }

    /**
     * Plugin uninstall
     */
    public static function uninstall() {
        // Remove options
        delete_option('web_irc_ws_url');
        delete_option('web_irc_channel');
        delete_option('web_irc_nickname_prefix');
        delete_option('web_irc_realname');
        delete_option('web_irc_theme');
        delete_option('web_irc_autoconnect');

        // Clean up any transients
        delete_transient('web_irc_client_cache');
    }
}

// Initialize the plugin
new WebIRCClient();

/**
 * Helper function to check if plugin is active
 */
function web_irc_client_is_active() {
    return class_exists('WebIRCClient');
}

/**
 * Helper function to get plugin version
 */
function web_irc_client_version() {
    return BADWOLF_WEB_IRC_CLIENT_VERSION;
}
