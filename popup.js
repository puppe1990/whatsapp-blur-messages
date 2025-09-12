document.addEventListener('DOMContentLoaded', function() {
    const contactNameInput = document.getElementById('contactName');
    const applyBtn = document.getElementById('applyBtn');
    const toggleBtn = document.getElementById('toggleBtn');
    const clearBtn = document.getElementById('clearBtn');
    const statusMessage = document.getElementById('statusMessage');
    
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
    
    // Event listeners
    applyBtn.addEventListener('click', applyBlur);
    toggleBtn.addEventListener('click', toggleBlur);
    clearBtn.addEventListener('click', clearBlur);
    
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
});
