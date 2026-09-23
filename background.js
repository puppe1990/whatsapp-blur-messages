// Background script for WhatsApp Blur Extension

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
    console.log('WhatsApp Blur Extension installed');

    // Set default settings
    chrome.storage.sync.set({
        contactName: '',
        blurSettings: {
            chatListName: true,
            chatListMessage: true,
            chatListAvatar: true,
            headerName: true,
            headerAvatar: true,
            messageText: true,
            messageImages: true
        },
        isEnabled: false
    });

    // Create context menu item
    chrome.contextMenus.create({
        id: 'whatsapp-blur',
        title: 'Blur this contact',
        contexts: ['selection'],
        documentUrlPatterns: ['https://web.whatsapp.com/*']
    });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'whatsapp-blur' && info.selectionText) {
        // Get the selected text as contact name
        const contactName = info.selectionText.trim();

        // Save the contact name
        chrome.storage.sync.set({
            contactName: contactName,
            isEnabled: true
        });

        // Send message to content script to apply blur
        chrome.tabs.sendMessage(tab.id, {
            action: 'applyBlur',
            contactName: contactName,
            blurSettings: {
                chatListName: true,
                chatListMessage: true,
                chatListAvatar: true,
                headerName: true,
                headerAvatar: true,
                messageText: true,
                messageImages: true
            }
        });
    }
});

// Handle tab updates to re-apply blur when navigating
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes('web.whatsapp.com')) {
        // Wait a bit for WhatsApp to load, then check if we need to re-apply blur
        setTimeout(() => {
            chrome.storage.sync.get(['contactName', 'blurSettings', 'isEnabled'], function (result) {
                if (result.isEnabled && result.contactName && result.blurSettings) {
                    chrome.tabs.sendMessage(tabId, {
                        action: 'applyBlur',
                        contactName: result.contactName,
                        blurSettings: result.blurSettings
                    });
                }
            });
        }, 3000);
    }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateBadge') {
        // Update extension badge to show status
        chrome.action.setBadgeText({
            text: request.isEnabled ? 'ON' : 'OFF',
            tabId: sender.tab.id
        });

        chrome.action.setBadgeBackgroundColor({
            color: request.isEnabled ? '#25D366' : '#ff4757',
            tabId: sender.tab.id
        });
    }
});

// Note: chrome.action.onClicked is not available when a popup is defined in manifest.json
// The popup will handle the extension icon click instead

console.log('WhatsApp Blur Background Script loaded');
