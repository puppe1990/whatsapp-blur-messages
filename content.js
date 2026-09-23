// WhatsApp Blur Content Script
/* global applyBlur, blurAllUsers, blurContact, clearAllUsers, clearBlur, removeUserBlur, scanForUsers, setupBlurObserver, toggleBlur, toggleUserBlur, unblurAllUsers */

// Message router and startup bootstrap. Loaded last: the other content scripts
// (state, styles, DOM helpers, controller, scanner) are declared before this one in manifest.json.

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script received message:', request);

    switch (request.action) {
        case 'ping':
            console.log('🏓 Content script ping received');
            sendResponse({ success: true, message: 'Content script is loaded' });
            break;

        case 'applyBlur':
            applyBlur(request.contactName, request.blurSettings, request.blurTypeSettings);
            sendResponse({ success: true });
            break;

        case 'toggleBlur':
            toggleBlur();
            sendResponse({ success: true, isEnabled: isBlurEnabled });
            break;

        case 'clearBlur':
            clearBlur();
            sendResponse({ success: true });
            break;

        case 'scanUsers': {
            const users = scanForUsers();
            sendResponse({ success: true, users: users });
            break;
        }

        case 'toggleUserBlur':
            console.log('Content script received toggleUserBlur:', request);
            toggleUserBlur(request.userName, request.isBlurred, request.blurSettings, request.blurTypeSettings);
            sendResponse({ success: true });
            break;

        case 'removeUserBlur':
            removeUserBlur(request.userName);
            sendResponse({ success: true });
            break;

        case 'clearAllUsers':
            clearAllUsers();
            sendResponse({ success: true });
            break;

        case 'blurAllUsers':
            console.log('📨 Content script received blurAllUsers message:', {
                action: request.action,
                userCount: request.users ? request.users.length : 0,
                users: request.users
            });
            console.log(
                '🔍 Detailed user analysis:',
                request.users?.map((u) => ({
                    name: u.name,
                    isBlurred: u.isBlurred,
                    hasValidName: !!u.name,
                    nameLength: u.name?.length
                }))
            );
            try {
                const result = blurAllUsers(request.users);
                console.log('✅ blurAllUsers operation completed successfully with result:', result);
                sendResponse({ success: true, result });
            } catch (error) {
                console.error('❌ Error in blurAllUsers operation:', error);
                sendResponse({ success: false, error: error.message });
            }
            break;

        case 'unblurAllUsers':
            console.log('Content script received unblurAllUsers:', request);
            unblurAllUsers(request.users);
            sendResponse({ success: true });
            break;

        case 'wppExportStart':
            if (!WPP_EXPORT) {
                sendResponse({ success: false, error: 'Extractor not initialized' });
                break;
            }
            sendResponse({
                success: true,
                started: WPP_EXPORT.start()
            });
            break;

        case 'wppExportStop':
            if (!WPP_EXPORT) {
                sendResponse({ success: false, error: 'Extractor not initialized' });
                break;
            }
            WPP_EXPORT.stop();
            sendResponse({ success: true });
            break;

        case 'wppExportClear':
            if (!WPP_EXPORT) {
                sendResponse({ success: false, error: 'Extractor not initialized' });
                break;
            }
            WPP_EXPORT.clear();
            sendResponse({ success: true });
            break;

        case 'wppExportGet':
            if (!WPP_EXPORT) {
                sendResponse({ success: false, error: 'Extractor not initialized' });
                break;
            }
            sendResponse({
                success: true,
                count: WPP_EXPORT.messages.length,
                messages: WPP_EXPORT.getMessages(request.limit)
            });
            break;

        case 'wppExportDownload':
            if (!WPP_EXPORT) {
                sendResponse({ success: false, error: 'Extractor not initialized' });
                break;
            }
            if (request.format === 'zip') {
                WPP_EXPORT.downloadZip()
                    .then((fileName) => {
                        sendResponse({ success: true, fileName });
                    })
                    .catch((error) => {
                        console.error('[WPP_EXPORT] erro ao gerar ZIP', error);
                        sendResponse({ success: false, error: error?.message || 'Failed to generate ZIP' });
                    });
            } else {
                if (request.format === 'txt') {
                    WPP_EXPORT.downloadTxt();
                } else if (request.format === 'html') {
                    WPP_EXPORT.downloadHtml();
                } else {
                    WPP_EXPORT.downloadJson();
                }
                sendResponse({ success: true });
            }
            break;

        default:
            sendResponse({ success: false, error: 'Unknown action' });
    }

    return true; // Keep message channel open for async response
});

// Auto-apply blur when page loads if settings exist
chrome.storage.sync.get(['contactName', 'blurSettings', 'isEnabled', 'managedUsers'], function (result) {
    // Load managed users
    if (result.managedUsers && result.managedUsers.length > 0) {
        result.managedUsers.forEach((user) => {
            if (user.isBlurred) {
                managedUsers.set(user.name, user);
            }
        });

        // Apply blur for all managed users
        setTimeout(() => {
            for (let [userName, userData] of managedUsers) {
                if (userData.isBlurred) {
                    blurContact(userName, userData.blurSettings, userData.blurTypeSettings);
                }
            }
            setupBlurObserver();
        }, 2000);
    }

    // Legacy support for single user
    if (result.isEnabled && result.contactName && result.blurSettings) {
        setTimeout(() => {
            const blurTypeSettings = result.blurTypeSettings || { type: 'standard' };
            applyBlur(result.contactName, result.blurSettings, blurTypeSettings);
        }, 2000);
    }
});

console.log('WhatsApp Blur Content Script loaded');
