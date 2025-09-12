// WhatsApp Blur Content Script
let isBlurEnabled = false;
let currentSettings = null;
let blurObserver = null;
let lastBlurredElements = new Set();
let currentChatContext = null;
let managedUsers = new Map(); // Store multiple user blur settings

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script received message:', request);
    
    switch (request.action) {
        case 'ping':
            console.log('🏓 Content script ping received');
            sendResponse({success: true, message: 'Content script is loaded'});
            break;
            
        case 'applyBlur':
            applyBlur(request.contactName, request.blurSettings, request.blurTypeSettings);
            sendResponse({success: true});
            break;
            
        case 'toggleBlur':
            toggleBlur();
            sendResponse({success: true, isEnabled: isBlurEnabled});
            break;
            
        case 'clearBlur':
            clearBlur();
            sendResponse({success: true});
            break;
            
        case 'scanUsers':
            const users = scanForUsers();
            sendResponse({success: true, users: users});
            break;
            
        case 'toggleUserBlur':
            console.log('Content script received toggleUserBlur:', request);
            toggleUserBlur(request.userName, request.isBlurred, request.blurSettings, request.blurTypeSettings);
            sendResponse({success: true});
            break;
            
        case 'removeUserBlur':
            removeUserBlur(request.userName);
            sendResponse({success: true});
            break;
            
        case 'clearAllUsers':
            clearAllUsers();
            sendResponse({success: true});
            break;
            
        case 'blurAllUsers':
            console.log('📨 Content script received blurAllUsers message:', {
                action: request.action,
                userCount: request.users ? request.users.length : 0,
                users: request.users
            });
            console.log('🔍 Detailed user analysis:', request.users?.map(u => ({
                name: u.name,
                isBlurred: u.isBlurred,
                hasValidName: !!u.name,
                nameLength: u.name?.length
            })));
            try {
                const result = blurAllUsers(request.users);
                console.log('✅ blurAllUsers operation completed successfully with result:', result);
                sendResponse({success: true, result});
            } catch (error) {
                console.error('❌ Error in blurAllUsers operation:', error);
                sendResponse({success: false, error: error.message});
            }
            break;
            
        case 'unblurAllUsers':
            console.log('Content script received unblurAllUsers:', request);
            unblurAllUsers(request.users);
            sendResponse({success: true});
            break;
            
        default:
            sendResponse({success: false, error: 'Unknown action'});
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
    style.id = "wa-blur-style";
    
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
    document.querySelectorAll('.wa-blur-target, .wa-blur-image').forEach(el => {
        el.classList.remove('wa-blur-target', 'wa-blur-image');
    });
}

