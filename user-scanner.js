/* exported scanForUsers, toggleUserBlur, removeUserBlur */
/* global NAVIGATION_EXCLUSIONS, blurContact, findConversationHeader, isInTargetChat, isNavigationChrome, setupBlurObserver */
// Scan visible users and toggle/remove blur for a single user.

// Scan for users currently visible on the page
function scanForUsers() {
    const users = [];
    const seenNames = new Set();

    // Function to check if an element should be excluded from user scanning
    function shouldExcludeFromScan(element) {
        // Navigation icons and labels (data-testid, title, text or ligature like "ic-call")
        if (
            isNavigationChrome(element.getAttribute('data-testid')) ||
            isNavigationChrome(element.getAttribute('title')) ||
            isNavigationChrome(element.textContent)
        ) {
            return true;
        }

        // Navigation elements can also carry the identifiers in their class names
        const className = element.className;
        if (className && typeof className === 'string') {
            for (let identifier of NAVIGATION_EXCLUSIONS) {
                if (className.includes(identifier)) {
                    return true;
                }
            }
        }

        // WhatsApp renders its chrome as buttons and links (nav rail, chat filters,
        // composer); contact rows are plain divs, so their contents are never contacts.
        if (element.closest('button, a')) {
            return true;
        }

        // Exclude single character text content (likely navigation icons)
        const textContent = element.textContent && element.textContent.trim();
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
            if (isNavigationChrome(title)) {
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
    const header = findConversationHeader();
    if (header) {
        const headerElements = header.querySelectorAll('*');
        headerElements.forEach((el) => {
            const text = el.textContent && el.textContent.trim();
            if (text && text.length > 0 && text.length < 50 && !seenNames.has(text) && !shouldExcludeFromScan(el)) {
                // Exclude navigation elements by their text content
                if (isNavigationChrome(text)) {
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
            el.classList.remove('wa-blur-target', 'wa-blur-image', 'wa-hidden-row');
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
