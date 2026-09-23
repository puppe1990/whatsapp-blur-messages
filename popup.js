document.addEventListener('DOMContentLoaded', function () {
    const contactNameInput = document.getElementById('contactName');
    const applyBtn = document.getElementById('applyBtn');
    const toggleBtn = document.getElementById('toggleBtn');
    const clearBtn = document.getElementById('clearBtn');
    const statusMessage = document.getElementById('statusMessage');

    // Tab elements
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // Users management elements
    const scanUsersBtn = document.getElementById('scanUsersBtn');
    const blurAllUsersBtn = document.getElementById('blurAllUsersBtn');
    const unblurAllUsersBtn = document.getElementById('unblurAllUsersBtn');
    const clearAllUsersBtn = document.getElementById('clearAllUsersBtn');
    const usersList = document.getElementById('usersList');

    // Search elements
    const userSearchInput = document.getElementById('userSearchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');

    // Export elements
    const exportStartBtn = document.getElementById('exportStartBtn');
    const exportRefreshBtn = document.getElementById('exportRefreshBtn');
    const exportClearBtn = document.getElementById('exportClearBtn');
    const exportJsonBtn = document.getElementById('exportJsonBtn');
    const exportTxtBtn = document.getElementById('exportTxtBtn');
    const exportHtmlBtn = document.getElementById('exportHtmlBtn');
    const exportZipBtn = document.getElementById('exportZipBtn');
    const exportMessageCount = document.getElementById('exportMessageCount');

    // Checkbox elements
    const checkboxes = {
        chatListName: document.getElementById('chatListName'),
        chatListMessage: document.getElementById('chatListMessage'),
        chatListAvatar: document.getElementById('chatListAvatar'),
        headerName: document.getElementById('headerName'),
        headerAvatar: document.getElementById('headerAvatar'),
        messageText: document.getElementById('messageText'),
        messageImages: document.getElementById('messageImages')
    };

    // Blur type elements
    const blurTypeRadios = document.querySelectorAll('input[name="blurType"]');
    const customBlurSettings = document.getElementById('customBlurSettings');
    const blurIntensity = document.getElementById('blurIntensity');
    const blurIntensityValue = document.getElementById('blurIntensityValue');
    const overlayColor = document.getElementById('overlayColor');
    const overlayOpacity = document.getElementById('overlayOpacity');
    const overlayOpacityValue = document.getElementById('overlayOpacityValue');

    // Load saved settings
    loadSettings();
    loadUsersList();

    // Tab functionality
    tabBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            switchTab(targetTab);
        });
    });

    // Event listeners
    applyBtn.addEventListener('click', applyBlur);
    toggleBtn.addEventListener('click', toggleBlur);
    clearBtn.addEventListener('click', clearBlur);

    // Users management event listeners
    scanUsersBtn.addEventListener('click', scanForUsers);
    blurAllUsersBtn.addEventListener('click', blurAllUsers);
    unblurAllUsersBtn.addEventListener('click', unblurAllUsers);
    clearAllUsersBtn.addEventListener('click', clearAllUsers);

    // Search event listeners
    userSearchInput.addEventListener('input', handleUserSearch);
    clearSearchBtn.addEventListener('click', clearUserSearch);

    // Export event listeners
    if (exportStartBtn) {
        exportStartBtn.addEventListener('click', startExportCapture);
    }
    if (exportRefreshBtn) {
        exportRefreshBtn.addEventListener('click', refreshExportCount);
    }
    if (exportClearBtn) {
        exportClearBtn.addEventListener('click', clearExportBuffer);
    }
    if (exportJsonBtn) {
        exportJsonBtn.addEventListener('click', downloadExportJson);
    }
    if (exportTxtBtn) {
        exportTxtBtn.addEventListener('click', downloadExportTxt);
    }
    if (exportHtmlBtn) {
        exportHtmlBtn.addEventListener('click', downloadExportHtml);
    }
    if (exportZipBtn) {
        exportZipBtn.addEventListener('click', downloadExportZip);
    }

    // Save settings when checkboxes change
    Object.keys(checkboxes).forEach((key) => {
        checkboxes[key].addEventListener('change', saveSettings);
    });

    // Save contact name when input changes
    contactNameInput.addEventListener('input', saveSettings);

    // Blur type event listeners
    blurTypeRadios.forEach((radio) => {
        radio.addEventListener('change', handleBlurTypeChange);
    });

    // Custom blur settings event listeners
    if (blurIntensity) {
        blurIntensity.addEventListener('input', updateBlurIntensityValue);
    }
    if (overlayOpacity) {
        overlayOpacity.addEventListener('input', updateOverlayOpacityValue);
    }
    if (overlayColor) {
        overlayColor.addEventListener('input', saveSettings);
    }

    function loadSettings() {
        chrome.storage.sync.get(
            ['contactName', 'blurSettings', 'isEnabled', 'blurType', 'customBlurSettings'],
            function (result) {
                if (result.contactName) {
                    contactNameInput.value = result.contactName;
                }

                if (result.blurSettings) {
                    Object.keys(result.blurSettings).forEach((key) => {
                        if (checkboxes[key]) {
                            checkboxes[key].checked = result.blurSettings[key];
                        }
                    });
                }

                // Load blur type settings
                if (result.blurType) {
                    const blurTypeRadio = document.querySelector(`input[name="blurType"][value="${result.blurType}"]`);
                    if (blurTypeRadio) {
                        blurTypeRadio.checked = true;
                        handleBlurTypeChange();
                    }
                }

                // Load custom blur settings
                if (result.customBlurSettings) {
                    if (blurIntensity) {
                        blurIntensity.value = result.customBlurSettings.intensity || 25;
                        updateBlurIntensityValue();
                    }
                    if (overlayColor) {
                        overlayColor.value = result.customBlurSettings.color || '#ff0000';
                    }
                    if (overlayOpacity) {
                        overlayOpacity.value = result.customBlurSettings.opacity || 0.8;
                        updateOverlayOpacityValue();
                    }
                }

                updateToggleButton(result.isEnabled);
            }
        );
    }

    function saveSettings() {
        const selectedBlurType = document.querySelector('input[name="blurType"]:checked');
        const blurType = selectedBlurType ? selectedBlurType.value : 'standard';

        const settings = {
            contactName: contactNameInput.value.trim(),
            blurSettings: {
                chatListName: checkboxes.chatListName.checked,
                chatListMessage: checkboxes.chatListMessage.checked,
                chatListAvatar: checkboxes.chatListAvatar.checked,
                headerName: checkboxes.headerName.checked,
                headerAvatar: checkboxes.headerAvatar.checked,
                messageText: checkboxes.messageText.checked,
                messageImages: checkboxes.messageImages.checked
            },
            blurType: blurType
        };

        // Save custom blur settings if custom type is selected
        if (blurType === 'custom') {
            settings.customBlurSettings = {
                intensity: blurIntensity ? parseInt(blurIntensity.value) : 25,
                color: overlayColor ? overlayColor.value : '#ff0000',
                opacity: overlayOpacity ? parseFloat(overlayOpacity.value) : 0.8
            };
        }

        chrome.storage.sync.set(settings);
    }

    function getSelectedBlurSettings() {
        return {
            chatListName: checkboxes.chatListName.checked,
            chatListMessage: checkboxes.chatListMessage.checked,
            chatListAvatar: checkboxes.chatListAvatar.checked,
            headerName: checkboxes.headerName.checked,
            headerAvatar: checkboxes.headerAvatar.checked,
            messageText: checkboxes.messageText.checked,
            messageImages: checkboxes.messageImages.checked
        };
    }

    function getSelectedBlurTypeSettings() {
        const selectedBlurType = document.querySelector('input[name="blurType"]:checked');
        const blurType = selectedBlurType ? selectedBlurType.value : 'standard';

        if (blurType !== 'custom') {
            return { type: blurType };
        }

        return {
            type: 'custom',
            intensity: blurIntensity ? parseInt(blurIntensity.value) : 25,
            color: overlayColor ? overlayColor.value : '#ff0000',
            opacity: overlayOpacity ? parseFloat(overlayOpacity.value) : 0.8
        };
    }

    function handleBlurTypeChange() {
        const selectedBlurType = document.querySelector('input[name="blurType"]:checked');
        const blurType = selectedBlurType ? selectedBlurType.value : 'standard';

        // Show/hide custom blur settings
        if (customBlurSettings) {
            if (blurType === 'custom') {
                customBlurSettings.style.display = 'block';
            } else {
                customBlurSettings.style.display = 'none';
            }
        }

        // Save settings when blur type changes
        saveSettings();
    }

    function updateBlurIntensityValue() {
        if (blurIntensity && blurIntensityValue) {
            blurIntensityValue.textContent = blurIntensity.value + 'px';
            saveSettings();
        }
    }

    function updateOverlayOpacityValue() {
        if (overlayOpacity && overlayOpacityValue) {
            const opacity = Math.round(overlayOpacity.value * 100);
            overlayOpacityValue.textContent = opacity + '%';
            saveSettings();
        }
    }

    function updateToggleButton(isEnabled) {
        if (isEnabled) {
            toggleBtn.textContent = 'Disable Blur';
            toggleBtn.classList.remove('btn-secondary');
            toggleBtn.classList.add('btn-danger');
        } else {
            toggleBtn.textContent = 'Enable Blur';
            toggleBtn.classList.remove('btn-danger');
            toggleBtn.classList.add('btn-secondary');
        }
    }

    function showStatus(message, type = 'info') {
        statusMessage.textContent = message;
        statusMessage.className = `status-message ${type}`;

        // Clear status after 3 seconds
        setTimeout(() => {
            statusMessage.textContent = '';
            statusMessage.className = 'status-message';
        }, 3000);
    }

    function applyBlur() {
        const contactName = contactNameInput.value.trim();

        if (!contactName) {
            showStatus('Please enter a contact name', 'error');
            return;
        }

        // Save settings first
        saveSettings();

        // Check if we're on WhatsApp Web
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            const currentTab = tabs[0];

            if (!currentTab.url.includes('web.whatsapp.com')) {
                showStatus('Please open WhatsApp Web first', 'error');
                return;
            }

            // Send message to content script with the selected settings
            chrome.tabs.sendMessage(
                currentTab.id,
                {
                    action: 'applyBlur',
                    contactName: contactName,
                    blurSettings: getSelectedBlurSettings(),
                    blurTypeSettings: getSelectedBlurTypeSettings()
                },
                function (response) {
                    if (chrome.runtime.lastError) {
                        showStatus('Error: ' + chrome.runtime.lastError.message, 'error');
                    } else if (response && response.success) {
                        showStatus('Blur applied successfully!', 'success');
                        chrome.storage.sync.set({ isEnabled: true });
                        updateToggleButton(true);
                    } else {
                        showStatus('Failed to apply blur', 'error');
                    }
                }
            );
        });
    }

    function toggleBlur() {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            const currentTab = tabs[0];

            if (!currentTab.url.includes('web.whatsapp.com')) {
                showStatus('Please open WhatsApp Web first', 'error');
                return;
            }

            chrome.tabs.sendMessage(
                currentTab.id,
                {
                    action: 'toggleBlur'
                },
                function (response) {
                    if (chrome.runtime.lastError) {
                        showStatus('Error: ' + chrome.runtime.lastError.message, 'error');
                    } else if (response && response.success) {
                        const isEnabled = response.isEnabled;
                        showStatus(isEnabled ? 'Blur enabled' : 'Blur disabled', 'success');
                        chrome.storage.sync.set({ isEnabled: isEnabled });
                        updateToggleButton(isEnabled);
                    } else {
                        showStatus('Failed to toggle blur', 'error');
                    }
                }
            );
        });
    }

    function clearBlur() {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            const currentTab = tabs[0];

            if (!currentTab.url.includes('web.whatsapp.com')) {
                showStatus('Please open WhatsApp Web first', 'error');
                return;
            }

            chrome.tabs.sendMessage(
                currentTab.id,
                {
                    action: 'clearBlur'
                },
                function (response) {
                    if (chrome.runtime.lastError) {
                        showStatus('Error: ' + chrome.runtime.lastError.message, 'error');
                    } else if (response && response.success) {
                        showStatus('All blur cleared', 'success');
                        chrome.storage.sync.set({ isEnabled: false });
                        updateToggleButton(false);
                    } else {
                        showStatus('Failed to clear blur', 'error');
                    }
                }
            );
        });
    }

    function getCurrentWhatsAppTab(callback) {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            const currentTab = tabs[0];
            if (!currentTab || !currentTab.url || !currentTab.url.includes('web.whatsapp.com')) {
                showStatus('Please open WhatsApp Web first', 'error');
                callback(null);
                return;
            }
            callback(currentTab);
        });
    }

    function updateExportCount(count) {
        if (!exportMessageCount) return;
        exportMessageCount.textContent = String(Math.max(0, Number(count) || 0));
    }

    function sendExportAction(action, extraPayload, callback) {
        getCurrentWhatsAppTab((tab) => {
            if (!tab) return;

            chrome.tabs.sendMessage(
                tab.id,
                {
                    action: action,
                    ...(extraPayload || {})
                },
                function (response) {
                    if (chrome.runtime.lastError) {
                        showStatus('Content script not loaded. Refresh WhatsApp Web.', 'error');
                        return;
                    }
                    callback(response || {});
                }
            );
        });
    }

    function startExportCapture() {
        sendExportAction('wppExportStart', null, function (response) {
            if (response.success) {
                showStatus('Message capture started', 'success');
                refreshExportCount();
                return;
            }
            showStatus(response.error || 'Failed to start capture', 'error');
        });
    }

    function refreshExportCount() {
        sendExportAction('wppExportGet', {}, function (response) {
            if (response.success) {
                updateExportCount(response.count || 0);
                showStatus(`Buffered ${response.count || 0} messages`, 'info');
                return;
            }
            showStatus(response.error || 'Failed to read buffer', 'error');
        });
    }

    function clearExportBuffer() {
        sendExportAction('wppExportClear', null, function (response) {
            if (response.success) {
                updateExportCount(0);
                showStatus('Buffer cleared', 'success');
                return;
            }
            showStatus(response.error || 'Failed to clear buffer', 'error');
        });
    }

    function downloadExportJson() {
        sendExportAction('wppExportDownload', { format: 'json' }, function (response) {
            if (response.success) {
                showStatus('JSON download started', 'success');
                return;
            }
            showStatus(response.error || 'Failed to download JSON', 'error');
        });
    }

    function downloadExportTxt() {
        sendExportAction('wppExportDownload', { format: 'txt' }, function (response) {
            if (response.success) {
                showStatus('TXT download started', 'success');
                return;
            }
            showStatus(response.error || 'Failed to download TXT', 'error');
        });
    }

    function downloadExportHtml() {
        sendExportAction('wppExportDownload', { format: 'html' }, function (response) {
            if (response.success) {
                showStatus('HTML download started', 'success');
                return;
            }
            showStatus(response.error || 'Failed to download HTML', 'error');
        });
    }

    function downloadExportZip() {
        if (exportZipBtn) {
            exportZipBtn.disabled = true;
            exportZipBtn.innerHTML = '<span class="loading"></span> Building ZIP...';
        }

        sendExportAction('wppExportDownload', { format: 'zip' }, function (response) {
            if (exportZipBtn) {
                exportZipBtn.disabled = false;
                exportZipBtn.innerHTML = '🗜️ Download ZIP (Media)';
            }

            if (response.success) {
                showStatus('ZIP download started', 'success');
                return;
            }
            showStatus(response.error || 'Failed to download ZIP', 'error');
        });
    }

    // Check if WhatsApp Web is open when popup loads
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        const currentTab = tabs[0];

        if (!currentTab.url.includes('web.whatsapp.com')) {
            showStatus('Open WhatsApp Web to use this extension', 'info');
        } else {
            refreshExportCount();
        }
    });

    // Tab switching function
    function switchTab(tabName) {
        // Remove active class from all tabs and contents
        tabBtns.forEach((btn) => btn.classList.remove('active'));
        tabContents.forEach((content) => content.classList.remove('active'));

        // Add active class to selected tab and content
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');
    }

    // Load users list from storage
    function loadUsersList() {
        chrome.storage.sync.get(['managedUsers'], function (result) {
            const users = result.managedUsers || [];
            displayUsersList(users);
        });
    }

    // Display users in the list
    function displayUsersList(users) {
        if (users.length === 0) {
            usersList.innerHTML = `
                <div class="no-users-message">
                    <p>Click "Scan for Users" to detect all users currently visible on WhatsApp Web</p>
                </div>
            `;
            return;
        }

        usersList.innerHTML = users
            .map(
                (user) => `
            <div class="user-item" data-username="${user.name}">
                <div class="user-info">
                    <div class="user-avatar">${user.name.charAt(0).toUpperCase()}</div>
                    <div class="user-details">
                        <div class="user-name">${user.name}</div>
                        <div class="user-status">${user.isBlurred ? 'Blurred' : 'Visible'}</div>
                        <div class="user-blur-type">${user.blurTypeSettings ? user.blurTypeSettings.type : 'standard'}</div>
                    </div>
                </div>
                <div class="user-controls">
                    <div class="user-toggle ${user.isBlurred ? 'active' : ''}" data-username="${user.name}"></div>
                    <button class="user-settings" data-username="${user.name}" title="User settings">⚙️</button>
                    <button class="user-remove" data-username="${user.name}" title="Remove user">×</button>
                </div>
            </div>
        `
            )
            .join('');

        // Add event listeners to the newly created elements
        addUserEventListeners();
    }

    // Add event listeners to user controls
    function addUserEventListeners() {
        // Toggle switches
        const toggles = usersList.querySelectorAll('.user-toggle');
        toggles.forEach((toggle) => {
            toggle.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();

                const userName = this.getAttribute('data-username');
                console.log('Toggle clicked for user:', userName);

                // Add visual feedback
                this.style.opacity = '0.5';
                setTimeout(() => {
                    this.style.opacity = '1';
                }, 200);

                toggleUserBlur(userName);
            });
        });

        // Settings buttons
        const settingsButtons = usersList.querySelectorAll('.user-settings');
        settingsButtons.forEach((button) => {
            button.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();

                const userName = this.getAttribute('data-username');
                openUserSettings(userName);
            });
        });

        // Remove buttons
        const removeButtons = usersList.querySelectorAll('.user-remove');
        removeButtons.forEach((button) => {
            button.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();

                const userName = this.getAttribute('data-username');
                removeUser(userName);
            });
        });
    }

    // Scan for users on WhatsApp Web
    function scanForUsers() {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            const currentTab = tabs[0];

            if (!currentTab.url.includes('web.whatsapp.com')) {
                showStatus('Please open WhatsApp Web first', 'error');
                return;
            }

            // Show loading state
            scanUsersBtn.innerHTML = '<span class="loading"></span> Scanning...';
            scanUsersBtn.disabled = true;

            // First, try to ping the content script to see if it's loaded
            chrome.tabs.sendMessage(
                currentTab.id,
                {
                    action: 'ping'
                },
                function (response) {
                    if (chrome.runtime.lastError) {
                        console.error('Content script not loaded:', chrome.runtime.lastError);
                        scanUsersBtn.innerHTML = '🔍 Scan for Users';
                        scanUsersBtn.disabled = false;
                        showStatus('Content script not loaded. Please refresh the page.', 'error');
                        return;
                    }

                    // If ping successful, proceed with scan
                    chrome.tabs.sendMessage(
                        currentTab.id,
                        {
                            action: 'scanUsers'
                        },
                        function (response) {
                            scanUsersBtn.innerHTML = '🔍 Scan for Users';
                            scanUsersBtn.disabled = false;

                            if (chrome.runtime.lastError) {
                                showStatus('Error: ' + chrome.runtime.lastError.message, 'error');
                            } else if (response && response.success) {
                                const users = response.users || [];
                                saveUsersList(users);
                                displayUsersList(users);
                                showStatus(`Found ${users.length} users`, 'success');
                            } else {
                                showStatus('Failed to scan for users', 'error');
                            }
                        }
                    );
                }
            );
        });
    }

    // Save users list to storage
    function saveUsersList(users) {
        chrome.storage.sync.set({ managedUsers: users });
    }

    // Blur all users
    function blurAllUsers() {
        console.log('🔒 Popup: blurAllUsers function called');
        const startTime = performance.now();

        chrome.storage.sync.get(['managedUsers'], function (result) {
            const users = result.managedUsers || [];
            console.log('📊 Popup: Retrieved users from storage:', users);

            if (users.length === 0) {
                console.warn('⚠️ Popup: No users found in storage');
                showStatus('No users found. Please scan for users first.', 'error');
                return;
            }

            console.log(`📋 Popup: Processing ${users.length} users for blur operation`);

            // Show loading state
            blurAllUsersBtn.innerHTML = '<span class="loading"></span> Blurring...';
            blurAllUsersBtn.disabled = true;
            console.log('🔄 Popup: Set loading state for blur button');

            // Per-user settings win; users without one get the selected blur type
            const selectedBlurSettings = getSelectedBlurSettings();
            const selectedBlurTypeSettings = getSelectedBlurTypeSettings();
            const updatedUsers = users.map((user) => ({
                ...user,
                isBlurred: true,
                blurSettings: user.blurSettings || selectedBlurSettings,
                blurTypeSettings: user.blurTypeSettings || selectedBlurTypeSettings
            }));

            console.log('✅ Popup: Updated all users to blurred state:', updatedUsers);
            saveUsersList(updatedUsers);
            displayUsersList(updatedUsers);
            console.log('💾 Popup: Saved updated users list to storage');

            // Apply blur to all users on WhatsApp Web
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                const currentTab = tabs[0];
                console.log('🔍 Popup: Current tab info:', {
                    id: currentTab.id,
                    url: currentTab.url,
                    title: currentTab.title
                });

                if (currentTab.url.includes('web.whatsapp.com')) {
                    console.log('✅ Popup: WhatsApp Web tab confirmed, checking content script');

                    // First, try to ping the content script to see if it's loaded
                    chrome.tabs.sendMessage(
                        currentTab.id,
                        {
                            action: 'ping'
                        },
                        function (response) {
                            if (chrome.runtime.lastError) {
                                console.error('❌ Popup: Content script not loaded:', chrome.runtime.lastError);
                                blurAllUsersBtn.innerHTML = '🔒 Blur All Users';
                                blurAllUsersBtn.disabled = false;
                                showStatus('Content script not loaded. Please refresh the page.', 'error');
                                return;
                            }

                            console.log('✅ Popup: Content script confirmed, sending blur message');

                            // Set a timeout to reset button state if no response
                            const timeout = setTimeout(() => {
                                console.warn('⏰ Popup: Timeout reached, resetting button state');
                                blurAllUsersBtn.innerHTML = '🔒 Blur All Users';
                                blurAllUsersBtn.disabled = false;
                                showStatus('Blur operation completed (timeout)', 'success');
                            }, 5000); // 5 second timeout

                            console.log('📤 Popup: Sending blurAllUsers message to content script:', {
                                action: 'blurAllUsers',
                                users: updatedUsers,
                                userCount: updatedUsers.length
                            });

                            // Send a single message to blur all users at once
                            chrome.tabs.sendMessage(
                                currentTab.id,
                                {
                                    action: 'blurAllUsers',
                                    users: updatedUsers
                                },
                                function (response) {
                                    const endTime = performance.now();
                                    const totalTime = (endTime - startTime).toFixed(2);

                                    // Clear timeout
                                    clearTimeout(timeout);
                                    console.log(`⏱️ Popup: Blur operation completed in ${totalTime}ms`);

                                    // Reset button state
                                    blurAllUsersBtn.innerHTML = '🔒 Blur All Users';
                                    blurAllUsersBtn.disabled = false;
                                    console.log('🔄 Popup: Reset button state');

                                    if (chrome.runtime.lastError) {
                                        console.error(
                                            '❌ Popup: Error sending blur all message:',
                                            chrome.runtime.lastError
                                        );
                                        showStatus('Error: ' + chrome.runtime.lastError.message, 'error');
                                    } else if (response && response.success) {
                                        console.log('✅ Popup: Blur all operation successful:', response);
                                        showStatus(`Blurred ${updatedUsers.length} users`, 'success');
                                    } else {
                                        console.error('❌ Popup: Blur all operation failed:', response);
                                        showStatus('Failed to blur all users', 'error');
                                    }
                                }
                            );
                        }
                    );
                } else {
                    console.warn('⚠️ Popup: Not on WhatsApp Web, current URL:', currentTab.url);
                    blurAllUsersBtn.innerHTML = '🔒 Blur All Users';
                    blurAllUsersBtn.disabled = false;
                    showStatus('Please open WhatsApp Web first', 'error');
                }
            });
        });
    }

    // Unblur all users
    function unblurAllUsers() {
        chrome.storage.sync.get(['managedUsers'], function (result) {
            const users = result.managedUsers || [];

            if (users.length === 0) {
                showStatus('No users found. Please scan for users first.', 'error');
                return;
            }

            // Show loading state
            unblurAllUsersBtn.innerHTML = '<span class="loading"></span> Unblurring...';
            unblurAllUsersBtn.disabled = true;

            // Update all users to be unblurred
            const updatedUsers = users.map((user) => ({
                ...user,
                isBlurred: false
            }));

            saveUsersList(updatedUsers);
            displayUsersList(updatedUsers);

            // Apply unblur to all users on WhatsApp Web
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                const currentTab = tabs[0];
                if (currentTab.url.includes('web.whatsapp.com')) {
                    // Set a timeout to reset button state if no response
                    const timeout = setTimeout(() => {
                        unblurAllUsersBtn.innerHTML = '👁️ Unblur All Users';
                        unblurAllUsersBtn.disabled = false;
                        showStatus('Unblur operation completed', 'success');
                    }, 5000); // 5 second timeout

                    // Send a single message to unblur all users at once
                    chrome.tabs.sendMessage(
                        currentTab.id,
                        {
                            action: 'unblurAllUsers',
                            users: updatedUsers
                        },
                        function (response) {
                            // Clear timeout
                            clearTimeout(timeout);

                            // Reset button state
                            unblurAllUsersBtn.innerHTML = '👁️ Unblur All Users';
                            unblurAllUsersBtn.disabled = false;

                            if (chrome.runtime.lastError) {
                                console.error('Error sending unblur all message:', chrome.runtime.lastError);
                                showStatus('Error: ' + chrome.runtime.lastError.message, 'error');
                            } else if (response && response.success) {
                                showStatus(`Unblurred ${updatedUsers.length} users`, 'success');
                            } else {
                                showStatus('Failed to unblur all users', 'error');
                            }
                        }
                    );
                } else {
                    unblurAllUsersBtn.innerHTML = '👁️ Unblur All Users';
                    unblurAllUsersBtn.disabled = false;
                    showStatus('Please open WhatsApp Web first', 'error');
                }
            });
        });
    }

    // Clear all users
    function clearAllUsers() {
        if (confirm('Are you sure you want to remove all users from the list?')) {
            chrome.storage.sync.remove(['managedUsers']);
            displayUsersList([]);
            showStatus('All users removed', 'success');

            // Also clear blur from WhatsApp Web
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                const currentTab = tabs[0];
                if (currentTab.url.includes('web.whatsapp.com')) {
                    chrome.tabs.sendMessage(currentTab.id, {
                        action: 'clearAllUsers'
                    });
                }
            });
        }
    }

    // Toggle blur for a specific user
    function toggleUserBlur(userName) {
        console.log('Toggle blur called for user:', userName);

        chrome.storage.sync.get(['managedUsers'], function (result) {
            const users = result.managedUsers || [];
            const userIndex = users.findIndex((user) => user.name === userName);

            console.log('Found user at index:', userIndex, 'Current users:', users);

            if (userIndex !== -1) {
                const user = users[userIndex];
                user.isBlurred = !user.isBlurred;
                user.blurSettings = user.blurSettings || getSelectedBlurSettings();
                user.blurTypeSettings = user.blurTypeSettings || getSelectedBlurTypeSettings();
                console.log('Updated user blur status:', user.isBlurred);

                saveUsersList(users);
                displayUsersList(users);

                // Apply blur to WhatsApp Web
                chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                    const currentTab = tabs[0];
                    if (currentTab.url.includes('web.whatsapp.com')) {
                        console.log('Sending message to content script:', {
                            action: 'toggleUserBlur',
                            userName: userName,
                            isBlurred: users[userIndex].isBlurred
                        });

                        chrome.tabs.sendMessage(
                            currentTab.id,
                            {
                                action: 'toggleUserBlur',
                                userName: userName,
                                isBlurred: user.isBlurred,
                                blurSettings: user.blurSettings,
                                blurTypeSettings: user.blurTypeSettings
                            },
                            function (response) {
                                if (chrome.runtime.lastError) {
                                    console.error('Error sending message:', chrome.runtime.lastError);
                                    showStatus('Error: ' + chrome.runtime.lastError.message, 'error');
                                } else {
                                    console.log('Message sent successfully:', response);
                                }
                            }
                        );
                    } else {
                        showStatus('Please open WhatsApp Web first', 'error');
                    }
                });

                showStatus(`${userName} ${user.isBlurred ? 'blurred' : 'unblurred'}`, 'success');
            } else {
                console.error('User not found:', userName);
                showStatus('User not found', 'error');
            }
        });
    }

    // Open user settings modal
    function openUserSettings(userName) {
        chrome.storage.sync.get(['managedUsers'], function (result) {
            const users = result.managedUsers || [];
            const user = users.find((u) => u.name === userName);

            if (!user) {
                showStatus('User not found', 'error');
                return;
            }

            // Create modal for user settings
            const modal = document.createElement('div');
            modal.className = 'user-settings-modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Settings for ${userName}</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="setting-group">
                            <label>Blur Type:</label>
                            <select id="userBlurType" class="blur-type-select">
                                <option value="standard" ${user.blurTypeSettings?.type === 'standard' ? 'selected' : ''}>Standard Blur</option>
                                <option value="pixelated" ${user.blurTypeSettings?.type === 'pixelated' ? 'selected' : ''}>Pixelated</option>
                                <option value="blackout" ${user.blurTypeSettings?.type === 'blackout' ? 'selected' : ''}>Blackout</option>
                                <option value="invisible" ${user.blurTypeSettings?.type === 'invisible' ? 'selected' : ''}>Invisible</option>
                                <option value="hide" ${user.blurTypeSettings?.type === 'hide' ? 'selected' : ''}>Hide</option>
                                <option value="custom" ${user.blurTypeSettings?.type === 'custom' ? 'selected' : ''}>Custom</option>
                            </select>
                        </div>
                        <div class="setting-group">
                            <label>Blur Elements:</label>
                            <div class="checkbox-group">
                                <label><input type="checkbox" ${user.blurSettings?.chatListName ? 'checked' : ''}> Chat List Name</label>
                                <label><input type="checkbox" ${user.blurSettings?.chatListMessage ? 'checked' : ''}> Chat List Message</label>
                                <label><input type="checkbox" ${user.blurSettings?.chatListAvatar ? 'checked' : ''}> Chat List Avatar</label>
                                <label><input type="checkbox" ${user.blurSettings?.headerName ? 'checked' : ''}> Header Name</label>
                                <label><input type="checkbox" ${user.blurSettings?.headerAvatar ? 'checked' : ''}> Header Avatar</label>
                                <label><input type="checkbox" ${user.blurSettings?.messageText ? 'checked' : ''}> Message Text</label>
                                <label><input type="checkbox" ${user.blurSettings?.messageImages ? 'checked' : ''}> Message Images</label>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary modal-cancel">Cancel</button>
                        <button class="btn btn-primary modal-save">Save</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // Event listeners for modal
            modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
            modal.querySelector('.modal-cancel').addEventListener('click', () => modal.remove());
            modal.querySelector('.modal-save').addEventListener('click', () => {
                saveUserSettings(userName, modal);
                modal.remove();
            });

            // Close modal when clicking outside
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                }
            });
        });
    }

    // Save user settings
    function saveUserSettings(userName, modal) {
        const blurType = modal.querySelector('#userBlurType').value;
        const checkboxes = modal.querySelectorAll('.checkbox-group input[type="checkbox"]');

        const blurSettings = {
            chatListName: checkboxes[0].checked,
            chatListMessage: checkboxes[1].checked,
            chatListAvatar: checkboxes[2].checked,
            headerName: checkboxes[3].checked,
            headerAvatar: checkboxes[4].checked,
            messageText: checkboxes[5].checked,
            messageImages: checkboxes[6].checked
        };

        const blurTypeSettings = { type: blurType };

        chrome.storage.sync.get(['managedUsers'], function (result) {
            const users = result.managedUsers || [];
            const userIndex = users.findIndex((u) => u.name === userName);

            if (userIndex !== -1) {
                users[userIndex].blurSettings = blurSettings;
                users[userIndex].blurTypeSettings = blurTypeSettings;

                saveUsersList(users);
                displayUsersList(users);

                // Apply new settings to WhatsApp Web
                chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                    const currentTab = tabs[0];
                    if (currentTab.url.includes('web.whatsapp.com')) {
                        chrome.tabs.sendMessage(currentTab.id, {
                            action: 'toggleUserBlur',
                            userName: userName,
                            isBlurred: users[userIndex].isBlurred,
                            blurSettings: blurSettings,
                            blurTypeSettings: blurTypeSettings
                        });
                    }
                });

                showStatus(`Settings updated for ${userName}`, 'success');
            }
        });
    }

    // Remove a specific user
    function removeUser(userName) {
        if (confirm(`Remove ${userName} from the list?`)) {
            chrome.storage.sync.get(['managedUsers'], function (result) {
                const users = result.managedUsers || [];
                const filteredUsers = users.filter((user) => user.name !== userName);
                saveUsersList(filteredUsers);
                displayUsersList(filteredUsers);

                // Remove blur from WhatsApp Web
                chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                    const currentTab = tabs[0];
                    if (currentTab.url.includes('web.whatsapp.com')) {
                        chrome.tabs.sendMessage(currentTab.id, {
                            action: 'removeUserBlur',
                            userName: userName
                        });
                    }
                });

                showStatus(`${userName} removed`, 'success');
            });
        }
    }

    // Search functionality
    function handleUserSearch() {
        const searchTerm = userSearchInput.value.trim().toLowerCase();

        // Show/hide clear button
        if (searchTerm.length > 0) {
            clearSearchBtn.classList.add('visible');
        } else {
            clearSearchBtn.classList.remove('visible');
        }

        // Filter and display users
        filterAndDisplayUsers(searchTerm);
    }

    function clearUserSearch() {
        userSearchInput.value = '';
        clearSearchBtn.classList.remove('visible');
        filterAndDisplayUsers('');

        // Clear any search-related status messages
        const statusMessage = document.getElementById('statusMessage');
        if (statusMessage.textContent.includes('Found') || statusMessage.textContent.includes('matching')) {
            statusMessage.textContent = '';
            statusMessage.className = 'status-message';
        }
    }

    function filterAndDisplayUsers(searchTerm) {
        chrome.storage.sync.get(['managedUsers'], function (result) {
            const users = result.managedUsers || [];

            if (searchTerm === '') {
                // Show all users without highlighting
                displayUsersList(users);
            } else {
                // Filter users and highlight matches (case-insensitive)
                const filteredUsers = users.filter((user) =>
                    user.name.toLowerCase().includes(searchTerm.toLowerCase())
                );

                if (filteredUsers.length === 0) {
                    // Show no results message
                    usersList.innerHTML = `
                        <div class="no-users-message">
                            <p>🔍 No users found matching "${searchTerm}"</p>
                            <small>Try a different search term or check spelling</small>
                        </div>
                    `;
                } else {
                    // Display filtered users with highlighting
                    displayUsersListWithHighlight(filteredUsers, searchTerm);

                    // Show search results count
                    showStatus(
                        `Found ${filteredUsers.length} user${filteredUsers.length === 1 ? '' : 's'} matching "${searchTerm}"`,
                        'info'
                    );
                }
            }
        });
    }

    function displayUsersListWithHighlight(users, searchTerm) {
        usersList.innerHTML = users
            .map((user) => {
                const highlightedName = highlightSearchTerm(user.name, searchTerm);
                return `
                <div class="user-item highlighted" data-username="${user.name}">
                    <div class="user-info">
                        <div class="user-avatar">${user.name.charAt(0).toUpperCase()}</div>
                        <div class="user-details">
                            <div class="user-name">${highlightedName}</div>
                            <div class="user-status">${user.isBlurred ? 'Blurred' : 'Visible'}</div>
                            <div class="user-blur-type">${user.blurTypeSettings ? user.blurTypeSettings.type : 'standard'}</div>
                        </div>
                    </div>
                    <div class="user-controls">
                        <div class="user-toggle ${user.isBlurred ? 'active' : ''}" data-username="${user.name}"></div>
                        <button class="user-settings" data-username="${user.name}" title="User settings">⚙️</button>
                        <button class="user-remove" data-username="${user.name}" title="Remove user">×</button>
                    </div>
                </div>
            `;
            })
            .join('');

        // Add event listeners to the newly created elements
        addUserEventListeners();
    }

    function highlightSearchTerm(text, searchTerm) {
        if (!searchTerm) return text;

        const regex = new RegExp(`(${escapeRegExp(searchTerm)})`, 'gi');
        return text.replace(regex, '<span class="search-highlight">$1</span>');
    }

    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
});
