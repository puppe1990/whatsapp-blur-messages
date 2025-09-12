// Test the blur functionality
function testBlur() {
    console.log('Testing blur function...');
    
    // Simulate the blur function
    const elements = document.querySelectorAll('span[title="Romeu Junior"]');
    elements.forEach(el => {
        el.classList.add('blur-target');
    });
    
    const images = document.querySelectorAll('img');
    images.forEach(img => {
        img.classList.add('blur-image');
    });
    
    document.getElementById('status').innerHTML = '<span class="success">✓ Blur test completed - check elements above</span>';
}

function testClear() {
    console.log('Testing clear function...');
    
    document.querySelectorAll('.blur-target, .blur-image').forEach(el => {
        el.classList.remove('blur-target', 'blur-image');
    });
    
    document.getElementById('status').innerHTML = '<span class="success">✓ Clear test completed</span>';
}

function testToggle() {
    console.log('Testing toggle function...');
    
    const hasBlur = document.querySelector('.blur-target, .blur-image');
    if (hasBlur) {
        testClear();
    } else {
        testBlur();
    }
}

// Initialize event listeners when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Add event listeners to buttons
    document.getElementById('testBlurBtn').addEventListener('click', testBlur);
    document.getElementById('testClearBtn').addEventListener('click', testClear);
    document.getElementById('testToggleBtn').addEventListener('click', testToggle);
    
    // Check for CSP violations
    window.addEventListener('error', function(e) {
        if (e.message.includes('Content Security Policy') || e.message.includes('CSP')) {
            document.getElementById('status').innerHTML = '<span class="error">✗ CSP Violation detected: ' + e.message + '</span>';
        }
    });
    
    // Initial status
    document.getElementById('status').innerHTML = '<span class="success">✓ Test page loaded successfully - no CSP violations detected</span>';
    
    console.log('WhatsApp Blur Extension Test Page loaded');
    console.log('This page simulates WhatsApp content for testing the blur functionality');
});
