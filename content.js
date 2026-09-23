// WhatsApp Blur Content Script
let isBlurEnabled = false;
let currentSettings = null;
let blurObserver = null;
let lastBlurredElements = new Set();
let currentChatContext = null;
let managedUsers = new Map(); // Store multiple user blur settings
let WPP_EXPORT = null;

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

// Add blur styles with different blur types
function addBlurStyles(blurTypeSettings = { type: 'standard' }) {
    if (document.getElementById('wa-blur-style')) {
        console.log('🎨 Blur styles already exist, updating with new type');
        document.getElementById('wa-blur-style').remove();
    }

    console.log('🎨 Adding blur styles to document with type:', blurTypeSettings.type);

    const style = document.createElement('style');
    style.id = 'wa-blur-style';

    // Generate CSS based on blur type
    let blurCSS = generateBlurCSS(blurTypeSettings);

    style.textContent = blurCSS;
    document.head.appendChild(style);
    console.log('✅ Blur styles added to document head');

    // Force style recalculation
    setTimeout(() => {
        const testElement = document.querySelector('.wa-blur-target');
        if (testElement) {
            console.log('🔍 Testing blur style application:', {
                element: testElement,
                classes: testElement.className,
                computedFilter: window.getComputedStyle(testElement).filter,
                computedBackground: window.getComputedStyle(testElement).backgroundColor
            });
        }
    }, 100);
}

// Generate CSS for different blur types
function generateBlurCSS(blurTypeSettings) {
    const blurType = blurTypeSettings.type || 'standard';

    switch (blurType) {
        case 'standard':
            return generateStandardBlurCSS();
        case 'pixelated':
            return generatePixelatedBlurCSS();
        case 'blackout':
            return generateBlackoutBlurCSS();
        case 'invisible':
            return generateInvisibleBlurCSS();
        case 'custom':
            return generateCustomBlurCSS(blurTypeSettings);
        default:
            return generateStandardBlurCSS();
    }
}

function generateStandardBlurCSS() {
    return `
        .wa-blur-target {
            filter: blur(25px) !important;
            pointer-events: none !important;
            transition: none !important;
            background-color: rgba(255, 0, 0, 0.8) !important;
            border-radius: 4px !important;
            position: relative !important;
            overflow: hidden !important;
            transform: scale(1.05) !important;
        }
        .wa-blur-image {
            filter: blur(30px) !important;
            pointer-events: none !important;
            transition: none !important;
            background-color: rgba(255, 0, 0, 0.8) !important;
            border-radius: 4px !important;
            position: relative !important;
            overflow: hidden !important;
            transform: scale(1.05) !important;
        }
        .wa-blur-target::before {
            content: "🔒 BLURRED" !important;
            position: absolute !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            background: rgba(255, 0, 0, 0.9) !important;
            color: white !important;
            padding: 4px 8px !important;
            border-radius: 4px !important;
            font-size: 12px !important;
            font-weight: bold !important;
            z-index: 99999 !important;
            pointer-events: none !important;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3) !important;
        }
        .wa-blur-image::after {
            content: "🔒" !important;
            position: absolute !important;
            top: 5px !important;
            right: 5px !important;
            background: rgba(255, 0, 0, 0.9) !important;
            color: white !important;
            padding: 3px 6px !important;
            border-radius: 4px !important;
            font-size: 14px !important;
            z-index: 99999 !important;
            pointer-events: none !important;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3) !important;
        }
        /* Force override WhatsApp styles */
        .wa-blur-target[style*="filter"] {
            filter: blur(25px) !important;
        }
        .wa-blur-image[style*="filter"] {
            filter: blur(30px) !important;
        }
        /* Ultra-specific selectors to override WhatsApp */
        span[title].wa-blur-target {
            filter: blur(25px) !important;
            background-color: rgba(0, 0, 0, 0.3) !important;
        }
        img.wa-blur-image {
            filter: blur(30px) !important;
            background-color: rgba(0, 0, 0, 0.3) !important;
        }
        /* Override any inline styles */
        .wa-blur-target[style] {
            filter: blur(25px) !important;
            background-color: rgba(0, 0, 0, 0.3) !important;
        }
        .wa-blur-image[style] {
            filter: blur(30px) !important;
            background-color: rgba(0, 0, 0, 0.3) !important;
        }
    `;
}

function generatePixelatedBlurCSS() {
    return `
        .wa-blur-target {
            filter: blur(0px) !important;
            image-rendering: pixelated !important;
            image-rendering: -moz-crisp-edges !important;
            image-rendering: crisp-edges !important;
            pointer-events: none !important;
            transition: none !important;
            background-color: rgba(128, 128, 128, 0.8) !important;
            border-radius: 4px !important;
            position: relative !important;
            overflow: hidden !important;
            transform: scale(0.1) !important;
            transform-origin: center !important;
        }
        .wa-blur-image {
            filter: blur(0px) !important;
            image-rendering: pixelated !important;
            image-rendering: -moz-crisp-edges !important;
            image-rendering: crisp-edges !important;
            pointer-events: none !important;
            transition: none !important;
            background-color: rgba(128, 128, 128, 0.8) !important;
            border-radius: 4px !important;
            position: relative !important;
            overflow: hidden !important;
            transform: scale(0.1) !important;
            transform-origin: center !important;
        }
        .wa-blur-target::before {
            content: "🔲 PIXELATED" !important;
            position: absolute !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            background: rgba(128, 128, 128, 0.9) !important;
            color: white !important;
            padding: 4px 8px !important;
            border-radius: 4px !important;
            font-size: 12px !important;
            font-weight: bold !important;
            z-index: 99999 !important;
            pointer-events: none !important;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3) !important;
        }
        .wa-blur-image::after {
            content: "🔲" !important;
            position: absolute !important;
            top: 5px !important;
            right: 5px !important;
            background: rgba(128, 128, 128, 0.9) !important;
            color: white !important;
            padding: 3px 6px !important;
            border-radius: 4px !important;
            font-size: 14px !important;
            z-index: 99999 !important;
            pointer-events: none !important;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3) !important;
        }
    `;
}

function generateBlackoutBlurCSS() {
    return `
        .wa-blur-target {
            filter: none !important;
            pointer-events: none !important;
            transition: none !important;
            background-color: rgba(0, 0, 0, 1) !important;
            color: transparent !important;
            border-radius: 4px !important;
            position: relative !important;
            overflow: hidden !important;
        }
        .wa-blur-image {
            filter: none !important;
            pointer-events: none !important;
            transition: none !important;
            background-color: rgba(0, 0, 0, 1) !important;
            border-radius: 4px !important;
            position: relative !important;
            overflow: hidden !important;
        }
        .wa-blur-target::before {
            content: "⬛ BLACKED OUT" !important;
            position: absolute !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            background: rgba(0, 0, 0, 0.9) !important;
            color: white !important;
            padding: 4px 8px !important;
            border-radius: 4px !important;
            font-size: 12px !important;
            font-weight: bold !important;
            z-index: 99999 !important;
            pointer-events: none !important;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3) !important;
        }
        .wa-blur-image::after {
            content: "⬛" !important;
            position: absolute !important;
            top: 5px !important;
            right: 5px !important;
            background: rgba(0, 0, 0, 0.9) !important;
            color: white !important;
            padding: 3px 6px !important;
            border-radius: 4px !important;
            font-size: 14px !important;
            z-index: 99999 !important;
            pointer-events: none !important;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3) !important;
        }
    `;
}

function generateInvisibleBlurCSS() {
    return `
        .wa-blur-target {
            filter: none !important;
            pointer-events: none !important;
            transition: none !important;
            background-color: transparent !important;
            color: transparent !important;
            border-radius: 4px !important;
            position: relative !important;
            overflow: hidden !important;
            opacity: 0 !important;
        }
        .wa-blur-image {
            filter: none !important;
            pointer-events: none !important;
            transition: none !important;
            background-color: transparent !important;
            border-radius: 4px !important;
            position: relative !important;
            overflow: hidden !important;
            opacity: 0 !important;
        }
        .wa-blur-target::before {
            content: "👻 INVISIBLE" !important;
            position: absolute !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            background: rgba(128, 128, 128, 0.9) !important;
            color: white !important;
            padding: 4px 8px !important;
            border-radius: 4px !important;
            font-size: 12px !important;
            font-weight: bold !important;
            z-index: 99999 !important;
            pointer-events: none !important;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3) !important;
            opacity: 1 !important;
        }
        .wa-blur-image::after {
            content: "👻" !important;
            position: absolute !important;
            top: 5px !important;
            right: 5px !important;
            background: rgba(128, 128, 128, 0.9) !important;
            color: white !important;
            padding: 3px 6px !important;
            border-radius: 4px !important;
            font-size: 14px !important;
            z-index: 99999 !important;
            pointer-events: none !important;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3) !important;
            opacity: 1 !important;
        }
    `;
}

function generateCustomBlurCSS(blurTypeSettings) {
    const intensity = blurTypeSettings.intensity || 25;
    const color = blurTypeSettings.color || '#ff0000';
    const opacity = blurTypeSettings.opacity || 0.8;

    // Convert hex color to rgba
    const hexToRgba = (hex, alpha) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const backgroundColor = hexToRgba(color, opacity);
    const overlayColor = hexToRgba(color, Math.min(opacity + 0.1, 1));

    return `
        .wa-blur-target {
            filter: blur(${intensity}px) !important;
            pointer-events: none !important;
            transition: none !important;
            background-color: ${backgroundColor} !important;
            border-radius: 4px !important;
            position: relative !important;
            overflow: hidden !important;
            transform: scale(1.05) !important;
        }
        .wa-blur-image {
            filter: blur(${intensity + 5}px) !important;
            pointer-events: none !important;
            transition: none !important;
            background-color: ${backgroundColor} !important;
            border-radius: 4px !important;
            position: relative !important;
            overflow: hidden !important;
            transform: scale(1.05) !important;
        }
        .wa-blur-target::before {
            content: "🎨 CUSTOM BLUR" !important;
            position: absolute !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            background: ${overlayColor} !important;
            color: white !important;
            padding: 4px 8px !important;
            border-radius: 4px !important;
            font-size: 12px !important;
            font-weight: bold !important;
            z-index: 99999 !important;
            pointer-events: none !important;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3) !important;
        }
        .wa-blur-image::after {
            content: "🎨" !important;
            position: absolute !important;
            top: 5px !important;
            right: 5px !important;
            background: ${overlayColor} !important;
            color: white !important;
            padding: 3px 6px !important;
            border-radius: 4px !important;
            font-size: 14px !important;
            z-index: 99999 !important;
            pointer-events: none !important;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3) !important;
        }
    `;
}

