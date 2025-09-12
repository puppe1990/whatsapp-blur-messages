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
                    <div class="user-toggle ${user.isBlurred ? 'active' : ''}" onclick="toggleUserBlur('${user.name}')"></div>
                    <button class="user-remove" onclick="removeUser('${user.name}')" title="Remove user">×</button>
                </div>
            </div>
        `).join('');
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
    window.toggleUserBlur = function(userName) {
        chrome.storage.sync.get(['managedUsers'], function(result) {
            const users = result.managedUsers || [];
            const userIndex = users.findIndex(user => user.name === userName);
            
            if (userIndex !== -1) {
                users[userIndex].isBlurred = !users[userIndex].isBlurred;
                saveUsersList(users);
                displayUsersList(users);
                
                // Apply blur to WhatsApp Web
                chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                    const currentTab = tabs[0];
                    if (currentTab.url.includes('web.whatsapp.com')) {
                        chrome.tabs.sendMessage(currentTab.id, {
                            action: 'toggleUserBlur',
                            userName: userName,
                            isBlurred: users[userIndex].isBlurred
                        });
                    }
                });
                
                showStatus(`${userName} ${users[userIndex].isBlurred ? 'blurred' : 'unblurred'}`, 'success');
            }
        });
    };
    
    // Remove a specific user
    window.removeUser = function(userName) {
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
    };
});
