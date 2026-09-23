/* exported blurContact */
/* global NAVIGATION_EXCLUSIONS, addBlurStyles, isInTargetChat, isNavigationChrome */
// Per-contact blur application across chat list, header and messages.

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
        // Navigation icons and labels (data-testid, text or ligature like "ic-call")
        if (isNavigationChrome(element.getAttribute('data-testid')) || isNavigationChrome(element.textContent)) {
            return true;
        }

        // Exclude navigation elements by class names that might contain these identifiers
        const className = element.className;
        if (className && typeof className === 'string') {
            for (let excludedClass of NAVIGATION_EXCLUSIONS) {
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
        // Hide mode relies on display:none; the blur fallback must not fight it.
        if (blurTypeSettings.type === 'hide') return;

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
