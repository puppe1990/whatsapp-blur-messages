document.addEventListener('DOMContentLoaded', function() {
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
    
    // Load saved settings
    loadSettings();
    loadUsersList();
    
    // Tab functionality
    tabBtns.forEach(btn => {
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
    
    // Save settings when checkboxes change
    Object.keys(checkboxes).forEach(key => {
        checkboxes[key].addEventListener('change', saveSettings);
    });
    
    // Save contact name when input changes
    contactNameInput.addEventListener('input', saveSettings);
    
    function loadSettings() {
        chrome.storage.sync.get([
            'contactName',
            'blurSettings',
            'isEnabled'
        ], function(result) {
            if (result.contactName) {
                contactNameInput.value = result.contactName;
            }
            
            if (result.blurSettings) {
                Object.keys(result.blurSettings).forEach(key => {
                    if (checkboxes[key]) {
                        checkboxes[key].checked = result.blurSettings[key];
                    }
                });
            }
            
            updateToggleButton(result.isEnabled);
        });
    }
    
    function saveSettings() {
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
            }
        };
        
        chrome.storage.sync.set(settings);
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
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            const currentTab = tabs[0];
            
            if (!currentTab.url.includes('web.whatsapp.com')) {
                showStatus('Please open WhatsApp Web first', 'error');
                return;
            }
            
            // Send message to content script
            chrome.tabs.sendMessage(currentTab.id, {
                action: 'applyBlur',
                contactName: contactName,
                blurSettings: {
                    chatListName: checkboxes.chatListName.checked,
                    chatListMessage: checkboxes.chatListMessage.checked,
                    chatListAvatar: checkboxes.chatListAvatar.checked,
                    headerName: checkboxes.headerName.checked,
                    headerAvatar: checkboxes.headerAvatar.checked,
                    messageText: checkboxes.messageText.checked,
                    messageImages: checkboxes.messageImages.checked
                }
            }, function(response) {
                if (chrome.runtime.lastError) {
                    showStatus('Error: ' + chrome.runtime.lastError.message, 'error');
                } else if (response && response.success) {
                    showStatus('Blur applied successfully!', 'success');
                    chrome.storage.sync.set({isEnabled: true});
                    updateToggleButton(true);
                } else {
                    showStatus('Failed to apply blur', 'error');
                }
            });
        });
    }
    
    function toggleBlur() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            const currentTab = tabs[0];
            
            if (!currentTab.url.includes('web.whatsapp.com')) {
                showStatus('Please open WhatsApp Web first', 'error');
                return;
            }
            
            chrome.tabs.sendMessage(currentTab.id, {
                action: 'toggleBlur'
            }, function(response) {
                if (chrome.runtime.lastError) {
                    showStatus('Error: ' + chrome.runtime.lastError.message, 'error');
                } else if (response && response.success) {
                    const isEnabled = response.isEnabled;
                    showStatus(isEnabled ? 'Blur enabled' : 'Blur disabled', 'success');
                    chrome.storage.sync.set({isEnabled: isEnabled});
                    updateToggleButton(isEnabled);
                } else {
                    showStatus('Failed to toggle blur', 'error');
                }
            });
        });
    }
    
    function clearBlur() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            const currentTab = tabs[0];
            
            if (!currentTab.url.includes('web.whatsapp.com')) {
                showStatus('Please open WhatsApp Web first', 'error');
                return;
            }
            
            chrome.tabs.sendMessage(currentTab.id, {
                action: 'clearBlur'
            }, function(response) {
                if (chrome.runtime.lastError) {
                    showStatus('Error: ' + chrome.runtime.lastError.message, 'error');
                } else if (response && response.success) {
                    showStatus('All blur cleared', 'success');
                    chrome.storage.sync.set({isEnabled: false});
                    updateToggleButton(false);
                } else {
                    showStatus('Failed to clear blur', 'error');
                }
            });
        });
    }
    
    // Check if WhatsApp Web is open when popup loads
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const currentTab = tabs[0];
        
        if (!currentTab.url.includes('web.whatsapp.com')) {
            showStatus('Open WhatsApp Web to use this extension', 'info');
        }
    });
    
    // Tab switching function
    function switchTab(tabName) {
        // Remove active class from all tabs and contents
        tabBtns.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        // Add active class to selected tab and content
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');
    }
    
    // Load users list from storage
    function loadUsersList() {
        chrome.storage.sync.get(['managedUsers'], function(result) {
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
        
        usersList.innerHTML = users.map(user => `
            <div class="user-item" data-username="${user.name}">
                <div class="user-info">
                    <div class="user-avatar">${user.name.charAt(0).toUpperCase()}</div>
                    <div class="user-name">${user.name}</div>
                    <div class="user-status">${user.isBlurred ? 'Blurred' : 'Visible'}</div>
                </div>
                <div class="user-controls">
                    <div class="user-toggle ${user.isBlurred ? 'active' : ''}" data-username="${user.name}"></div>
                    <button class="user-remove" data-username="${user.name}" title="Remove user">×</button>
                </div>
            </div>
        `).join('');
        
        // Add event listeners to the newly created elements
        addUserEventListeners();
    }
    
    // Add event listeners to user controls
    function addUserEventListeners() {
        // Toggle switches
        const toggles = usersList.querySelectorAll('.user-toggle');
        toggles.forEach(toggle => {
            toggle.addEventListener('click', function(e) {
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
        
        // Remove buttons
        const removeButtons = usersList.querySelectorAll('.user-remove');
        removeButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                const userName = this.getAttribute('data-username');
                removeUser(userName);
            });
        });
    }
    
    // Scan for users on WhatsApp Web
    function scanForUsers() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            const currentTab = tabs[0];
            
            if (!currentTab.url.includes('web.whatsapp.com')) {
                showStatus('Please open WhatsApp Web first', 'error');
                return;
            }
            
            // Show loading state
            scanUsersBtn.innerHTML = '<span class="loading"></span> Scanning...';
            scanUsersBtn.disabled = true;
            
            chrome.tabs.sendMessage(currentTab.id, {
                action: 'scanUsers'
            }, function(response) {
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
            });
        });
    }
    
    // Save users list to storage
    function saveUsersList(users) {
        chrome.storage.sync.set({managedUsers: users});
    }
    
    // Blur all users
    function blurAllUsers() {
        chrome.storage.sync.get(['managedUsers'], function(result) {
            const users = result.managedUsers || [];
            
            if (users.length === 0) {
                showStatus('No users found. Please scan for users first.', 'error');
                return;
            }
            
            // Show loading state
            blurAllUsersBtn.innerHTML = '<span class="loading"></span> Blurring...';
            blurAllUsersBtn.disabled = true;
            
            // Update all users to be blurred
            const updatedUsers = users.map(user => ({
                ...user,
                isBlurred: true
            }));
            
            saveUsersList(updatedUsers);
            displayUsersList(updatedUsers);
            
            // Apply blur to all users on WhatsApp Web
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                const currentTab = tabs[0];
                if (currentTab.url.includes('web.whatsapp.com')) {
                    // Set a timeout to reset button state if no response
                    const timeout = setTimeout(() => {
                        blurAllUsersBtn.innerHTML = '🔒 Blur All Users';
                        blurAllUsersBtn.disabled = false;
                        showStatus('Blur operation completed', 'success');
                    }, 5000); // 5 second timeout
                    
                    // Send a single message to blur all users at once
                    chrome.tabs.sendMessage(currentTab.id, {
                        action: 'blurAllUsers',
                        users: updatedUsers
                    }, function(response) {
                        // Clear timeout
                        clearTimeout(timeout);
                        
                        // Reset button state
                        blurAllUsersBtn.innerHTML = '🔒 Blur All Users';
                        blurAllUsersBtn.disabled = false;
                        
                        if (chrome.runtime.lastError) {
                            console.error('Error sending blur all message:', chrome.runtime.lastError);
                            showStatus('Error: ' + chrome.runtime.lastError.message, 'error');
                        } else if (response && response.success) {
                            showStatus(`Blurred ${updatedUsers.length} users`, 'success');
                        } else {
                            showStatus('Failed to blur all users', 'error');
                        }
                    });
                } else {
                    blurAllUsersBtn.innerHTML = '🔒 Blur All Users';
                    blurAllUsersBtn.disabled = false;
                    showStatus('Please open WhatsApp Web first', 'error');
                }
            });
        });
    }
    
    // Unblur all users
    function unblurAllUsers() {
        chrome.storage.sync.get(['managedUsers'], function(result) {
            const users = result.managedUsers || [];
            
            if (users.length === 0) {
                showStatus('No users found. Please scan for users first.', 'error');
                return;
            }
            
            // Show loading state
            unblurAllUsersBtn.innerHTML = '<span class="loading"></span> Unblurring...';
            unblurAllUsersBtn.disabled = true;
            
            // Update all users to be unblurred
            const updatedUsers = users.map(user => ({
                ...user,
                isBlurred: false
            }));
            
            saveUsersList(updatedUsers);
            displayUsersList(updatedUsers);
            
            // Apply unblur to all users on WhatsApp Web
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                const currentTab = tabs[0];
                if (currentTab.url.includes('web.whatsapp.com')) {
                    // Set a timeout to reset button state if no response
                    const timeout = setTimeout(() => {
                        unblurAllUsersBtn.innerHTML = '👁️ Unblur All Users';
                        unblurAllUsersBtn.disabled = false;
                        showStatus('Unblur operation completed', 'success');
                    }, 5000); // 5 second timeout
                    
                    // Send a single message to unblur all users at once
                    chrome.tabs.sendMessage(currentTab.id, {
                        action: 'unblurAllUsers',
                        users: updatedUsers
                    }, function(response) {
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
                    });
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
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
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
        
        chrome.storage.sync.get(['managedUsers'], function(result) {
            const users = result.managedUsers || [];
            const userIndex = users.findIndex(user => user.name === userName);
            
            console.log('Found user at index:', userIndex, 'Current users:', users);
            
            if (userIndex !== -1) {
                users[userIndex].isBlurred = !users[userIndex].isBlurred;
                console.log('Updated user blur status:', users[userIndex].isBlurred);
                
                saveUsersList(users);
                displayUsersList(users);
                
                // Apply blur to WhatsApp Web
                chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                    const currentTab = tabs[0];
                    if (currentTab.url.includes('web.whatsapp.com')) {
                        console.log('Sending message to content script:', {
                            action: 'toggleUserBlur',
                            userName: userName,
                            isBlurred: users[userIndex].isBlurred
                        });
                        
                        chrome.tabs.sendMessage(currentTab.id, {
                            action: 'toggleUserBlur',
                            userName: userName,
                            isBlurred: users[userIndex].isBlurred
                        }, function(response) {
                            if (chrome.runtime.lastError) {
                                console.error('Error sending message:', chrome.runtime.lastError);
                                showStatus('Error: ' + chrome.runtime.lastError.message, 'error');
                            } else {
                                console.log('Message sent successfully:', response);
                            }
                        });
                    } else {
                        showStatus('Please open WhatsApp Web first', 'error');
                    }
                });
                
                showStatus(`${userName} ${users[userIndex].isBlurred ? 'blurred' : 'unblurred'}`, 'success');
            } else {
                console.error('User not found:', userName);
                showStatus('User not found', 'error');
            }
        });
    }
    
    // Remove a specific user
    function removeUser(userName) {
        if (confirm(`Remove ${userName} from the list?`)) {
            chrome.storage.sync.get(['managedUsers'], function(result) {
                const users = result.managedUsers || [];
                const filteredUsers = users.filter(user => user.name !== userName);
                saveUsersList(filteredUsers);
                displayUsersList(filteredUsers);
                
                // Remove blur from WhatsApp Web
                chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
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
});