// Clear all blur classes
function clearAllBlurClasses() {
    document.querySelectorAll('.wa-blur-target, .wa-blur-image').forEach((el) => {
        el.classList.remove('wa-blur-target', 'wa-blur-image');
    });
}

// Check if we're currently in the target chat
function isInTargetChat(contactName) {
    if (!contactName) return false;

    const normalize = (s) =>
        (s || '')
            .normalize('NFD')
            .replace(/\p{Diacritic}+/gu, '')
            .replace(/[\u200B-\u200D\uFEFF]/g, '') // zero-width chars
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    const target = normalize(contactName);

    // Candidate 1: Header area (primary source of truth)
    const header = document.querySelector('[data-testid="conversation-header"], header');
    if (header) {
        // Prefer a strict title attribute match
        const headerTitleSpans = header.querySelectorAll('span[title], div[title]');
        for (let span of headerTitleSpans) {
            const t = span.getAttribute('title');
            if (t && normalize(t) === target) return true;
        }
        // Fallback to exact visible text in header (normalized)
        const headerTextEls = header.querySelectorAll('h1, h2, span, div');
        for (let el of headerTextEls) {
            const text = normalize(el.textContent);
            if (text && text === target) return true;
        }
    }

    // Candidate 2: Selected item in the chat list (left pane)
    const selectedCandidates = [
        '[aria-selected="true"]',
        '[role="row"][aria-selected="true"]',
        'div[aria-selected="true"]',
        '[data-testid="cell-frame-container"][aria-selected="true"]'
    ];
    for (let sel of selectedCandidates) {
        const selected = document.querySelector(sel);
        if (selected) {
            const titleEl = selected.querySelector('span[title]');
            if (titleEl && normalize(titleEl.getAttribute('title')) === target) return true;
            const textEl = selected.querySelector('h1, h2, span, div');
            if (textEl && normalize(textEl.textContent) === target) return true;
        }
    }

    // If no strong signal, consider not in target chat
    return false;
}

// Debounced blur function to prevent excessive calls
let blurTimeout;
function debouncedBlur() {
    if (!currentSettings) return;

    clearTimeout(blurTimeout);
    blurTimeout = setTimeout(() => {
        blurContact(currentSettings.contactName, currentSettings.blurSettings);
    }, 200);
}

// Setup mutation observer
function setupBlurObserver() {
    if (blurObserver) {
        blurObserver.disconnect();
    }

    blurObserver = new MutationObserver((mutations) => {
        const hasSignificantChanges = mutations.some((mutation) => {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                for (let node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check if any managed users' content was added
                        for (let [userName, userData] of managedUsers) {
                            if (userData.isBlurred && node.textContent && node.textContent.includes(userName)) {
                                return true;
                            }
                        }

                        // Check for images
                        const hasImages = node.querySelector && node.querySelector('img');
                        if (hasImages) {
                            return true;
                        }
                    }
                }
            }
            return false;
        });

        if (hasSignificantChanges) {
            // Re-apply blur for all managed users
            for (let [userName, userData] of managedUsers) {
                if (userData.isBlurred) {
                    blurContact(userName, userData.blurSettings, userData.blurTypeSettings);
                }
            }
        }
    });

    blurObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false
    });
}

function applyBlur(contactName, blurSettings, blurTypeSettings = { type: 'standard' }) {
    if (!contactName) {
        console.error('No contact name provided');
        return;
    }

    currentSettings = { contactName, blurSettings, blurTypeSettings };
    managedUsers.set(contactName, {
        name: contactName,
        isBlurred: true,
        blurSettings: blurSettings,
        blurTypeSettings: blurTypeSettings
    });

    setupBlurObserver();
    blurContact(contactName, blurSettings, blurTypeSettings);
    isBlurEnabled = true;

    console.log('Blur applied for:', contactName, 'with type:', blurTypeSettings.type);
}

function toggleBlur() {
    const style = document.getElementById('wa-blur-style');
    if (style) {
        style.remove();
        clearAllBlurClasses();
        lastBlurredElements.clear();
        currentChatContext = null;
        isBlurEnabled = false;
        console.log('Blur disabled');
    } else {
        if (currentSettings) {
            addBlurStyles(currentSettings.blurTypeSettings);
            blurContact(currentSettings.contactName, currentSettings.blurSettings, currentSettings.blurTypeSettings);
            isBlurEnabled = true;
            console.log('Blur enabled');
        } else {
            console.error('No blur settings available');
        }
    }
}

function clearBlur() {
    clearAllBlurClasses();
    lastBlurredElements.clear();
    currentChatContext = null;
    isBlurEnabled = false;
    currentSettings = null;

    if (blurObserver) {
        blurObserver.disconnect();
        blurObserver = null;
    }

    console.log('Blur cleared');
}

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

// Scan for users currently visible on the page
function scanForUsers() {
    const users = [];
    const seenNames = new Set();

    // Function to check if an element should be excluded from user scanning
    function shouldExcludeFromScan(element) {
        const navigationIdentifiers = [
            'chat-filled-refreshed',
            'chat-filled-refreshed1',
            'status-refreshed',
            'newsletter-outline',
            'community-refreshed-32',
            'settings-refreshed'
        ];

        // Exclude navigation elements by data-testid
        const testId = element.getAttribute('data-testid');
        if (testId && navigationIdentifiers.includes(testId)) {
            return true;
        }

        // Exclude navigation elements by title attribute
        const title = element.getAttribute('title');
        if (title && navigationIdentifiers.includes(title.trim())) {
            return true;
        }

        // Exclude navigation elements by class names that might contain these identifiers
        const className = element.className;
        if (className && typeof className === 'string') {
            for (let identifier of navigationIdentifiers) {
                if (className.includes(identifier)) {
                    return true;
                }
            }
        }

        // Exclude navigation elements by text content
        const textContent = element.textContent && element.textContent.trim();
        if (textContent && navigationIdentifiers.includes(textContent)) {
            return true;
        }

        // Exclude elements that are likely navigation buttons/icons
        if (element.tagName === 'BUTTON' || element.tagName === 'A') {
            // Check if it's in a navigation area
            const navParent = element.closest('nav, [role="navigation"], [data-testid*="nav"]');
            if (navParent) {
                return true;
            }
        }

        // Exclude single character text content (likely navigation icons)
        if (textContent && textContent.length === 1) {
            return true;
        }

        return false;
    }

    // Look for user names in chat list
    const chatSpans = document.querySelectorAll('span[title]');
    chatSpans.forEach((span) => {
        const title = span.getAttribute('title');
        if (title && title.trim() && !seenNames.has(title.trim()) && !shouldExcludeFromScan(span)) {
            // Exclude navigation elements by their title attribute
            const excludedTitles = [
                'chat-filled-refreshed',
                'chat-filled-refreshed1',
                'status-refreshed',
                'newsletter-outline',
                'community-refreshed-32',
                'settings-refreshed'
            ];

            if (excludedTitles.includes(title.trim())) {
                return; // Skip this element
            }

            // Check if this looks like a contact name (not a message preview)
            const parent = span.closest('div[role="listitem"]') || span.closest('div[tabindex]');
            if (parent) {
                // Check if this span is likely a name (not a message)
                const textContent = span.textContent.trim();
                if (textContent === title && textContent.length > 0 && textContent.length < 50) {
                    users.push({
                        name: title.trim(),
                        isBlurred: false
                    });
                    seenNames.add(title.trim());
                }
            }
        }
    });

    // Also look for names in the current chat header
    const header = document.querySelector('header');
    if (header) {
        const headerElements = header.querySelectorAll('*');
        headerElements.forEach((el) => {
            const text = el.textContent && el.textContent.trim();
            if (text && text.length > 0 && text.length < 50 && !seenNames.has(text) && !shouldExcludeFromScan(el)) {
                // Exclude navigation elements by their text content
                const excludedTexts = [
                    'chat-filled-refreshed',
                    'chat-filled-refreshed1',
                    'status-refreshed',
                    'newsletter-outline',
                    'community-refreshed-32',
                    'settings-refreshed'
                ];

                if (excludedTexts.includes(text)) {
                    return; // Skip this element
                }

                // Check if this looks like a contact name
                if (!text.includes(' ') || text.split(' ').length <= 3) {
                    users.push({
                        name: text,
                        isBlurred: false
                    });
                    seenNames.add(text);
                }
            }
        });
    }

    console.log('Scanned users:', users);
    return users;
}

// Toggle blur for a specific user
function toggleUserBlur(userName, isBlurred, blurSettings = null, blurTypeSettings = null) {
    console.log('toggleUserBlur called with:', userName, isBlurred, blurSettings, blurTypeSettings);

    if (isBlurred) {
        console.log('Adding user to managed users:', userName);

        // Use provided settings or defaults
        const defaultBlurSettings = {
            chatListName: true,
            chatListMessage: true,
            chatListAvatar: true,
            headerName: true,
            headerAvatar: true,
            messageText: true,
            messageImages: true
        };

        const defaultBlurTypeSettings = { type: 'standard' };

        managedUsers.set(userName, {
            name: userName,
            isBlurred: true,
            blurSettings: blurSettings || defaultBlurSettings,
            blurTypeSettings: blurTypeSettings || defaultBlurTypeSettings
        });

        // Ensure blur observer is set up
        if (!blurObserver) {
            setupBlurObserver();
        }

        blurContact(userName, managedUsers.get(userName).blurSettings, managedUsers.get(userName).blurTypeSettings);
        console.log('Applied blur for user:', userName);
    } else {
        console.log('Removing user from managed users:', userName);
        managedUsers.delete(userName);
        removeUserBlur(userName);
        console.log('Removed blur for user:', userName);
    }

    console.log('Current managed users:', Array.from(managedUsers.keys()));
}

