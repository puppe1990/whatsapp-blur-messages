/* exported clearAllBlurClasses, setupBlurObserver, applyBlur, toggleBlur, clearBlur */
/* global addBlurStyles, blurContact */
// Blur lifecycle: apply/toggle/clear, mutation observer and re-apply monitoring.

// Clear all blur classes
function clearAllBlurClasses() {
    document.querySelectorAll('.wa-blur-target, .wa-blur-image').forEach((el) => {
        el.classList.remove('wa-blur-target', 'wa-blur-image');
    });
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

// Continuous monitoring to ensure blur stays applied
function startBlurMonitoring() {
    setInterval(() => {
        const blurredElements = document.querySelectorAll('.wa-blur-target, .wa-blur-image');
        blurredElements.forEach((el) => {
            const computedStyle = window.getComputedStyle(el);

            // Hide mode removes elements from the page; no blur to reapply.
            if (computedStyle.display === 'none') return;

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
