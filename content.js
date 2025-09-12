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
        case 'applyBlur':
            applyBlur(request.contactName, request.blurSettings);
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
            toggleUserBlur(request.userName, request.isBlurred);
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
            console.log('Content script received blurAllUsers:', request);
            blurAllUsers(request.users);
            sendResponse({success: true});
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

// Add blur styles
function addBlurStyles() {
    if (document.getElementById('wa-blur-style')) {
        return; // Already exists
    }
    
    const style = document.createElement('style');
    style.id = "wa-blur-style";
    style.textContent = `
        .wa-blur-target {
            filter: blur(8px) !important;
            pointer-events: none !important;
            transition: filter 0.3s ease !important;
        }
        .wa-blur-image {
            filter: blur(12px) !important;
            pointer-events: none !important;
            transition: filter 0.3s ease !important;
        }
    `;
    document.head.appendChild(style);
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
                    blurContact(userName, userData.blurSettings);
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

function applyBlur(contactName, blurSettings) {
    if (!contactName) {
        console.error('No contact name provided');
        return;
    }
    
    currentSettings = { contactName, blurSettings };
    managedUsers.set(contactName, {
        name: contactName,
        isBlurred: true,
        blurSettings: blurSettings
    });
    
    setupBlurObserver();
    blurContact(contactName, blurSettings);
    isBlurEnabled = true;
    
    console.log('Blur applied for:', contactName);
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
            addBlurStyles();
            blurContact(currentSettings.contactName, currentSettings.blurSettings);
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
                    blurContact(userName, userData.blurSettings);
                }
            }
            setupBlurObserver();
        }, 2000);
    }
    
    // Legacy support for single user
    if (result.isEnabled && result.contactName && result.blurSettings) {
        setTimeout(() => {
            applyBlur(result.contactName, result.blurSettings);
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
function toggleUserBlur(userName, isBlurred) {
    console.log('toggleUserBlur called with:', userName, isBlurred);
    
    if (isBlurred) {
        console.log('Adding user to managed users:', userName);
        managedUsers.set(userName, {
            name: userName,
            isBlurred: true,
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
        
        // Ensure blur observer is set up
        if (!blurObserver) {
            setupBlurObserver();
        }
        
        blurContact(userName, managedUsers.get(userName).blurSettings);
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
    console.log('blurAllUsers called with:', users);
    
    if (!users || users.length === 0) {
        console.log('No users provided to blur');
        return;
    }
    
    // Clear existing managed users
    managedUsers.clear();
    
    // Add all users to managed users and apply blur
    users.forEach(user => {
        if (user.isBlurred) {
            managedUsers.set(user.name, {
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
                }
            });
            
            // Apply blur for this user
            blurContact(user.name, managedUsers.get(user.name).blurSettings);
        }
    });
    
    // Ensure blur observer is set up
    if (!blurObserver) {
        setupBlurObserver();
    }
    
    console.log('Applied blur to all users:', Array.from(managedUsers.keys()));
}

// Unblur all users at once
function unblurAllUsers(users) {
    console.log('unblurAllUsers called with:', users);
    
    if (!users || users.length === 0) {
        console.log('No users provided to unblur');
        return;
    }
    
    // Remove all users from managed users and clear their blur
    users.forEach(user => {
        if (managedUsers.has(user.name)) {
            managedUsers.delete(user.name);
            removeUserBlur(user.name);
        }
    });
    
    console.log('Removed blur from all users:', users.map(u => u.name));
}

// Clear all users
function clearAllUsers() {
    managedUsers.clear();
    clearAllBlurClasses();
    lastBlurredElements.clear();
    currentChatContext = null;
    
    console.log('Cleared all users');
}

// Enhanced blur function that works with multiple users
function blurContact(contactName, blurSettings) {
    if (!contactName || !blurSettings) {
        return;
    }
    
    // Only add styles if they don't exist
    addBlurStyles();
    
    // Check if we need to clear previous blur (only when context changes)
    const newChatContext = isInTargetChat(contactName);
    if (currentChatContext !== newChatContext) {
        clearAllBlurClasses();
        lastBlurredElements.clear();
        currentChatContext = newChatContext;
    }
    
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
        const chatSpans = document.querySelectorAll("span[title]");
        chatSpans.forEach(span => {
            if (span.getAttribute('title') === contactName && !shouldExcludeElement(span)) {
                if (blurSettings.chatListName && !span.classList.contains('wa-blur-target')) {
                    span.classList.add('wa-blur-target');
                    lastBlurredElements.add(span);
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
                        }
                    }
                }
            }
        });
    }
    
    // 2. Only blur header and messages if we're actually in the target chat
    if (isInTargetChat(contactName)) {
        const header = document.querySelector('header');
        if (header) {
            // Find and blur header name
            if (blurSettings.headerName) {
                const allElements = header.querySelectorAll('*');
                allElements.forEach(el => {
                    if (el.textContent && el.textContent.trim() === contactName && 
                        !el.classList.contains('wa-blur-target') && !shouldExcludeElement(el)) {
                        el.classList.add('wa-blur-target');
                        lastBlurredElements.add(el);
                    }
                });
            }
            
            // Blur header avatar
            if (blurSettings.headerAvatar) {
                const headerImgs = header.querySelectorAll('img');
                headerImgs.forEach(img => {
                    if (!img.classList.contains('wa-blur-image') && !shouldExcludeElement(img)) {
                        img.classList.add('wa-blur-image');
                        lastBlurredElements.add(img);
                    }
                });
            }
        }
        
        // Blur messages
        if (blurSettings.messageText || blurSettings.messageImages) {
            const messageArea = document.querySelector('[data-testid="conversation-panel-messages"]') ||
                               document.querySelector('.message-list') ||
                               document.querySelector('[role="log"]') ||
                               document.querySelector('div[data-testid*="message"]');
            
            if (messageArea) {
                if (blurSettings.messageText) {
                    const allElements = messageArea.querySelectorAll('*');
                    allElements.forEach(el => {
                        if (el.textContent && el.textContent.trim().length > 3 && 
                            !el.classList.contains('wa-blur-target') && !shouldExcludeElement(el)) {
                            const text = el.textContent.trim();
                            if (text.includes(' ') || text.includes('?') || text.includes('!') || 
                                text.includes('.') || text.includes(',') || /[a-z]/.test(text)) {
                                el.classList.add('wa-blur-target');
                                lastBlurredElements.add(el);
                            }
                        }
                    });
                }
                
                if (blurSettings.messageImages) {
                    const imgs = messageArea.querySelectorAll('img');
                    imgs.forEach(img => {
                        if (!img.classList.contains('wa-blur-image') && !shouldExcludeElement(img)) {
                            img.classList.add('wa-blur-image');
                            lastBlurredElements.add(img);
                        }
                    });
                }
            } else {
                // Fallback: blur all messages in the page
                const messages = document.querySelectorAll('.message-in, .message-out, [data-testid*="msg"]');
                messages.forEach(msg => {
                    if (blurSettings.messageText) {
                        const textEls = msg.querySelectorAll('span, div');
                        textEls.forEach(el => {
                            if (el.textContent && el.textContent.trim().length > 3 && 
                                !el.classList.contains('wa-blur-target') && !shouldExcludeElement(el)) {
                                el.classList.add('wa-blur-target');
                                lastBlurredElements.add(el);
                            }
                        });
                    }
                    if (blurSettings.messageImages) {
                        const imgs = msg.querySelectorAll('img');
                        imgs.forEach(img => {
                            if (!img.classList.contains('wa-blur-image') && !shouldExcludeElement(img)) {
                                img.classList.add('wa-blur-image');
                                lastBlurredElements.add(img);
                            }
                        });
                    }
                });
            }
        }
    }
}

console.log('WhatsApp Blur Content Script loaded');
