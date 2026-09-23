/* exported blurAllUsers, unblurAllUsers, clearAllUsers */
/* global blurContact, clearAllBlurClasses, setupBlurObserver */
// Bulk user actions: blur/unblur all, full style cleanup and clear list.

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
