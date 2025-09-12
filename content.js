// WhatsApp Blur Content Script
let isBlurEnabled = false;
let currentSettings = null;
let blurObserver = null;
let lastBlurredElements = new Set();
let currentChatContext = null;

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

// Main blur function
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
    
    // 1. Always blur chat list items
    if (blurSettings.chatListName || blurSettings.chatListMessage || blurSettings.chatListAvatar) {
        const chatSpans = document.querySelectorAll("span[title]");
        chatSpans.forEach(span => {
            if (span.getAttribute('title') === contactName) {
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
                            !nextSpan.classList.contains('wa-blur-target')) {
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
                        if (img && !img.classList.contains('wa-blur-image')) {
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
                        !el.classList.contains('wa-blur-target')) {
                        el.classList.add('wa-blur-target');
                        lastBlurredElements.add(el);
                    }
                });
            }
            
            // Blur header avatar
            if (blurSettings.headerAvatar) {
                const headerImgs = header.querySelectorAll('img');
                headerImgs.forEach(img => {
                    if (!img.classList.contains('wa-blur-image')) {
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
                            !el.classList.contains('wa-blur-target')) {
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
                        if (!img.classList.contains('wa-blur-image')) {
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
                                !el.classList.contains('wa-blur-target')) {
                                el.classList.add('wa-blur-target');
                                lastBlurredElements.add(el);
                            }
                        });
                    }
                    if (blurSettings.messageImages) {
                        const imgs = msg.querySelectorAll('img');
                        imgs.forEach(img => {
                            if (!img.classList.contains('wa-blur-image')) {
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
        if (!currentSettings) return;
        
        const hasSignificantChanges = mutations.some(mutation => {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                for (let node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const hasTargetContent = node.textContent && node.textContent.includes(currentSettings.contactName);
                        const hasImages = node.querySelector && node.querySelector('img');
                        if (hasTargetContent || hasImages) {
                            return true;
                        }
                    }
                }
            }
            return false;
        });
        
        if (hasSignificantChanges) {
            debouncedBlur();
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
chrome.storage.sync.get(['contactName', 'blurSettings', 'isEnabled'], function(result) {
    if (result.isEnabled && result.contactName && result.blurSettings) {
        // Wait a bit for WhatsApp to load
        setTimeout(() => {
            applyBlur(result.contactName, result.blurSettings);
        }, 2000);
    }
});

console.log('WhatsApp Blur Content Script loaded');
