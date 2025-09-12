# WhatsApp Message Blur Chrome Extension

A Chrome extension that allows you to blur messages from specific WhatsApp contacts to maintain privacy while using WhatsApp Web.

## Features

- 🔒 Blur messages from specific contacts
- 👥 **NEW: Multi-user management** - Manage blur settings for multiple users at once
- 🔍 **NEW: Auto-scan users** - Automatically detect all users visible on WhatsApp Web
- 🎛️ Granular control over what gets blurred:
  - Chat list name and message preview
  - Chat list avatar
  - Header name and avatar
  - Message text and images
- 🎨 Beautiful, modern UI with tabbed interface
- 💾 Settings are saved and persist across sessions
- 🔄 Auto-reapplies blur when navigating WhatsApp Web
- 🎯 Individual toggle controls for each user

## Installation

1. **Download the extension files** to a folder on your computer
2. **Open Chrome** and go to `chrome://extensions/`
3. **Enable Developer mode** (toggle in the top right)
4. **Click "Load unpacked"** and select the folder containing the extension files
5. **Pin the extension** to your toolbar for easy access

## Usage

### Settings Tab (Original Functionality)
1. **Open WhatsApp Web** in your browser
2. **Click the extension icon** in your toolbar
3. **Enter the contact name** you want to blur (exactly as it appears in WhatsApp)
4. **Configure blur settings** by checking/unchecking the options
5. **Click "Apply Blur"** to start blurring

### Manage Users Tab (NEW)
1. **Click the "Manage Users" tab** in the extension popup
2. **Click "Scan for Users"** to automatically detect all users currently visible on WhatsApp Web
3. **Toggle blur on/off** for individual users using the toggle switches
4. **Remove users** from the list using the × button
5. **Clear all users** using the "Clear All Users" button

### Quick Actions

- **Apply Blur**: Applies blur with current settings (Settings tab)
- **Toggle Blur**: Enable/disable blur without changing settings (Settings tab)
- **Clear All**: Remove all blur effects (Settings tab)
- **Scan for Users**: Automatically detect users (Manage Users tab)
- **Clear All Users**: Remove all users from management list (Manage Users tab)

### Context Menu

You can also right-click on a contact name in WhatsApp Web and select "Blur this contact" to quickly set up blur for that contact.

## How It Works

The extension injects CSS blur filters into WhatsApp Web to hide content from specific contacts. It uses:

- **CSS `filter: blur()`** to blur text and images
- **MutationObserver** to detect when new content is added
- **Chrome Storage API** to save your settings
- **Content Scripts** to interact with WhatsApp Web

## Privacy

- All data is stored locally in your browser
- No data is sent to external servers
- The extension only works on WhatsApp Web
- You have full control over what gets blurred

## Troubleshooting

### Blur not working?
1. Make sure you're on WhatsApp Web (`web.whatsapp.com`)
2. Check that the contact name matches exactly (case-sensitive)
3. Try refreshing the page and reapplying blur
4. Use the "Clear All" button and try again

### Extension not loading?
1. Make sure Developer mode is enabled in Chrome
2. Check the console for any error messages
3. Try reloading the extension in `chrome://extensions/`

## File Structure

```
whatsapp-blur-messages/
├── manifest.json          # Extension configuration
├── popup.html            # Extension popup UI
├── popup.css             # Popup styling
├── popup.js              # Popup functionality
├── content.js            # Content script (injected into WhatsApp Web)
├── background.js         # Background script
├── whatsapp-blur-final.js # Original blur script (reference)
└── README.md             # This file
```

## Development

To modify the extension:

1. Edit the relevant files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension
4. Test your changes

## License

This project is open source and available under the MIT License.

## Contributing

Feel free to submit issues and enhancement requests!