// Remove blur for a specific user
function removeUserBlur(userName) {
    // First, remove any elements explicitly tagged for this user
    try {
        const escapeCSS = (s) => (window.CSS && CSS.escape ? CSS.escape(s) : s.replace(/["\\\]]/g, '\\$&'));
        const selector = `[data-wa-blur-user="${escapeCSS(userName)}"]`;
        const tagged = document.querySelectorAll(selector);
        tagged.forEach((el) => {
            el.classList.remove('wa-blur-target', 'wa-blur-image');
            if (el.style) {
                el.style.filter = '';
                el.style.backdropFilter = '';
                el.style.backgroundColor = '';
                el.style.borderRadius = '';
                el.style.transition = '';
            }
            try {
                delete el.dataset.waBlurUser;
                delete el.dataset.waBlurInline;
                delete el.dataset.waElegant;
            } catch (e) {}
        });
    } catch (e) {
        console.warn('removeUserBlur: selector failed', e);
    }

    // Remove blur classes for this specific user
    const chatSpans = document.querySelectorAll('span[title]');
    chatSpans.forEach((span) => {
        if (span.getAttribute('title') === userName) {
            span.classList.remove('wa-blur-target');
            // Clean inline styles applied by fallbacks
            if (span.dataset && (span.dataset.waBlurInline || span.dataset.waElegant)) {
                span.style.filter = '';
                span.style.backdropFilter = '';
                span.style.backgroundColor = '';
                span.style.borderRadius = '';
                span.style.transition = '';
                delete span.dataset.waBlurInline;
                delete span.dataset.waElegant;
            }
            // Also strip blur-related inline styles if present
            if (span.style && (span.style.filter?.includes('blur') || span.style.backdropFilter?.includes('blur'))) {
                span.style.filter = '';
                span.style.backdropFilter = '';
                span.style.backgroundColor = '';
            }

            // Also remove blur from associated elements
            const container = span.closest('div[role="listitem"]') || span.closest('div[tabindex]');
            if (container) {
                const img = container.querySelector('img');
                if (img) {
                    img.classList.remove('wa-blur-image');
                    if (img.dataset && (img.dataset.waBlurInline || img.dataset.waElegant)) {
                        img.style.filter = '';
                        img.style.backdropFilter = '';
                        img.style.backgroundColor = '';
                        img.style.borderRadius = '';
                        img.style.transition = '';
                        delete img.dataset.waBlurInline;
                        delete img.dataset.waElegant;
                    }
                    if (
                        img.style &&
                        (img.style.filter?.includes('blur') || img.style.backdropFilter?.includes('blur'))
                    ) {
                        img.style.filter = '';
                        img.style.backdropFilter = '';
                        img.style.backgroundColor = '';
                    }
                }

                // Remove blur from message preview
                const allSpans = document.querySelectorAll('span[title]');
                const currentIndex = Array.from(allSpans).indexOf(span);
                if (currentIndex + 1 < allSpans.length) {
                    const nextSpan = allSpans[currentIndex + 1];
                    if (nextSpan) {
                        nextSpan.classList.remove('wa-blur-target');
                        if (nextSpan.dataset && (nextSpan.dataset.waBlurInline || nextSpan.dataset.waElegant)) {
                            nextSpan.style.filter = '';
                            nextSpan.style.backdropFilter = '';
                            nextSpan.style.backgroundColor = '';
                            nextSpan.style.borderRadius = '';
                            nextSpan.style.transition = '';
                            delete nextSpan.dataset.waBlurInline;
                            delete nextSpan.dataset.waElegant;
                        }
                        if (
                            nextSpan.style &&
                            (nextSpan.style.filter?.includes('blur') || nextSpan.style.backdropFilter?.includes('blur'))
                        ) {
                            nextSpan.style.filter = '';
                            nextSpan.style.backdropFilter = '';
                            nextSpan.style.backgroundColor = '';
                        }
                    }
                }
            }
        }
    });

    // Decide if current open chat matches the user (robust detection)
    const headerRoot = document.querySelector('[data-testid="conversation-header"], header');
    const norm = (s) =>
        (s || '')
            .normalize('NFD')
            .replace(/\p{Diacritic}+/gu, '')
            .replace(/[\u200B-\u200D\uFEFF]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    let inTarget = false;
    if (isInTargetChat(userName)) {
        inTarget = true;
    } else if (headerRoot) {
        const target = norm(userName);
        // Try to extract displayed chat name
        const candidates = headerRoot.querySelectorAll('span[title], div[title], h1, h2, span, div');
        for (let el of candidates) {
            const ht = el.getAttribute && el.getAttribute('title');
            const text = norm(ht || el.textContent);
            if (text && (text === target || text.includes(target) || target.includes(text))) {
                inTarget = true;
                break;
            }
        }
    }

    if (inTarget) {
        // Clean header
        if (headerRoot) {
            const headerTargets = headerRoot.querySelectorAll('.wa-blur-target');
            headerTargets.forEach((el) => {
                el.classList.remove('wa-blur-target');
                if (el.dataset && (el.dataset.waBlurInline || el.dataset.waElegant)) {
                    el.style.filter = '';
                    el.style.backdropFilter = '';
                    el.style.backgroundColor = '';
                    el.style.borderRadius = '';
                    el.style.transition = '';
                    delete el.dataset.waBlurInline;
                    delete el.dataset.waElegant;
                }
                if (el.style && (el.style.filter?.includes('blur') || el.style.backdropFilter?.includes('blur'))) {
                    el.style.filter = '';
                    el.style.backdropFilter = '';
                    el.style.backgroundColor = '';
                }
            });
            const headerImgs = headerRoot.querySelectorAll('img');
            headerImgs.forEach((img) => {
                img.classList.remove('wa-blur-image');
                if (img.dataset && (img.dataset.waBlurInline || img.dataset.waElegant)) {
                    img.style.filter = '';
                    img.style.backdropFilter = '';
                    img.style.backgroundColor = '';
                    img.style.borderRadius = '';
                    img.style.transition = '';
                    delete img.dataset.waBlurInline;
                    delete img.dataset.waElegant;
                }
                if (img.style && (img.style.filter?.includes('blur') || img.style.backdropFilter?.includes('blur'))) {
                    img.style.filter = '';
                    img.style.backdropFilter = '';
                    img.style.backgroundColor = '';
                }
            });
        }

        // Clean message area (targeted selectors)
        const messageArea =
            document.querySelector('[data-testid="conversation-panel-messages"]') ||
            document.querySelector('.message-list') ||
            document.querySelector('[role="log"]');
        if (messageArea) {
            const textTargets = messageArea.querySelectorAll('.wa-blur-target');
            textTargets.forEach((el) => {
                el.classList.remove('wa-blur-target');
                if (el.dataset && (el.dataset.waBlurInline || el.dataset.waElegant)) {
                    el.style.filter = '';
                    el.style.backdropFilter = '';
                    el.style.backgroundColor = '';
                    el.style.borderRadius = '';
                    el.style.transition = '';
                    delete el.dataset.waBlurInline;
                    delete el.dataset.waElegant;
                }
                if (el.style && (el.style.filter?.includes('blur') || el.style.backdropFilter?.includes('blur'))) {
                    el.style.filter = '';
                    el.style.backdropFilter = '';
                    el.style.backgroundColor = '';
                }
            });

            const imgTargets = messageArea.querySelectorAll('.wa-blur-image, img');
            imgTargets.forEach((img) => {
                img.classList.remove('wa-blur-image');
                if (img.dataset && (img.dataset.waBlurInline || img.dataset.waElegant)) {
                    img.style.filter = '';
                    img.style.backdropFilter = '';
                    img.style.backgroundColor = '';
                    img.style.borderRadius = '';
                    img.style.transition = '';
                    delete img.dataset.waBlurInline;
                    delete img.dataset.waElegant;
                }
                if (img.style && (img.style.filter?.includes('blur') || img.style.backdropFilter?.includes('blur'))) {
                    img.style.filter = '';
                    img.style.backdropFilter = '';
                    img.style.backgroundColor = '';
                }
            });

            const overlays = messageArea.querySelectorAll('.wa-blur-overlay');
            overlays.forEach((ov) => ov.remove());
        }
    }

    console.log('Removed blur for user:', userName);
}

// Blur all users at once
function blurAllUsers(users) {
    console.log('🔒 blurAllUsers called with:', users);
    const startTime = performance.now();

    if (!users || users.length === 0) {
        console.warn('⚠️ No users provided to blur');
        return;
    }

    console.log(`📊 Processing ${users.length} users for blur operation`);

    // Clear existing managed users
    const previousUserCount = managedUsers.size;
    managedUsers.clear();
    console.log(`🧹 Cleared ${previousUserCount} previously managed users`);

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    // Add all users to managed users and apply blur
    users.forEach((user, index) => {
        try {
            console.log(`👤 Processing user ${index + 1}/${users.length}: "${user.name}"`);

            if (user.isBlurred) {
                const userSettings = {
                    name: user.name,
                    isBlurred: true,
                    blurSettings: {
                        chatListName: true,
                        chatListMessage: true,
                        chatListAvatar: true,
                        headerName: true,
                        headerAvatar: true,
                        messageText: true,
                        messageImages: true
                    },
                    blurTypeSettings: { type: 'standard' }
                };

                managedUsers.set(user.name, userSettings);
                console.log(`✅ Added user "${user.name}" to managed users`);

                // Apply blur for this user
                const blurStartTime = performance.now();
                blurContact(user.name, userSettings.blurSettings, userSettings.blurTypeSettings);
                const blurEndTime = performance.now();

                console.log(`🎯 Applied blur to user "${user.name}" in ${(blurEndTime - blurStartTime).toFixed(2)}ms`);
                successCount++;
            } else {
                console.log(`⏭️ Skipping user "${user.name}" - not marked for blur`);
            }
        } catch (error) {
            console.error(`❌ Error processing user "${user.name}":`, error);
            errors.push({ user: user.name, error: error.message });
            errorCount++;
        }
    });

    // Ensure blur observer is set up
    if (!blurObserver) {
        console.log('👁️ Setting up blur observer for dynamic content');
        setupBlurObserver();
    } else {
        console.log('👁️ Blur observer already active');
    }

    const endTime = performance.now();
    const totalTime = (endTime - startTime).toFixed(2);

    console.log(`🏁 Blur all operation completed in ${totalTime}ms`);
    console.log(`📈 Results: ${successCount} successful, ${errorCount} errors`);
    console.log(`👥 Final managed users:`, Array.from(managedUsers.keys()));

    if (errors.length > 0) {
        console.error('🚨 Errors encountered:', errors);
    }

    // Log current page state for debugging
    const chatSpans = document.querySelectorAll('span[title]');
    const header = document.querySelector('header');
    const messageArea =
        document.querySelector('[data-testid="conversation-panel-messages"]') ||
        document.querySelector('.message-list') ||
        document.querySelector('[role="log"]');

    console.log('🔍 Page state after blur operation:');
    console.log(`  - Chat spans found: ${chatSpans.length}`);
    console.log(`  - Header present: ${!!header}`);
    console.log(`  - Message area present: ${!!messageArea}`);
    console.log(`  - Blurred elements: ${document.querySelectorAll('.wa-blur-target, .wa-blur-image').length}`);

    // NOTE: Avoid applying global inline blur here to prevent side-effects.
    // The per-user CSS classes handle the blur; no extra inline styling needed.

    return {
        success: successCount,
        errors: errorCount,
        totalProcessed: users.length,
        managedUsersCount: managedUsers.size,
        blurredElementsCount: document.querySelectorAll('.wa-blur-target, .wa-blur-image').length,
        processingTime: totalTime,
        errorDetails: errors
    };
}

// Unblur all users at once
function unblurAllUsers(users) {
    console.log(
        '🔓 Unblurring all users:',
        users?.map((u) => u.name)
    );

    // Clear all managed users
    managedUsers.clear();

    // Comprehensive unblur - remove all blur styles from the page
    removeAllBlurStyles();

    console.log('✅ All blur removed from page');
}

// Comprehensive function to remove ALL blur styles
function removeAllBlurStyles() {
    console.log('🧹 Removing all blur styles from page...');

    // Remove all CSS classes
    const blurredElements = document.querySelectorAll('.wa-blur-target, .wa-blur-image');
    console.log(`📊 Found ${blurredElements.length} elements with blur classes`);

    blurredElements.forEach((el, index) => {
        console.log(`🔓 Removing blur from element ${index + 1}`);
        el.classList.remove('wa-blur-target', 'wa-blur-image');
    });

    // Remove ALL inline blur styles from the entire page
    const allElements = document.querySelectorAll('*');
    let inlineStylesRemoved = 0;

    allElements.forEach((el) => {
        if (el.style.filter && el.style.filter.includes('blur')) {
            console.log(`🧹 Removing inline blur from: ${el.tagName}`);

            // Remove blur-related styles
            el.style.filter = '';
            el.style.backdropFilter = '';
            el.style.backgroundColor = '';
            el.style.border = '';
            el.style.borderRadius = '';
            el.style.boxShadow = '';

            // Restore original content if it was saved
            if (el.dataset.originalContent) {
                el.innerHTML = el.dataset.originalContent;
                delete el.dataset.originalContent;
            }

            // Remove any blur overlays
            const overlay = el.querySelector('.wa-blur-overlay');
            if (overlay) {
                overlay.remove();
            }

            inlineStylesRemoved++;
        }
    });

    // Remove any remaining overlays
    const overlays = document.querySelectorAll('.wa-blur-overlay');
    overlays.forEach((overlay) => overlay.remove());

    // Remove any success/test messages
    const testElements = document.querySelectorAll('#wa-blur-test');
    testElements.forEach((el) => el.remove());

    console.log(`🧹 Removed inline styles from ${inlineStylesRemoved} elements`);
    console.log(`🧹 Removed ${overlays.length} overlay elements`);

    // Show success message
    const successDiv = document.createElement('div');
    successDiv.style.cssText = `
        position: fixed !important;
        top: 20px !important;
        right: 20px !important;
        background: rgba(76, 175, 80, 0.9) !important;
        color: white !important;
        padding: 12px 16px !important;
        border-radius: 8px !important;
        font-size: 14px !important;
        font-weight: 500 !important;
        z-index: 999999 !important;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
    `;
    successDiv.innerHTML = `🔓 All blur removed successfully!`;

    document.body.appendChild(successDiv);

    setTimeout(() => {
        successDiv.remove();
    }, 3000);
}

// Clear all users
function clearAllUsers() {
    console.log('🧹 Clearing all users and blur styles...');

    managedUsers.clear();
    clearAllBlurClasses();
    lastBlurredElements.clear();
    currentChatContext = null;

    // Also remove all inline styles (same as unblur all)
    removeAllBlurStyles();

    console.log('✅ All users and blur styles cleared');
}

// Enhanced blur function that works with multiple users
function blurContact(contactName, blurSettings, blurTypeSettings = { type: 'standard' }) {
    if (!contactName) {
        console.warn('⚠️ blurContact called without contactName:', { contactName, blurSettings, blurTypeSettings });
        return;
    }

    if (!blurSettings || typeof blurSettings !== 'object') {
        console.warn('⚠️ blurContact called with invalid blurSettings:', {
            contactName,
            blurSettings,
            blurTypeSettings,
            type: typeof blurSettings
        });
        return;
    }

    console.log('✅ blurContact called with valid parameters:', { contactName, blurSettings, blurTypeSettings });

    console.log(`🎯 Starting blur operation for "${contactName}" with blur type: ${blurTypeSettings.type}`);
    const blurStartTime = performance.now();

    // Add styles with the specified blur type
    addBlurStyles(blurTypeSettings);

    // Track chat context without clearing existing blur from other users
    const newChatContext = isInTargetChat(contactName);
    if (currentChatContext !== newChatContext) {
        console.log('🔄 Chat context changed (non-destructive):', { from: currentChatContext, to: newChatContext });
        currentChatContext = newChatContext;
        // Do NOT clear global blur classes here — multiple users can be active.
    }

    let elementsBlurred = {
        chatListName: 0,
        chatListMessage: 0,
        chatListAvatar: 0,
        headerName: 0,
        headerAvatar: 0,
        messageText: 0,
        messageImages: 0
    };

    // Function to check if an element should be excluded from blurring
    function shouldExcludeElement(element) {
        // Exclude navigation elements by data-testid
        const testId = element.getAttribute('data-testid');
        if (testId) {
            const excludedTestIds = [
                'chat-filled-refreshed',
                'status-refreshed',
                'newsletter-outline',
                'community-refreshed-32',
                'settings-refreshed'
            ];
            if (excludedTestIds.includes(testId)) {
                return true;
            }
        }

        // Exclude navigation elements by class names that might contain these identifiers
        const className = element.className;
        if (className && typeof className === 'string') {
            const excludedClasses = [
                'chat-filled-refreshed',
                'status-refreshed',
                'newsletter-outline',
                'community-refreshed-32',
                'settings-refreshed'
            ];

            for (let excludedClass of excludedClasses) {
                if (className.includes(excludedClass)) {
                    return true;
                }
            }
        }

        // Exclude elements that are likely navigation buttons/icons
        if (element.tagName === 'BUTTON' || element.tagName === 'A') {
            // Check if it's in a navigation area
            const navParent = element.closest('nav, [role="navigation"], [data-testid*="nav"]');
            if (navParent) {
                return true;
            }
        }

        return false;
    }

    // 1. Always blur chat list items
    if (blurSettings.chatListName || blurSettings.chatListMessage || blurSettings.chatListAvatar) {
        console.log(`📋 Processing chat list for "${contactName}"`);
        const chatSpans = document.querySelectorAll('span[title]');
        console.log(`🔍 Found ${chatSpans.length} chat spans to check`);

        chatSpans.forEach((span, index) => {
            if (span.getAttribute('title') === contactName && !shouldExcludeElement(span)) {
                console.log(`✅ Found matching span for "${contactName}" at index ${index}`);

                if (blurSettings.chatListName && !span.classList.contains('wa-blur-target')) {
                    span.classList.add('wa-blur-target');
                    try {
                        span.dataset.waBlurUser = contactName;
                    } catch (e) {}
                    lastBlurredElements.add(span);
                    elementsBlurred.chatListName++;
                    console.log(`🎯 Blurred chat list name for "${contactName}"`);
                    console.log(`🔍 Element classes after blur:`, span.className);
                    console.log(`🔍 Element computed style:`, window.getComputedStyle(span).filter);
                }

                // Find and blur message preview
                if (blurSettings.chatListMessage) {
                    const allSpans = document.querySelectorAll('span[title]');
                    const currentIndex = Array.from(allSpans).indexOf(span);
                    if (currentIndex + 1 < allSpans.length) {
                        const nextSpan = allSpans[currentIndex + 1];
                        if (
                            nextSpan &&
                            nextSpan.textContent &&
                            nextSpan.textContent.trim().length > 3 &&
                            !nextSpan.classList.contains('wa-blur-target') &&
                            !shouldExcludeElement(nextSpan)
                        ) {
                            nextSpan.classList.add('wa-blur-target');
                            try {
                                nextSpan.dataset.waBlurUser = contactName;
                            } catch (e) {}
                            lastBlurredElements.add(nextSpan);
                            elementsBlurred.chatListMessage++;
                            console.log(
                                `💬 Blurred message preview for "${contactName}": "${nextSpan.textContent.trim().substring(0, 50)}..."`
                            );
                        }
                    }
                }

                // Find and blur avatar
                if (blurSettings.chatListAvatar) {
                    const container = span.closest('div[role="listitem"]') || span.closest('div[tabindex]');
                    if (container) {
                        const img = container.querySelector('img');
                        if (img && !img.classList.contains('wa-blur-image') && !shouldExcludeElement(img)) {
                            img.classList.add('wa-blur-image');
                            try {
                                img.dataset.waBlurUser = contactName;
                            } catch (e) {}
                            lastBlurredElements.add(img);
                            elementsBlurred.chatListAvatar++;
                            console.log(`🖼️ Blurred avatar for "${contactName}"`);
                        }
                    }
                }
            }
        });

        console.log(`📊 Chat list blur results for "${contactName}":`, {
            names: elementsBlurred.chatListName,
            messages: elementsBlurred.chatListMessage,
            avatars: elementsBlurred.chatListAvatar
        });
    }

    // 2. Only blur header and messages if we're actually in the target chat
    if (isInTargetChat(contactName)) {
        console.log(`🏠 In target chat for "${contactName}", processing header and messages`);
        const header = document.querySelector('header');
        if (header) {
            console.log(`📋 Processing header for "${contactName}"`);

            // Find and blur header name
            if (blurSettings.headerName) {
                const allElements = header.querySelectorAll('*');
                console.log(`🔍 Checking ${allElements.length} header elements for name match`);
                allElements.forEach((el) => {
                    if (
                        el.textContent &&
                        el.textContent.trim() === contactName &&
                        !el.classList.contains('wa-blur-target') &&
                        !shouldExcludeElement(el)
                    ) {
                        el.classList.add('wa-blur-target');
                        try {
                            el.dataset.waBlurUser = contactName;
                        } catch (e) {}
                        lastBlurredElements.add(el);
                        elementsBlurred.headerName++;
                        console.log(`🎯 Blurred header name for "${contactName}"`);
                    }
                });
            }

            // Blur header avatar
            if (blurSettings.headerAvatar) {
                const headerImgs = header.querySelectorAll('img');
                console.log(`🖼️ Found ${headerImgs.length} header images to check`);
                headerImgs.forEach((img) => {
                    if (!img.classList.contains('wa-blur-image') && !shouldExcludeElement(img)) {
                        img.classList.add('wa-blur-image');
                        try {
                            img.dataset.waBlurUser = contactName;
                        } catch (e) {}
                        lastBlurredElements.add(img);
                        elementsBlurred.headerAvatar++;
                        console.log(`🎯 Blurred header avatar for "${contactName}"`);
                    }
                });
            }
        } else {
            console.log(`⚠️ No header found for "${contactName}"`);
        }

        // Blur messages
        if (blurSettings.messageText || blurSettings.messageImages) {
            console.log(`💬 Processing messages for "${contactName}"`);
            const messageArea =
                document.querySelector('[data-testid="conversation-panel-messages"]') ||
                document.querySelector('.message-list') ||
                document.querySelector('[role="log"]') ||
                document.querySelector('div[data-testid*="message"]');

            if (messageArea) {
                console.log(`📱 Found message area, processing messages`);

                if (blurSettings.messageText) {
                    const allElements = messageArea.querySelectorAll('*');
                    console.log(`🔍 Checking ${allElements.length} message elements for text blur`);
                    allElements.forEach((el) => {
                        if (
                            el.textContent &&
                            el.textContent.trim().length > 3 &&
                            !el.classList.contains('wa-blur-target') &&
                            !shouldExcludeElement(el)
                        ) {
                            const text = el.textContent.trim();
                            if (
                                text.includes(' ') ||
                                text.includes('?') ||
                                text.includes('!') ||
                                text.includes('.') ||
                                text.includes(',') ||
                                /[a-z]/.test(text)
                            ) {
                                el.classList.add('wa-blur-target');
                                try {
                                    el.dataset.waBlurUser = contactName;
                                } catch (e) {}
                                lastBlurredElements.add(el);
                                elementsBlurred.messageText++;
                            }
                        }
                    });
                    console.log(`📝 Blurred ${elementsBlurred.messageText} message text elements`);
                }

                if (blurSettings.messageImages) {
                    const imgs = messageArea.querySelectorAll('img');
                    console.log(`🖼️ Found ${imgs.length} message images to check`);
                    imgs.forEach((img) => {
                        if (!img.classList.contains('wa-blur-image') && !shouldExcludeElement(img)) {
                            img.classList.add('wa-blur-image');
                            try {
                                img.dataset.waBlurUser = contactName;
                            } catch (e) {}
                            lastBlurredElements.add(img);
                            elementsBlurred.messageImages++;
                        }
                    });
                    console.log(`📸 Blurred ${elementsBlurred.messageImages} message images`);
                }
            } else {
                console.log(`⚠️ No message area found, using fallback method`);
                // Fallback: blur all messages in the page
                const messages = document.querySelectorAll('.message-in, .message-out, [data-testid*="msg"]');
                console.log(`🔄 Fallback: Found ${messages.length} message containers`);
                messages.forEach((msg) => {
                    if (blurSettings.messageText) {
                        const textEls = msg.querySelectorAll('span, div');
                        textEls.forEach((el) => {
                            if (
                                el.textContent &&
                                el.textContent.trim().length > 3 &&
                                !el.classList.contains('wa-blur-target') &&
                                !shouldExcludeElement(el)
                            ) {
                                el.classList.add('wa-blur-target');
                                lastBlurredElements.add(el);
                                elementsBlurred.messageText++;
                            }
                        });
                    }
                    if (blurSettings.messageImages) {
                        const imgs = msg.querySelectorAll('img');
                        imgs.forEach((img) => {
                            if (!img.classList.contains('wa-blur-image') && !shouldExcludeElement(img)) {
                                img.classList.add('wa-blur-image');
                                lastBlurredElements.add(img);
                                elementsBlurred.messageImages++;
                            }
                        });
                    }
                });
                console.log(
                    `🔄 Fallback results: ${elementsBlurred.messageText} text, ${elementsBlurred.messageImages} images`
                );
            }
        }
    } else {
        console.log(`📋 Not in target chat for "${contactName}", skipping header and message blur`);
    }

    const blurEndTime = performance.now();
    const blurDuration = (blurEndTime - blurStartTime).toFixed(2);

    console.log(`✅ Blur operation completed for "${contactName}" in ${blurDuration}ms`);
    console.log(`📊 Elements blurred:`, elementsBlurred);
    console.log(`🎯 Total elements blurred: ${Object.values(elementsBlurred).reduce((sum, count) => sum + count, 0)}`);

    // Force style application and verify
    setTimeout(() => {
        const blurredElements = document.querySelectorAll('.wa-blur-target, .wa-blur-image');
        console.log(`🔍 Verification: Found ${blurredElements.length} blurred elements`);

        blurredElements.forEach((el, index) => {
            const computedStyle = window.getComputedStyle(el);
            console.log(`🔍 Element ${index + 1}:`, {
                tagName: el.tagName,
                classes: el.className,
                filter: computedStyle.filter,
                backgroundColor: computedStyle.backgroundColor,
                textContent: el.textContent ? el.textContent.substring(0, 50) + '...' : 'No text'
            });

            // Force style application if not working
            if (
                computedStyle.filter === 'none' ||
                !computedStyle.filter.includes('blur') ||
                computedStyle.filter.includes('blur(0px)')
            ) {
                console.log(`✨ Applying elegant fallback blur for element ${index + 1}`);

                // Apply elegant blur with style override
                el.style.cssText =
                    el.style.cssText +
                    `
                    filter: blur(10px) !important;
                    background-color: rgba(0, 0, 0, 0.1) !important;
                    backdrop-filter: blur(5px) !important;
                    border-radius: 4px !important;
                    transition: filter 0.3s ease !important;
                    position: relative !important;
                `;
                try {
                    el.dataset.waBlurInline = '1';
                } catch (e) {}
                // Ensure we keep the user association for precise unblur later
                if (!el.dataset.waBlurUser && currentSettings && currentSettings.contactName) {
                    try {
                        el.dataset.waBlurUser = currentSettings.contactName;
                    } catch (e) {}
                }

                console.log(`✅ Elegant fallback applied to element ${index + 1}`);

                // Force reflow
                el.offsetHeight;
            }
        });
    }, 200);
}

// Check for CSP and other potential issues
function checkForIssues() {
    console.log('🔍 Checking for potential issues...');

    // Check if styles are being blocked
    const styleElement = document.getElementById('wa-blur-style');
    if (styleElement) {
        console.log('✅ Style element exists');
        console.log('📝 Style content length:', styleElement.textContent.length);
    } else {
        console.log('❌ Style element not found');
    }

    // Check for CSP violations
    const originalConsoleError = console.error;
    console.error = function (...args) {
        if (args[0] && args[0].includes && args[0].includes('Content Security Policy')) {
            console.log('🚨 CSP violation detected:', args);
        }
        originalConsoleError.apply(console, args);
    };

    // Check if elements are being modified by WhatsApp
    const testSpan = document.querySelector('span[title]');
    if (testSpan) {
        console.log('🔍 Test span found:', {
            title: testSpan.getAttribute('title'),
            classes: testSpan.className,
            style: testSpan.style.cssText
        });
    }
}

// Run checks after a delay
setTimeout(checkForIssues, 1000);

// TEST: Create a visible test element to verify CSS is working
function createTestElement() {
    console.log('🧪 Creating test element to verify CSS blur');

    // Remove any existing test element
    const existingTest = document.getElementById('wa-blur-test');
    if (existingTest) {
        existingTest.remove();
    }

    // Create a test element
    const testDiv = document.createElement('div');
    testDiv.id = 'wa-blur-test';
    testDiv.style.cssText = `
        position: fixed !important;
        top: 10px !important;
        right: 10px !important;
        width: 200px !important;
        height: 50px !important;
        background: red !important;
        color: white !important;
        z-index: 999999 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 16px !important;
        font-weight: bold !important;
        border: 2px solid yellow !important;
    `;
    testDiv.textContent = 'TEST ELEMENT - NO BLUR';

    document.body.appendChild(testDiv);
    console.log('✅ Test element created (no blur)');

    // After 2 seconds, add blur
    setTimeout(() => {
        console.log('🔄 Adding blur to test element...');
        testDiv.style.filter = 'blur(10px) !important';
        testDiv.textContent = 'TEST ELEMENT - WITH BLUR';
        console.log('✅ Blur added to test element');

        // Check if blur was applied
        setTimeout(() => {
            const computedStyle = window.getComputedStyle(testDiv);
            console.log('🔍 Test element computed filter:', computedStyle.filter);

            if (computedStyle.filter.includes('blur')) {
                console.log('✅ CSS blur is working!');
            } else {
                console.log('❌ CSS blur is NOT working!');
            }
        }, 500);
    }, 2000);
}

// Test removed - elegant blur implemented

// ELEGANT BLUR: Apply subtle but effective blur
function applyElegantBlur() {
    console.log('✨ Applying elegant blur to all visible elements');

    // Remove test elements
    const testElement = document.getElementById('wa-blur-test');
    if (testElement) {
        testElement.remove();
    }

    // Find all spans with names (more precisely)
    const nameSpans = document.querySelectorAll('span[title]');
    let blurCount = 0;

    nameSpans.forEach((span, index) => {
        if (span.textContent && span.textContent.trim().length > 0) {
            console.log(`✨ Elegantly blurring: "${span.textContent.substring(0, 30)}..."`);

            // Apply elegant blur
            span.style.cssText = `
                filter: blur(8px) !important;
                background-color: rgba(0, 0, 0, 0.1) !important;
                backdrop-filter: blur(4px) !important;
                border-radius: 4px !important;
                transition: filter 0.3s ease !important;
                position: relative !important;
            `;
            try {
                span.dataset.waElegant = '1';
            } catch (e) {}

            blurCount++;
        }
    });

    // Apply elegant blur to images
    const chatImages = document.querySelectorAll('img[src*="blob"], img[src*="cdn.whatsapp"]');
    chatImages.forEach((img, index) => {
        console.log(`✨ Elegantly blurring image ${index}`);
        img.style.cssText = `
            filter: blur(12px) !important;
            backdrop-filter: blur(6px) !important;
            border-radius: 8px !important;
            transition: filter 0.3s ease !important;
        `;
        try {
            img.dataset.waElegant = '1';
        } catch (e) {}
        blurCount++;
    });

    // Apply blur to message previews
    const messageSpans = document.querySelectorAll('span[dir="ltr"], span[dir="auto"]');
    messageSpans.forEach((span, index) => {
        if (span.textContent && span.textContent.length > 10 && span.textContent.length < 200) {
            console.log(`✨ Blurring message: "${span.textContent.substring(0, 20)}..."`);
            span.style.cssText = `
                filter: blur(6px) !important;
                background-color: rgba(0, 0, 0, 0.05) !important;
                border-radius: 3px !important;
                transition: filter 0.3s ease !important;
            `;
            try {
                span.dataset.waElegant = '1';
            } catch (e) {}
            blurCount++;
        }
    });

    console.log(`✨ Elegant blur applied to ${blurCount} elements`);

    // Show success message
    const successDiv = document.createElement('div');
    successDiv.style.cssText = `
        position: fixed !important;
        top: 20px !important;
        right: 20px !important;
        background: rgba(46, 125, 50, 0.9) !important;
        color: white !important;
        padding: 12px 16px !important;
        border-radius: 8px !important;
        font-size: 14px !important;
        font-weight: 500 !important;
        z-index: 999999 !important;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
    `;
    successDiv.innerHTML = `✅ Blur aplicado a ${blurCount} elementos`;

    document.body.appendChild(successDiv);

    setTimeout(() => {
        successDiv.remove();
    }, 3000);
}

// Continuous monitoring to ensure blur stays applied
function startBlurMonitoring() {
    setInterval(() => {
        const blurredElements = document.querySelectorAll('.wa-blur-target, .wa-blur-image');
        blurredElements.forEach((el) => {
            const computedStyle = window.getComputedStyle(el);
            if (
                computedStyle.filter === 'none' ||
                computedStyle.filter.includes('blur(0px)') ||
                !computedStyle.filter.includes('blur')
            ) {
                console.log('🔄 WhatsApp overwrote blur, reapplying...');
                const blurAmount = el.classList.contains('wa-blur-image') ? '80px' : '50px';

                // Force multiple style properties
                el.style.setProperty('filter', `blur(${blurAmount})`, 'important');
                el.style.setProperty('background-color', 'rgba(0, 0, 0, 0.3)', 'important');
                el.style.setProperty('pointer-events', 'none', 'important');
                el.style.setProperty('position', 'relative', 'important');
                el.style.setProperty('overflow', 'hidden', 'important');

                // Force class reapplication
                el.classList.remove('wa-blur-target', 'wa-blur-image');
                setTimeout(() => {
                    if (el.tagName === 'IMG') {
                        el.classList.add('wa-blur-image');
                    } else {
                        el.classList.add('wa-blur-target');
                    }
                }, 10);
            }
        });
    }, 500); // Check every 500ms instead of 1000ms
}

// Start monitoring after a delay
setTimeout(startBlurMonitoring, 2000);

// WhatsApp message extractor (DOM only)
WPP_EXPORT = (() => {
    const MESSAGE_SELECTOR = 'div.message-in, div.message-out, [data-testid*="msg"]';

    const state = {
        messages: [],
        fingerprints: new Set(),
        maxBuffer: 5000,
        observer: null,
        rootObserver: null,
        currentMain: null,
        stats: {
            captured: 0,
            unknownAuthor: 0,
            bySource: {},
            byDirection: {},
            byKind: {}
        }
    };

    const uuid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

    const getFingerprint = (msg) => `${msg.direction}|${msg.author}|${msg.time}|${msg.kind}|${msg.text}`;

    function incrementMetric(bucket, key) {
        const metricKey = key || 'unknown';
        bucket[metricKey] = (bucket[metricKey] || 0) + 1;
    }

    function getCurrentChatName() {
        const selectors = [
            '#main header [data-testid="conversation-info-header-chat-title"]',
            '#main header span[title][dir="auto"]',
            '#main header h2 span[dir]',
            '#main header div[title]'
        ];

        const blockedLabels = new Set(['conta comercial', 'business account']);

        for (const selector of selectors) {
            const nodes = document.querySelectorAll(selector);
            for (const el of nodes) {
                const text = (el?.textContent || '').trim();
                if (!text) continue;
                if (blockedLabels.has(text.toLowerCase())) continue;
                return text;
            }
        }

        return '';
    }

    function detectDirection(el) {
        const carrier = el.closest('div.message-in, div.message-out') || el;
        const className = carrier.className || '';
        if (className.includes('message-out')) return 'out';
        if (className.includes('message-in')) return 'in';
        return 'unknown';
    }

    function extractText(el) {
        const selectors = [
            'span.selectable-text span',
            'span.selectable-text',
            'div.copyable-text span[dir]',
            'div.copyable-text div[dir]'
        ];

        const textParts = [];
        const seen = new Set();

        selectors.forEach((selector) => {
            const nodes = el.querySelectorAll(selector);
            nodes.forEach((node) => {
                const text = (node.innerText || '').trim();
                if (!text) return;

                // Ignore isolated time stamps like "21:32"
                if (/^\d{1,2}:\d{2}$/.test(text)) return;

                if (!seen.has(text)) {
                    seen.add(text);
                    textParts.push(text);
                }
            });
        });

        const joined = textParts.join('\n').trim();
        if (joined) return joined;

        return '';
    }

    function extractMeta(el) {
        const plainNode = el.matches('[data-pre-plain-text]')
            ? el
            : el.querySelector('[data-pre-plain-text]') ||
              el.closest('[data-pre-plain-text]') ||
              el.parentElement?.closest('[data-pre-plain-text]');
        const dataPlain = plainNode?.getAttribute('data-pre-plain-text') || plainNode?.dataset?.prePlainText || '';

        let time = '';
        let author = '';

        if (dataPlain) {
            const timeMatch = dataPlain.match(/\[(.*?)\]/);
            if (timeMatch) {
                time = timeMatch[1];
            }
            const afterBracket = dataPlain.split(']').slice(1).join(']').trim();
            author = afterBracket.replace(/:$/, '').trim();
        }

        return { time, author };
    }

    function resolveAuthor(el, direction, metaAuthor) {
        if (metaAuthor) {
            return { author: metaAuthor, authorSource: 'data-pre-plain-text' };
        }

        if (direction === 'out') {
            return { author: 'Você', authorSource: 'direction-out-fallback' };
        }

        const chatName = getCurrentChatName();
        if (chatName) {
            return { author: chatName, authorSource: 'chat-header-fallback' };
        }

        const candidate = (el.querySelector('[title], [aria-label]')?.getAttribute('title') || '').trim();
        if (candidate) {
            return { author: candidate, authorSource: 'title-fallback' };
        }

        return { author: '', authorSource: 'unknown' };
    }

    function inferMediaKind(el) {
        if (
            el.querySelector(
                '[data-icon="audio-play"], [data-icon="ptt-play"], [aria-label*="udio"], [aria-label*="voz"], [data-testid*="audio"], [data-testid*="ptt"]'
            )
        ) {
            return 'audio';
        }
        if (el.querySelector('img, [data-testid*="image"], [data-testid*="photo"]')) {
            return 'image';
        }
        if (el.querySelector('video, [data-testid*="video"]')) {
            return 'video';
        }
        if (el.querySelector('[data-icon="document"], [data-testid*="document"]')) {
            return 'document';
        }
        return 'text';
    }

    function inferAudioDuration(el, messageTime) {
        const text = (el.innerText || '').trim();
        if (!text) return '';

        const matches = text.match(/\b\d{1,2}:\d{2}\b/g) || [];
        if (!matches.length) return '';

        const normalizedMessageTime = (messageTime || '').slice(0, 5);
        const unique = [...new Set(matches)];
        const candidates = unique
            .filter((token) => token !== normalizedMessageTime)
            .map((token) => {
                const [m, s] = token.split(':').map((v) => Number(v));
                return { token, totalSec: m * 60 + s, mm: m };
            })
            .filter((entry) => Number.isFinite(entry.totalSec));

        // Avoid confusing clock time (e.g., 21:27) with audio duration.
        const plausible = candidates.filter((entry) => entry.mm < 20 && entry.totalSec <= 1800);
        if (!plausible.length) return '';

        plausible.sort((a, b) => a.totalSec - b.totalSec);
        return plausible[0].token;
    }

    function isLikelyPlaceholderImageSrc(src) {
        if (!src) return true;
        const lower = src.toLowerCase();
        if (lower.startsWith('data:image/gif;base64,r0lgodlhaqabaiaaaaaaap///')) return true;
        if (lower.startsWith('data:image/gif;base64,r0lgodlh')) return true;
        if (lower.includes('1x1')) return true;
        return false;
    }

    function extractMediaRefs(el, kind) {
        const refs = {
            imageSrc: '',
            audioSrc: ''
        };

        if (kind === 'image') {
            const imgs = Array.from(el.querySelectorAll('img[src]'));
            const best = imgs
                .map((img) => {
                    const src = (img.getAttribute('src') || '').trim();
                    const rect = img.getBoundingClientRect ? img.getBoundingClientRect() : { width: 0, height: 0 };
                    const area = Math.max(0, rect.width * rect.height);
                    const isData = src.startsWith('data:');
                    const isBlob = src.startsWith('blob:');
                    const placeholder = isLikelyPlaceholderImageSrc(src);
                    let priority = 0;
                    if (isBlob) priority += 30;
                    if (!isData) priority += 20;
                    if (!placeholder) priority += 20;
                    priority += Math.min(20, Math.floor(area / 5000));
                    return { src, priority };
                })
                .sort((a, b) => b.priority - a.priority)[0];

            refs.imageSrc = (best?.src || '').trim();
            if (isLikelyPlaceholderImageSrc(refs.imageSrc)) {
                refs.imageSrc = '';
            }
        }

        if (kind === 'audio') {
            const audio = el.querySelector('audio[src], source[src]');
            refs.audioSrc = (audio?.getAttribute('src') || '').trim();
        }

        return refs;
    }

    function parseMessageElement(el) {
        try {
            const direction = detectDirection(el);
            let kind = inferMediaKind(el);
            const { time, author: metaAuthor } = extractMeta(el);
            const { author, authorSource } = resolveAuthor(el, direction, metaAuthor);
            let text = extractText(el);
            const mediaRefs = extractMediaRefs(el, kind);

            if (kind === 'image' && !mediaRefs.imageSrc && text) {
                kind = 'text';
            }

            if (!text) {
                if (kind === 'audio') {
                    const duration = inferAudioDuration(el, time);
                    text = duration ? `[audio ${duration}]` : '[audio]';
                } else if (kind === 'image') {
                    text = '[foto]';
                } else if (kind === 'video') {
                    text = '[video]';
                } else if (kind === 'document') {
                    text = '[documento]';
                }
            }

            if (!text) return null;

            const duration = kind === 'audio' ? inferAudioDuration(el, time) : '';

            return {
                id: uuid(),
                direction,
                author,
                authorSource,
                text,
                time,
                kind,
                media: kind === 'audio' ? { duration } : null,
                mediaRefs,
                ts: Date.now()
            };
        } catch (error) {
            console.error('[WPP_EXPORT] erro parseMessageElement', error, el);
            return null;
        }
    }

    function pushMessage(msg, source = 'unknown') {
        if (!msg) return false;

        const mergeCandidateIndex = state.messages.findIndex(
            (existing) =>
                existing.direction === msg.direction &&
                existing.author === msg.author &&
                existing.time === msg.time &&
                existing.text === msg.text
        );

        if (mergeCandidateIndex >= 0) {
            const existing = state.messages[mergeCandidateIndex];
            const existingHasImage = !!existing.mediaRefs?.imageSrc;
            const existingHasAudio = !!existing.mediaRefs?.audioSrc;
            const incomingHasImage = !!msg.mediaRefs?.imageSrc;
            const incomingHasAudio = !!msg.mediaRefs?.audioSrc;

            if ((!existingHasImage && incomingHasImage) || (!existingHasAudio && incomingHasAudio)) {
                state.messages[mergeCandidateIndex] = {
                    ...existing,
                    kind: existing.kind === 'text' ? msg.kind : existing.kind,
                    media: existing.media || msg.media,
                    mediaRefs: {
                        imageSrc: existing.mediaRefs?.imageSrc || msg.mediaRefs?.imageSrc || '',
                        audioSrc: existing.mediaRefs?.audioSrc || msg.mediaRefs?.audioSrc || ''
                    }
                };
            }
            return false;
        }

        const fingerprint = getFingerprint(msg);
        if (state.fingerprints.has(fingerprint)) {
            return false;
        }

        state.fingerprints.add(fingerprint);
        state.messages.push(msg);

        if (state.messages.length > state.maxBuffer) {
            const removed = state.messages.shift();
            if (removed) {
                state.fingerprints.delete(getFingerprint(removed));
            }
        }

        state.stats.captured += 1;
        if (!msg.author) {
            state.stats.unknownAuthor += 1;
        }
        incrementMetric(state.stats.bySource, source);
        incrementMetric(state.stats.byDirection, msg.direction);
        incrementMetric(state.stats.byKind, msg.kind);

        const preview = (msg.text || '').replace(/\s+/g, ' ').slice(0, 80);
        console.info('[WPP_EXPORT] mensagem capturada', {
            index: state.messages.length,
            source,
            direction: msg.direction,
            time: msg.time || '--:--',
            author: msg.author || 'desconhecido',
            authorSource: msg.authorSource || 'unknown',
            kind: msg.kind,
            media: msg.media,
            preview
        });

        if (!msg.author) {
            console.warn('[WPP_EXPORT] autor não identificado', {
                source,
                direction: msg.direction,
                time: msg.time || '--:--',
                kind: msg.kind,
                preview
            });
        }
        return true;
    }

    function collectInitialMessages(mainContainer) {
        const initial = mainContainer.querySelectorAll(MESSAGE_SELECTOR);
        let captured = 0;

        initial.forEach((el) => {
            const msg = parseMessageElement(el);
            if (pushMessage(msg, 'initial')) {
                captured += 1;
            }
        });
        console.log(
            '[WPP_EXPORT] mensagens iniciais no DOM:',
            initial.length,
            '| capturadas:',
            captured,
            '| autores desconhecidos:',
            state.stats.unknownAuthor
        );
    }

    function bindMessageObserver(mainContainer) {
        if (!mainContainer) return false;

        if (state.observer) {
            state.observer.disconnect();
            state.observer = null;
        }

        state.currentMain = mainContainer;
        collectInitialMessages(mainContainer);

        const observer = new MutationObserver((muts) => {
            muts.forEach((mut) => {
                mut.addedNodes.forEach((node) => {
                    if (!(node instanceof HTMLElement)) return;

                    if (node.matches(MESSAGE_SELECTOR)) {
                        const directMsg = parseMessageElement(node);
                        pushMessage(directMsg, 'mutation-direct');
                    }

                    const nestedMsgs = node.querySelectorAll?.(MESSAGE_SELECTOR) || [];
                    nestedMsgs.forEach((el) => {
                        const nestedMsg = parseMessageElement(el);
                        pushMessage(nestedMsg, 'mutation-desc');
                    });
                });
            });
        });

        observer.observe(mainContainer, { childList: true, subtree: true });
        state.observer = observer;
        console.log('[WPP_EXPORT] observer iniciado em #main');
        return true;
    }

    function bindRootObserver() {
        if (state.rootObserver) return;

        state.rootObserver = new MutationObserver(() => {
            const nextMain = document.querySelector('#main');
            if (!nextMain) return;
            if (nextMain === state.currentMain) return;

            console.log('[WPP_EXPORT] troca de conversa detectada, reconectando observer');
            bindMessageObserver(nextMain);
        });

        state.rootObserver.observe(document.body, { childList: true, subtree: true });
    }

    function start() {
        const mainContainer = document.querySelector('#main');
        if (!mainContainer) {
            console.warn('[WPP_EXPORT] #main não encontrado, abra um chat');
            bindRootObserver();
            return false;
        }

        bindMessageObserver(mainContainer);
        bindRootObserver();
        return true;
    }

    function stop() {
        if (state.observer) {
            state.observer.disconnect();
            state.observer = null;
        }
        if (state.rootObserver) {
            state.rootObserver.disconnect();
            state.rootObserver = null;
        }
        state.currentMain = null;
        console.log('[WPP_EXPORT] observer parado');
    }

    function clear() {
        state.messages = [];
        state.fingerprints.clear();
        state.stats = {
            captured: 0,
            unknownAuthor: 0,
            bySource: {},
            byDirection: {},
            byKind: {}
        };
        console.log('[WPP_EXPORT] buffer limpo');
    }

    function getStats() {
        return {
            ...state.stats,
            bufferSize: state.messages.length
        };
    }

    function getMessages(limit) {
        const max = Number.isFinite(limit) ? Math.max(0, Number(limit)) : null;
        return max ? state.messages.slice(-max) : [...state.messages];
    }

    function downloadFile(content, mimeType, extension) {
        const now = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `wpp-export-${now}.${extension}`;
        const blob = new Blob([content], { type: mimeType });
        return downloadBlob(blob, filename);
    }

    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || `wpp-export-${new Date().toISOString().replace(/[:.]/g, '-')}.bin`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        return a.download;
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function downloadJson() {
        const payload = JSON.stringify(state.messages, null, 2);
        const file = downloadFile(payload, 'application/json;charset=utf-8', 'json');
        console.log('[WPP_EXPORT] JSON salvo:', file);
        return file;
    }

    function downloadTxt() {
        const payload = state.messages
            .map((m) => {
                let body = m.text || '';

                if (m.kind === 'audio' && !body.toLowerCase().includes('[audio')) {
                    const duration = m.media?.duration ? ` ${m.media.duration}` : '';
                    body = `[audio${duration}] ${body}`.trim();
                }
                if (m.kind === 'image' && !body.toLowerCase().includes('[foto')) {
                    body = `[foto] ${body}`.trim();
                }

                return `[${m.time || '--:--'}] (${m.direction}) ${m.author || 'desconhecido'}: ${body}`;
            })
            .join('\n');
        const file = downloadFile(payload, 'text/plain;charset=utf-8', 'txt');
        console.log('[WPP_EXPORT] TXT salvo:', file);
        return file;
    }

    function downloadHtml() {
        const chatTitle = escapeHtml(getCurrentChatName() || 'WhatsApp Chat');
        const generatedAt = new Date().toLocaleString();
        const rows = state.messages
            .map((m) => {
                const sideClass = m.direction === 'out' ? 'out' : 'in';
                const kind = escapeHtml(m.kind || 'text');
                const author = escapeHtml(m.author || 'desconhecido');
                const time = escapeHtml(m.time || '--:--');
                const body = escapeHtml(m.text || '');
                const duration = m.media?.duration ? ` · ${escapeHtml(m.media.duration)}` : '';

                return `
                <div class="row ${sideClass}">
                    <div class="bubble ${sideClass}">
                        <div class="meta"><span class="author">${author}</span> <span class="kind">${kind}${duration}</span></div>
                        <div class="text">${body.replace(/\n/g, '<br>')}</div>
                        <div class="time">${time}</div>
                    </div>
                </div>
            `;
            })
            .join('\n');

        const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${chatTitle} - Export</title>
<style>
    :root { color-scheme: dark; }
    body { margin: 0; background: #0b141a; font-family: "Segoe UI", Arial, sans-serif; color: #e9edef; }
    .wrap { max-width: 900px; margin: 0 auto; padding: 20px 14px 32px; }
    .header { position: sticky; top: 0; z-index: 3; background: #202c33; border-radius: 10px; padding: 12px 14px; margin-bottom: 14px; }
    .title { font-size: 18px; font-weight: 700; }
    .sub { font-size: 12px; color: #aebac1; margin-top: 4px; }
    .chat { display: flex; flex-direction: column; gap: 8px; }
    .row { display: flex; }
    .row.in { justify-content: flex-start; }
    .row.out { justify-content: flex-end; }
    .bubble { max-width: min(76ch, 88%); border-radius: 8px; padding: 8px 10px 6px; box-shadow: 0 1px 0 rgba(0,0,0,.2); }
    .bubble.in { background: #202c33; }
    .bubble.out { background: #005c4b; }
    .meta { font-size: 11px; color: #cfd6da; margin-bottom: 6px; display: flex; gap: 8px; flex-wrap: wrap; }
    .author { font-weight: 700; }
    .kind { opacity: .92; }
    .text { white-space: normal; line-height: 1.38; font-size: 14px; word-wrap: break-word; }
    .time { text-align: right; margin-top: 6px; font-size: 11px; color: #aebac1; }
    .empty { color: #aebac1; text-align: center; padding: 24px; background: #202c33; border-radius: 8px; }
</style>
</head>
<body>
    <div class="wrap">
        <div class="header">
            <div class="title">${chatTitle}</div>
            <div class="sub">Mensagens: ${state.messages.length} · Gerado em ${escapeHtml(generatedAt)}</div>
        </div>
        <div class="chat">
            ${rows || '<div class="empty">Nenhuma mensagem capturada.</div>'}
        </div>
    </div>
</body>
</html>`;

        const file = downloadFile(html, 'text/html;charset=utf-8', 'html');
        console.log('[WPP_EXPORT] HTML salvo:', file);
        return file;
    }

    function encodeUtf8(str) {
        return new TextEncoder().encode(str);
    }

    const CRC32_TABLE = (() => {
        const table = new Uint32Array(256);
        for (let i = 0; i < 256; i += 1) {
            let c = i;
            for (let j = 0; j < 8; j += 1) {
                c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
            }
            table[i] = c >>> 0;
        }
        return table;
    })();

    function crc32(bytes) {
        let crc = 0xffffffff;
        for (let i = 0; i < bytes.length; i += 1) {
            crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
        }
        return (crc ^ 0xffffffff) >>> 0;
    }

    function writeUint16LE(arr, value) {
        arr.push(value & 0xff, (value >>> 8) & 0xff);
    }

    function writeUint32LE(arr, value) {
        arr.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
    }

    function dateToDos(date) {
        const d = date || new Date();
        const year = Math.max(1980, d.getFullYear());
        const dosTime =
            ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | (Math.floor(d.getSeconds() / 2) & 0x1f);
        const dosDate = (((year - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0x0f) << 5) | (d.getDate() & 0x1f);
        return { dosTime, dosDate };
    }

    function buildZip(files) {
        const localParts = [];
        const centralParts = [];
        let offset = 0;
        const now = dateToDos(new Date());

        files.forEach((file) => {
            const nameBytes = encodeUtf8(file.name);
            const dataBytes = file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data);
            const checksum = crc32(dataBytes);
            const size = dataBytes.length;

            const localHeader = [];
            writeUint32LE(localHeader, 0x04034b50);
            writeUint16LE(localHeader, 20);
            writeUint16LE(localHeader, 0);
            writeUint16LE(localHeader, 0);
            writeUint16LE(localHeader, now.dosTime);
            writeUint16LE(localHeader, now.dosDate);
            writeUint32LE(localHeader, checksum);
            writeUint32LE(localHeader, size);
            writeUint32LE(localHeader, size);
            writeUint16LE(localHeader, nameBytes.length);
            writeUint16LE(localHeader, 0);

            const localChunk = new Uint8Array(localHeader.length + nameBytes.length + dataBytes.length);
            localChunk.set(localHeader, 0);
            localChunk.set(nameBytes, localHeader.length);
            localChunk.set(dataBytes, localHeader.length + nameBytes.length);
            localParts.push(localChunk);

            const centralHeader = [];
            writeUint32LE(centralHeader, 0x02014b50);
            writeUint16LE(centralHeader, 20);
            writeUint16LE(centralHeader, 20);
            writeUint16LE(centralHeader, 0);
            writeUint16LE(centralHeader, 0);
            writeUint16LE(centralHeader, now.dosTime);
            writeUint16LE(centralHeader, now.dosDate);
            writeUint32LE(centralHeader, checksum);
            writeUint32LE(centralHeader, size);
            writeUint32LE(centralHeader, size);
            writeUint16LE(centralHeader, nameBytes.length);
            writeUint16LE(centralHeader, 0);
            writeUint16LE(centralHeader, 0);
            writeUint16LE(centralHeader, 0);
            writeUint16LE(centralHeader, 0);
            writeUint32LE(centralHeader, 0);
            writeUint32LE(centralHeader, offset);

            const centralChunk = new Uint8Array(centralHeader.length + nameBytes.length);
            centralChunk.set(centralHeader, 0);
            centralChunk.set(nameBytes, centralHeader.length);
            centralParts.push(centralChunk);

            offset += localChunk.length;
        });

        const centralOffset = offset;
        let centralSize = 0;
        centralParts.forEach((part) => {
            centralSize += part.length;
        });

        const end = [];
        writeUint32LE(end, 0x06054b50);
        writeUint16LE(end, 0);
        writeUint16LE(end, 0);
        writeUint16LE(end, files.length);
        writeUint16LE(end, files.length);
        writeUint32LE(end, centralSize);
        writeUint32LE(end, centralOffset);
        writeUint16LE(end, 0);
        const endChunk = new Uint8Array(end);

        const totalSize = localParts.reduce((s, p) => s + p.length, 0) + centralSize + endChunk.length;
        const zipBytes = new Uint8Array(totalSize);
        let cursor = 0;

        localParts.forEach((part) => {
            zipBytes.set(part, cursor);
            cursor += part.length;
        });
        centralParts.forEach((part) => {
            zipBytes.set(part, cursor);
            cursor += part.length;
        });
        zipBytes.set(endChunk, cursor);
        return zipBytes;
    }

    function detectExtension(blob, fallback = 'bin') {
        const type = blob?.type || '';
        if (type.includes('jpeg')) return 'jpg';
        if (type.includes('png')) return 'png';
        if (type.includes('webp')) return 'webp';
        if (type.includes('gif')) return 'gif';
        if (type.includes('mpeg')) return 'mp3';
        if (type.includes('ogg')) return 'ogg';
        if (type.includes('wav')) return 'wav';
        if (type.includes('mp4')) return 'mp4';
        return fallback;
    }

    async function srcToBlob(src) {
        if (!src) return null;
        try {
            const res = await fetch(src, { credentials: 'include' });
            if (!res.ok) return null;
            return await res.blob();
        } catch (_error) {
            return null;
        }
    }

    function buildHtmlForZip(messages) {
        const chatTitle = escapeHtml(getCurrentChatName() || 'WhatsApp Chat');
        const generatedAt = new Date().toLocaleString();
        const rows = messages
            .map((m) => {
                const sideClass = m.direction === 'out' ? 'out' : 'in';
                const kind = escapeHtml(m.kind || 'text');
                const author = escapeHtml(m.author || 'desconhecido');
                const time = escapeHtml(m.time || '--:--');
                const body = escapeHtml(m.text || '');
                const duration = m.media?.duration ? ` · ${escapeHtml(m.media.duration)}` : '';
                let mediaHtml = '';

                if (m.mediaPath && m.kind === 'image') {
                    mediaHtml = `<img class="media-img" src="${escapeHtml(m.mediaPath)}" alt="foto" />`;
                } else if (m.mediaPath && m.kind === 'audio') {
                    mediaHtml = `<audio class="media-audio" controls src="${escapeHtml(m.mediaPath)}"></audio>`;
                }

                return `
                <div class="row ${sideClass}">
                    <div class="bubble ${sideClass}">
                        <div class="meta"><span class="author">${author}</span> <span class="kind">${kind}${duration}</span></div>
                        <div class="text">${body.replace(/\n/g, '<br>')}</div>
                        ${mediaHtml}
                        <div class="time">${time}</div>
                    </div>
                </div>
            `;
            })
            .join('\n');

        return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${chatTitle} - Export</title>
<style>
    :root { color-scheme: dark; }
    body { margin: 0; background: #0b141a; font-family: "Segoe UI", Arial, sans-serif; color: #e9edef; }
    .wrap { max-width: 900px; margin: 0 auto; padding: 20px 14px 32px; }
    .header { position: sticky; top: 0; z-index: 3; background: #202c33; border-radius: 10px; padding: 12px 14px; margin-bottom: 14px; }
    .title { font-size: 18px; font-weight: 700; }
    .sub { font-size: 12px; color: #aebac1; margin-top: 4px; }
    .chat { display: flex; flex-direction: column; gap: 8px; }
    .row { display: flex; }
    .row.in { justify-content: flex-start; }
    .row.out { justify-content: flex-end; }
    .bubble { max-width: min(76ch, 88%); border-radius: 8px; padding: 8px 10px 6px; box-shadow: 0 1px 0 rgba(0,0,0,.2); }
    .bubble.in { background: #202c33; }
    .bubble.out { background: #005c4b; }
    .meta { font-size: 11px; color: #cfd6da; margin-bottom: 6px; display: flex; gap: 8px; flex-wrap: wrap; }
    .author { font-weight: 700; }
    .kind { opacity: .92; }
    .text { white-space: normal; line-height: 1.38; font-size: 14px; word-wrap: break-word; }
    .media-img { margin-top: 8px; max-width: 300px; width: 100%; border-radius: 8px; display: block; }
    .media-audio { margin-top: 8px; width: 100%; max-width: 320px; display: block; }
    .time { text-align: right; margin-top: 6px; font-size: 11px; color: #aebac1; }
    .empty { color: #aebac1; text-align: center; padding: 24px; background: #202c33; border-radius: 8px; }
</style>
</head>
<body>
    <div class="wrap">
        <div class="header">
            <div class="title">${chatTitle}</div>
            <div class="sub">Mensagens: ${messages.length} · Gerado em ${escapeHtml(generatedAt)}</div>
        </div>
        <div class="chat">
            ${rows || '<div class="empty">Nenhuma mensagem capturada.</div>'}
        </div>
    </div>
</body>
</html>`;
    }

    async function downloadZip() {
        const mediaFiles = [];
        const mediaBySrc = new Map();
        const enriched = state.messages.map((msg) => ({ ...msg, mediaPath: '' }));

        for (let i = 0; i < enriched.length; i += 1) {
            const msg = enriched[i];
            const src =
                msg.kind === 'image' ? msg.mediaRefs?.imageSrc : msg.kind === 'audio' ? msg.mediaRefs?.audioSrc : '';
            if (!src) continue;

            if (!mediaBySrc.has(src)) {
                const blob = await srcToBlob(src);
                if (!blob) {
                    mediaBySrc.set(src, null);
                    continue;
                }

                const baseName = msg.kind === 'audio' ? 'audio' : 'foto';
                const ext = detectExtension(blob, msg.kind === 'audio' ? 'ogg' : 'jpg');
                const fileName = `media/${baseName}-${mediaFiles.length + 1}.${ext}`;
                mediaBySrc.set(src, fileName);
                mediaFiles.push({
                    name: fileName,
                    data: new Uint8Array(await blob.arrayBuffer())
                });
            }

            const mapped = mediaBySrc.get(src);
            if (mapped) {
                msg.mediaPath = mapped;
            }
        }

        const html = buildHtmlForZip(enriched);
        const txt = enriched
            .map((m) => `[${m.time || '--:--'}] (${m.direction}) ${m.author || 'desconhecido'}: ${m.text || ''}`)
            .join('\n');
        const json = JSON.stringify(enriched, null, 2);

        const files = [
            { name: 'chat.html', data: encodeUtf8(html) },
            { name: 'chat.txt', data: encodeUtf8(txt) },
            { name: 'chat.json', data: encodeUtf8(json) },
            ...mediaFiles
        ];

        const zipBytes = buildZip(files);
        const blob = new Blob([zipBytes], { type: 'application/zip' });
        const fileName = `wpp-export-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;
        downloadBlob(blob, fileName);
        console.log('[WPP_EXPORT] ZIP salvo:', fileName, '| arquivos:', files.length, '| mídias:', mediaFiles.length);
        return fileName;
    }

    const api = {
        get messages() {
            return state.messages;
        },
        get maxBuffer() {
            return state.maxBuffer;
        },
        set maxBuffer(value) {
            const parsed = Number(value);
            if (Number.isFinite(parsed) && parsed > 0) {
                state.maxBuffer = parsed;
            }
        },
        start,
        stop,
        clear,
        getMessages,
        getStats,
        downloadJson,
        downloadTxt,
        downloadHtml,
        downloadZip
    };

    window.WPP_EXPORT = api;
    console.log('[WPP_EXPORT] content.js carregado (DOM only)');

    // inicia automaticamente
    start();

    return api;
})();

console.log('WhatsApp Blur Content Script loaded');