// Check if we're currently in the target chat
function isInTargetChat(contactName) {
    const header = document.querySelector('header');
    if (!header) {
        return false;
    }
    
    // Method 1: Look for the contact name in the header
    const allElements = header.querySelectorAll('*');
    for (let el of allElements) {
        if (el.textContent && el.textContent.trim() === contactName) {
            return true;
        }
    }
    
    // Method 2: Check if header has a title attribute with the name
    const headerTitle = header.getAttribute('title');
    if (headerTitle && headerTitle.includes(contactName)) {
        return true;
    }
    
    // Method 3: Look for any element with the name as text content
    const allTextElements = document.querySelectorAll('*');
    for (let el of allTextElements) {
        if (el.textContent && el.textContent.trim() === contactName) {
            const rect = el.getBoundingClientRect();
            const headerRect = header.getBoundingClientRect();
            if (rect.top >= headerRect.top && rect.bottom <= headerRect.bottom) {
                return true;
            }
        }
    }
    
    // Method 4: Check if we're in a conversation (not in chat list)
    const messageArea = document.querySelector('[data-testid="conversation-panel-messages"]') ||
                       document.querySelector('.message-list') ||
                       document.querySelector('[role="log"]');
    
    if (messageArea) {
        return true;
    }
    
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
        const hasSignificantChanges = mutations.some(mutation => {
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
chrome.storage.sync.get(['contactName', 'blurSettings', 'isEnabled', 'managedUsers'], function(result) {
    // Load managed users
    if (result.managedUsers && result.managedUsers.length > 0) {
        result.managedUsers.forEach(user => {
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
    const chatSpans = document.querySelectorAll("span[title]");
    chatSpans.forEach(span => {
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
        headerElements.forEach(el => {
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
    // Remove blur classes for this specific user
    const chatSpans = document.querySelectorAll("span[title]");
    chatSpans.forEach(span => {
        if (span.getAttribute('title') === userName) {
            span.classList.remove('wa-blur-target');
            
            // Also remove blur from associated elements
            const container = span.closest('div[role="listitem"]') || span.closest('div[tabindex]');
            if (container) {
                const img = container.querySelector('img');
                if (img) {
                    img.classList.remove('wa-blur-image');
                }
                
                // Remove blur from message preview
                const allSpans = document.querySelectorAll("span[title]");
                const currentIndex = Array.from(allSpans).indexOf(span);
                if (currentIndex + 1 < allSpans.length) {
                    const nextSpan = allSpans[currentIndex + 1];
                    if (nextSpan) {
                        nextSpan.classList.remove('wa-blur-target');
                    }
                }
            }
        }
    });
    
    // Remove blur from header if we're in this user's chat
    if (isInTargetChat(userName)) {
        const header = document.querySelector('header');
        if (header) {
            const allElements = header.querySelectorAll('*');
            allElements.forEach(el => {
                if (el.textContent && el.textContent.trim() === userName) {
                    el.classList.remove('wa-blur-target');
                }
            });
            
            const headerImgs = header.querySelectorAll('img');
            headerImgs.forEach(img => img.classList.remove('wa-blur-image'));
        }
        
        // Remove blur from messages
        const messageArea = document.querySelector('[data-testid="conversation-panel-messages"]') ||
                           document.querySelector('.message-list') ||
                           document.querySelector('[role="log"]');
        
        if (messageArea) {
            const allElements = messageArea.querySelectorAll('*');
            allElements.forEach(el => {
                if (el.textContent && el.textContent.trim().length > 3) {
                    el.classList.remove('wa-blur-target');
                }
            });
            
            const imgs = messageArea.querySelectorAll('img');
            imgs.forEach(img => img.classList.remove('wa-blur-image'));
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
    const chatSpans = document.querySelectorAll("span[title]");
    const header = document.querySelector('header');
    const messageArea = document.querySelector('[data-testid="conversation-panel-messages"]') ||
                       document.querySelector('.message-list') ||
                       document.querySelector('[role="log"]');
    
    console.log('🔍 Page state after blur operation:');
    console.log(`  - Chat spans found: ${chatSpans.length}`);
    console.log(`  - Header present: ${!!header}`);
    console.log(`  - Message area present: ${!!messageArea}`);
    console.log(`  - Blurred elements: ${document.querySelectorAll('.wa-blur-target, .wa-blur-image').length}`);
    
    // Apply elegant blur instead of nuclear option
    console.log('✨ Applying elegant blur to all elements');
    setTimeout(() => {
        applyElegantBlur();
    }, 500);
    
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
    console.log('🔓 Unblurring all users:', users?.map(u => u.name));
    
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
    
    allElements.forEach(el => {
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
    overlays.forEach(overlay => overlay.remove());
    
    // Remove any success/test messages
    const testElements = document.querySelectorAll('#wa-blur-test');
    testElements.forEach(el => el.remove());
    
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
        console.warn('⚠️ blurContact called with invalid blurSettings:', { contactName, blurSettings, blurTypeSettings, type: typeof blurSettings });
        return;
    }
    
    console.log('✅ blurContact called with valid parameters:', { contactName, blurSettings, blurTypeSettings });
    
    console.log(`🎯 Starting blur operation for "${contactName}" with blur type: ${blurTypeSettings.type}`);
    const blurStartTime = performance.now();
    
    // Add styles with the specified blur type
    addBlurStyles(blurTypeSettings);
    
    // Check if we need to clear previous blur (only when context changes)
    const newChatContext = isInTargetChat(contactName);
    if (currentChatContext !== newChatContext) {
        console.log(`🔄 Chat context changed, clearing previous blur classes`);
        clearAllBlurClasses();
        lastBlurredElements.clear();
        currentChatContext = newChatContext;
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
        const chatSpans = document.querySelectorAll("span[title]");
        console.log(`🔍 Found ${chatSpans.length} chat spans to check`);
        
        chatSpans.forEach((span, index) => {
            if (span.getAttribute('title') === contactName && !shouldExcludeElement(span)) {
                console.log(`✅ Found matching span for "${contactName}" at index ${index}`);
                
                if (blurSettings.chatListName && !span.classList.contains('wa-blur-target')) {
                    span.classList.add('wa-blur-target');
                    lastBlurredElements.add(span);
                    elementsBlurred.chatListName++;
                    console.log(`🎯 Blurred chat list name for "${contactName}"`);
                    console.log(`🔍 Element classes after blur:`, span.className);
                    console.log(`🔍 Element computed style:`, window.getComputedStyle(span).filter);
                }
                
                // Find and blur message preview
                if (blurSettings.chatListMessage) {
                    const allSpans = document.querySelectorAll("span[title]");
                    const currentIndex = Array.from(allSpans).indexOf(span);
                    if (currentIndex + 1 < allSpans.length) {
                        const nextSpan = allSpans[currentIndex + 1];
                        if (nextSpan && nextSpan.textContent && nextSpan.textContent.trim().length > 3 && 
                            !nextSpan.classList.contains('wa-blur-target') && !shouldExcludeElement(nextSpan)) {
                            nextSpan.classList.add('wa-blur-target');
                            lastBlurredElements.add(nextSpan);
                            elementsBlurred.chatListMessage++;
                            console.log(`💬 Blurred message preview for "${contactName}": "${nextSpan.textContent.trim().substring(0, 50)}..."`);
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
                allElements.forEach(el => {
                    if (el.textContent && el.textContent.trim() === contactName && 
                        !el.classList.contains('wa-blur-target') && !shouldExcludeElement(el)) {
                        el.classList.add('wa-blur-target');
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
                headerImgs.forEach(img => {
                    if (!img.classList.contains('wa-blur-image') && !shouldExcludeElement(img)) {
                        img.classList.add('wa-blur-image');
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
            const messageArea = document.querySelector('[data-testid="conversation-panel-messages"]') ||
                               document.querySelector('.message-list') ||
                               document.querySelector('[role="log"]') ||
                               document.querySelector('div[data-testid*="message"]');
            
            if (messageArea) {
                console.log(`📱 Found message area, processing messages`);
                
                if (blurSettings.messageText) {
                    const allElements = messageArea.querySelectorAll('*');
                    console.log(`🔍 Checking ${allElements.length} message elements for text blur`);
                    allElements.forEach(el => {
                        if (el.textContent && el.textContent.trim().length > 3 && 
                            !el.classList.contains('wa-blur-target') && !shouldExcludeElement(el)) {
                            const text = el.textContent.trim();
                            if (text.includes(' ') || text.includes('?') || text.includes('!') || 
                                text.includes('.') || text.includes(',') || /[a-z]/.test(text)) {
                                el.classList.add('wa-blur-target');
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
                    imgs.forEach(img => {
                        if (!img.classList.contains('wa-blur-image') && !shouldExcludeElement(img)) {
                            img.classList.add('wa-blur-image');
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
                messages.forEach(msg => {
                    if (blurSettings.messageText) {
                        const textEls = msg.querySelectorAll('span, div');
                        textEls.forEach(el => {
                            if (el.textContent && el.textContent.trim().length > 3 && 
                                !el.classList.contains('wa-blur-target') && !shouldExcludeElement(el)) {
                                el.classList.add('wa-blur-target');
                                lastBlurredElements.add(el);
                                elementsBlurred.messageText++;
                            }
                        });
                    }
                    if (blurSettings.messageImages) {
                        const imgs = msg.querySelectorAll('img');
                        imgs.forEach(img => {
                            if (!img.classList.contains('wa-blur-image') && !shouldExcludeElement(img)) {
                                img.classList.add('wa-blur-image');
                                lastBlurredElements.add(img);
                                elementsBlurred.messageImages++;
                            }
                        });
                    }
                });
                console.log(`🔄 Fallback results: ${elementsBlurred.messageText} text, ${elementsBlurred.messageImages} images`);
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
            if (computedStyle.filter === 'none' || !computedStyle.filter.includes('blur') || computedStyle.filter.includes('blur(0px)')) {
                console.log(`✨ Applying elegant fallback blur for element ${index + 1}`);
                
                // Apply elegant blur with style override
                el.style.cssText = el.style.cssText + `
                    filter: blur(10px) !important;
                    background-color: rgba(0, 0, 0, 0.1) !important;
                    backdrop-filter: blur(5px) !important;
                    border-radius: 4px !important;
                    transition: filter 0.3s ease !important;
                    position: relative !important;
                `;
                
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
    console.error = function(...args) {
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
        blurredElements.forEach(el => {
            const computedStyle = window.getComputedStyle(el);
            if (computedStyle.filter === 'none' || computedStyle.filter.includes('blur(0px)') || !computedStyle.filter.includes('blur')) {
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

console.log('WhatsApp Blur Content Script loaded');

