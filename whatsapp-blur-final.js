(function() {
  const nameToBlur = "teste"; // Replace with the contact's name
  
  // Blur control flags
  const blurSettings = {
    chatListName: true,
    chatListMessage: true,
    chatListAvatar: true,
    headerName: true,
    headerAvatar: true,
    messageText: true,
    messageImages: true
  };

  // Add blur styles
  function addBlurStyles() {
    const style = document.createElement('style');
    style.id = "wa-blur-style";
    style.innerHTML = `
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

  // Remove existing blur - only remove style, not classes
  function removeOldStyle() {
    const old = document.getElementById('wa-blur-style');
    if (old) old.remove();
    // Don't remove classes here to prevent blinking
  }

  // Clear all blur classes (only when needed)
  function clearAllBlurClasses() {
    document.querySelectorAll('.wa-blur-target, .wa-blur-image').forEach(el => {
      el.classList.remove('wa-blur-target', 'wa-blur-image');
    });
  }

  // Check if we're currently in the target chat - IMPROVED VERSION
  function isInTargetChat() {
    const header = document.querySelector('header');
    if (!header) {
      console.log('❌ No header found');
      return false;
    }
    
    console.log('🔍 Checking if in target chat...');
    
    // Method 1: Look for the contact name in the header
    const allElements = header.querySelectorAll('*');
    for (let el of allElements) {
      if (el.textContent && el.textContent.trim() === nameToBlur) {
        console.log('✅ Found target name in header');
        return true;
      }
    }
    
    // Method 2: Check if header has a title attribute with the name
    const headerTitle = header.getAttribute('title');
    if (headerTitle && headerTitle.includes(nameToBlur)) {
      console.log('✅ Found target name in header title');
      return true;
    }
    
    // Method 3: Look for any element with the name as text content
    const allTextElements = document.querySelectorAll('*');
    for (let el of allTextElements) {
      if (el.textContent && el.textContent.trim() === nameToBlur) {
        // Check if this element is in the header area
        const rect = el.getBoundingClientRect();
        const headerRect = header.getBoundingClientRect();
        if (rect.top >= headerRect.top && rect.bottom <= headerRect.bottom) {
          console.log('✅ Found target name in header area');
          return true;
        }
      }
    }
    
    // Method 4: Check if we're in a conversation (not in chat list)
    const messageArea = document.querySelector('[data-testid="conversation-panel-messages"]') ||
                       document.querySelector('.message-list') ||
                       document.querySelector('[role="log"]');
    
    if (messageArea) {
      console.log('✅ Found message area - we are in a chat');
      // If we're in a chat, assume it's the target chat for now
      // We'll verify by checking if the header contains the name
      return true;
    }
    
    console.log('❌ Not in target chat');
    return false;
  }

  // Track current state to prevent unnecessary re-blurring
  let lastBlurredElements = new Set();
  let currentChatContext = null;

  // Main blur function
  function blurContact() {
    console.log('🚀 Starting blur for:', nameToBlur);
    
    // Only remove and re-add styles if they don't exist
    if (!document.getElementById('wa-blur-style')) {
      addBlurStyles();
    }
    
    // Check if we need to clear previous blur (only when context changes)
    const newChatContext = isInTargetChat();
    if (currentChatContext !== newChatContext) {
      console.log('🔄 Chat context changed, clearing previous blur');
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
    
    // 1. Always blur chat list items (this works regardless of which chat is open)
    if (blurSettings.chatListName || blurSettings.chatListMessage || blurSettings.chatListAvatar) {
      const chatSpans = document.querySelectorAll("span[title]");
      chatSpans.forEach(span => {
        if (span.getAttribute('title') === nameToBlur && !shouldExcludeElement(span)) {
          console.log('✅ Found target in chat list');
          
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
    if (isInTargetChat()) {
      console.log('✅ Currently in target chat, blurring header and messages');
      
      const header = document.querySelector('header');
      if (header) {
        // Find and blur header name
        if (blurSettings.headerName) {
          const allElements = header.querySelectorAll('*');
          allElements.forEach(el => {
            if (el.textContent && el.textContent.trim() === nameToBlur && 
                !el.classList.contains('wa-blur-target') && !shouldExcludeElement(el)) {
              console.log('📝 Blurring header name');
              el.classList.add('wa-blur-target');
              lastBlurredElements.add(el);
            }
          });
        }
        
        // Blur header avatar
        if (blurSettings.headerAvatar) {
          const headerImgs = header.querySelectorAll('img');
          console.log(`🖼️ Found ${headerImgs.length} header images`);
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
        // Find message area
        const messageArea = document.querySelector('[data-testid="conversation-panel-messages"]') ||
                           document.querySelector('.message-list') ||
                           document.querySelector('[role="log"]') ||
                           document.querySelector('div[data-testid*="message"]');
        
        if (messageArea) {
          console.log('✅ Found message area, blurring content');
          
          if (blurSettings.messageText) {
            // Blur all text content that looks like messages
            const allElements = messageArea.querySelectorAll('*');
            let blurredCount = 0;
            allElements.forEach(el => {
              if (el.textContent && el.textContent.trim().length > 3 && 
                  !el.classList.contains('wa-blur-target') && !shouldExcludeElement(el)) {
                const text = el.textContent.trim();
                // Check if it looks like a message (contains spaces, punctuation, etc.)
                if (text.includes(' ') || text.includes('?') || text.includes('!') || 
                    text.includes('.') || text.includes(',') || /[a-z]/.test(text)) {
                  el.classList.add('wa-blur-target');
                  lastBlurredElements.add(el);
                  blurredCount++;
                }
              }
            });
            console.log(`📝 Blurred ${blurredCount} text elements`);
          }
          
          if (blurSettings.messageImages) {
            const imgs = messageArea.querySelectorAll('img');
            console.log(`🖼️ Found ${imgs.length} images in messages`);
            imgs.forEach(img => {
              if (!img.classList.contains('wa-blur-image') && !shouldExcludeElement(img)) {
                img.classList.add('wa-blur-image');
                lastBlurredElements.add(img);
              }
            });
          }
        } else {
          console.log('❌ Message area not found, trying fallback');
          // Fallback: blur all messages in the page
          const messages = document.querySelectorAll('.message-in, .message-out, [data-testid*="msg"]');
          console.log(`📝 Found ${messages.length} fallback messages`);
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
    } else {
      console.log('ℹ️ Not in target chat, skipping header/message blur');
    }
    
    console.log('✅ Blur completed');
  }

  // Run on page load and when DOM changes
  blurContact();
  
  // Debounced blur function to prevent excessive calls
  let blurTimeout;
  function debouncedBlur() {
    clearTimeout(blurTimeout);
    blurTimeout = setTimeout(() => {
      blurContact();
    }, 200); // Increased delay to reduce frequency
  }
  
  const observer = new MutationObserver((mutations) => {
    // Only trigger if there are meaningful changes
    const hasSignificantChanges = mutations.some(mutation => {
      // Check if new nodes were added that might contain our target content
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        for (let node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if the added node or its children might contain our target
            const hasTargetContent = node.textContent && node.textContent.includes(nameToBlur);
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
  
  observer.observe(document.body, { 
    childList: true, 
    subtree: true,
    attributes: false, // Don't watch attribute changes to reduce noise
    characterData: false // Don't watch text changes to reduce noise
  });

  // Global functions
  window.toggleBlur = function() {
    const style = document.getElementById('wa-blur-style');
    if (style) {
      style.remove();
      clearAllBlurClasses();
      lastBlurredElements.clear();
      currentChatContext = null;
      console.log('🔴 Blur disabled');
    } else {
      addBlurStyles();
      blurContact();
      console.log('🟢 Blur enabled');
    }
  };
  
  window.updateBlurSettings = function(newSettings) {
    Object.assign(blurSettings, newSettings);
    console.log('🎛️ Updated settings:', blurSettings);
    blurContact();
  };

  window.clearBlur = function() {
    clearAllBlurClasses();
    lastBlurredElements.clear();
    currentChatContext = null;
    console.log('🧹 All blur cleared');
  };

  window.testChat = function() {
    console.log('🧪 Testing chat detection...');
    console.log('🎯 Target:', nameToBlur);
    console.log('📱 In target chat?', isInTargetChat());
    
    const header = document.querySelector('header');
    if (header) {
      console.log('📦 Header found:', header);
      const allElements = header.querySelectorAll('*');
      console.log('🔍 All header elements:');
      allElements.forEach((el, i) => {
        if (el.textContent && el.textContent.trim()) {
          console.log(`  ${i + 1}. "${el.textContent.trim()}"`);
        }
      });
    } else {
      console.log('❌ No header found');
    }
  };

  // Force blur function - bypasses chat detection
  window.forceBlur = function() {
    console.log('🔥 FORCE BLURRING - bypassing chat detection');
    
    const header = document.querySelector('header');
    if (header) {
      // Blur everything in header
      const allElements = header.querySelectorAll('*');
      allElements.forEach(el => {
        if (el.textContent && el.textContent.trim()) {
          el.classList.add('wa-blur-target');
        }
      });
      
      // Blur header images
      const headerImgs = header.querySelectorAll('img');
      headerImgs.forEach(img => img.classList.add('wa-blur-image'));
    }
    
    // Blur all messages
    const messageArea = document.querySelector('[data-testid="conversation-panel-messages"]') ||
                       document.querySelector('.message-list') ||
                       document.querySelector('[role="log"]');
    
    if (messageArea) {
      const allElements = messageArea.querySelectorAll('*');
      allElements.forEach(el => {
        if (el.textContent && el.textContent.trim().length > 3) {
          el.classList.add('wa-blur-target');
        }
      });
      
      const imgs = messageArea.querySelectorAll('img');
      imgs.forEach(img => img.classList.add('wa-blur-image'));
    }
    
    console.log('🔥 Force blur completed');
  };

  console.log('🎯 WhatsApp Blur Script loaded for:', nameToBlur);
  console.log('💡 Commands: toggleBlur(), updateBlurSettings({headerName: false}), testChat(), forceBlur(), clearBlur()');
})();
