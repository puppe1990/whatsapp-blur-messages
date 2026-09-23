/* exported addBlurStyles */
// Blur CSS generators per blur type (standard, pixelated, blackout, invisible, hide, custom).

// Add blur styles with different blur types
function addBlurStyles(blurTypeSettings = { type: 'standard' }) {
    if (document.getElementById('wa-blur-style')) {
        console.log('🎨 Blur styles already exist, updating with new type');
        document.getElementById('wa-blur-style').remove();
    }

    console.log('🎨 Adding blur styles to document with type:', blurTypeSettings.type);

    const style = document.createElement('style');
    style.id = 'wa-blur-style';

    // Generate CSS based on blur type
    let blurCSS = generateBlurCSS(blurTypeSettings);

    style.textContent = blurCSS;
    document.head.appendChild(style);
    console.log('✅ Blur styles added to document head');

    // Force style recalculation
    setTimeout(() => {
        const testElement = document.querySelector('.wa-blur-target');
        if (testElement) {
            console.log('🔍 Testing blur style application:', {
                element: testElement,
                classes: testElement.className,
                computedFilter: window.getComputedStyle(testElement).filter,
                computedBackground: window.getComputedStyle(testElement).backgroundColor
            });
        }
    }, 100);
}

// Generate CSS for different blur types
function generateBlurCSS(blurTypeSettings) {
    const blurType = blurTypeSettings.type || 'standard';

    switch (blurType) {
        case 'standard':
            return generateStandardBlurCSS();
        case 'pixelated':
            return generatePixelatedBlurCSS();
        case 'blackout':
            return generateBlackoutBlurCSS();
        case 'invisible':
            return generateInvisibleBlurCSS();
        case 'hide':
            return generateHideBlurCSS();
        case 'custom':
            return generateCustomBlurCSS(blurTypeSettings);
        default:
            return generateStandardBlurCSS();
    }
}

function generateStandardBlurCSS() {
    return `
        .wa-blur-target {
            filter: blur(25px) !important;
            pointer-events: none !important;
            transition: none !important;
            background-color: rgba(255, 0, 0, 0.8) !important;
            border-radius: 4px !important;
            position: relative !important;
            overflow: hidden !important;
            transform: scale(1.05) !important;
        }
        .wa-blur-image {
            filter: blur(30px) !important;
            pointer-events: none !important;
            transition: none !important;
            background-color: rgba(255, 0, 0, 0.8) !important;
            border-radius: 4px !important;
            position: relative !important;
            overflow: hidden !important;
            transform: scale(1.05) !important;
        }
        .wa-blur-target::before {
            content: "🔒 BLURRED" !important;
            position: absolute !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            background: rgba(255, 0, 0, 0.9) !important;
            color: white !important;
            padding: 4px 8px !important;
            border-radius: 4px !important;
            font-size: 12px !important;
            font-weight: bold !important;
            z-index: 99999 !important;
            pointer-events: none !important;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3) !important;
        }
        .wa-blur-image::after {
            content: "🔒" !important;
            position: absolute !important;
            top: 5px !important;
            right: 5px !important;
            background: rgba(255, 0, 0, 0.9) !important;
            color: white !important;
            padding: 3px 6px !important;
            border-radius: 4px !important;
            font-size: 14px !important;
            z-index: 99999 !important;
            pointer-events: none !important;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3) !important;
        }
        /* Force override WhatsApp styles */
        .wa-blur-target[style*="filter"] {
            filter: blur(25px) !important;
        }
        .wa-blur-image[style*="filter"] {
            filter: blur(30px) !important;
        }
        /* Ultra-specific selectors to override WhatsApp */
        span[title].wa-blur-target {
            filter: blur(25px) !important;
            background-color: rgba(0, 0, 0, 0.3) !important;
        }
        img.wa-blur-image {
            filter: blur(30px) !important;
            background-color: rgba(0, 0, 0, 0.3) !important;
        }
        /* Override any inline styles */
        .wa-blur-target[style] {
            filter: blur(25px) !important;
            background-color: rgba(0, 0, 0, 0.3) !important;
        }
        .wa-blur-image[style] {
            filter: blur(30px) !important;
            background-color: rgba(0, 0, 0, 0.3) !important;
        }
    `;
}

function generatePixelatedBlurCSS() {
    return `
        .wa-blur-target {
            filter: blur(0px) !important;
            image-rendering: pixelated !important;
            image-rendering: -moz-crisp-edges !important;
            image-rendering: crisp-edges !important;
            pointer-events: none !important;
            transition: none !important;
            background-color: rgba(128, 128, 128, 0.8) !important;
            border-radius: 4px !important;
            position: relative !important;
            overflow: hidden !important;
            transform: scale(0.1) !important;
            transform-origin: center !important;
        }
        .wa-blur-image {
            filter: blur(0px) !important;
            image-rendering: pixelated !important;
            image-rendering: -moz-crisp-edges !important;
            image-rendering: crisp-edges !important;
            pointer-events: none !important;
            transition: none !important;
            background-color: rgba(128, 128, 128, 0.8) !important;
            border-radius: 4px !important;
            position: relative !important;
            overflow: hidden !important;
            transform: scale(0.1) !important;
            transform-origin: center !important;
        }
        .wa-blur-target::before {
            content: "🔲 PIXELATED" !important;
            position: absolute !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            background: rgba(128, 128, 128, 0.9) !important;
            color: white !important;
            padding: 4px 8px !important;
            border-radius: 4px !important;
            font-size: 12px !important;
            font-weight: bold !important;
            z-index: 99999 !important;
            pointer-events: none !important;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3) !important;
        }
        .wa-blur-image::after {
            content: "🔲" !important;
            position: absolute !important;
            top: 5px !important;
            right: 5px !important;
            background: rgba(128, 128, 128, 0.9) !important;
            color: white !important;
            padding: 3px 6px !important;
            border-radius: 4px !important;
            font-size: 14px !important;
            z-index: 99999 !important;
            pointer-events: none !important;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3) !important;
        }
    `;
}

function generateBlackoutBlurCSS() {
    return `
        .wa-blur-target {
            filter: none !important;
            pointer-events: none !important;
            transition: none !important;
            background-color: rgba(0, 0, 0, 1) !important;
            color: transparent !important;
            border-radius: 4px !important;
            position: relative !important;
            overflow: hidden !important;
        }
        .wa-blur-image {
            filter: none !important;
            pointer-events: none !important;
            transition: none !important;
            background-color: rgba(0, 0, 0, 1) !important;
            border-radius: 4px !important;
            position: relative !important;
            overflow: hidden !important;
        }
        .wa-blur-target::before {
            content: "⬛ BLACKED OUT" !important;
            position: absolute !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            background: rgba(0, 0, 0, 0.9) !important;
            color: white !important;
            padding: 4px 8px !important;
            border-radius: 4px !important;
            font-size: 12px !important;
            font-weight: bold !important;
            z-index: 99999 !important;
            pointer-events: none !important;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3) !important;
        }
        .wa-blur-image::after {
            content: "⬛" !important;
            position: absolute !important;
            top: 5px !important;
            right: 5px !important;
            background: rgba(0, 0, 0, 0.9) !important;
            color: white !important;
            padding: 3px 6px !important;
            border-radius: 4px !important;
            font-size: 14px !important;
            z-index: 99999 !important;
            pointer-events: none !important;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3) !important;
        }
    `;
}

function generateInvisibleBlurCSS() {
    return `
        .wa-blur-target {
            filter: none !important;
            pointer-events: none !important;
            transition: none !important;
            background-color: transparent !important;
            color: transparent !important;
            border-radius: 4px !important;
            position: relative !important;
            overflow: hidden !important;
            opacity: 0 !important;
        }
        .wa-blur-image {
            filter: none !important;
            pointer-events: none !important;
            transition: none !important;
            background-color: transparent !important;
            border-radius: 4px !important;
            position: relative !important;
            overflow: hidden !important;
            opacity: 0 !important;
        }
        .wa-blur-target::before {
            content: "👻 INVISIBLE" !important;
            position: absolute !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            background: rgba(128, 128, 128, 0.9) !important;
            color: white !important;
            padding: 4px 8px !important;
            border-radius: 4px !important;
            font-size: 12px !important;
            font-weight: bold !important;
            z-index: 99999 !important;
            pointer-events: none !important;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3) !important;
            opacity: 1 !important;
        }
        .wa-blur-image::after {
            content: "👻" !important;
            position: absolute !important;
            top: 5px !important;
            right: 5px !important;
            background: rgba(128, 128, 128, 0.9) !important;
            color: white !important;
            padding: 3px 6px !important;
            border-radius: 4px !important;
            font-size: 14px !important;
            z-index: 99999 !important;
            pointer-events: none !important;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3) !important;
            opacity: 1 !important;
        }
    `;
}

function generateHideBlurCSS() {
    return `
        .wa-blur-target,
        .wa-blur-image,
        .wa-hidden-row {
            display: none !important;
        }
        /* Collapse the whole chat row that contains hidden content */
        div[role="listitem"]:has(.wa-blur-target),
        div[role="listitem"]:has(.wa-blur-image) {
            display: none !important;
        }
    `;
}

function generateCustomBlurCSS(blurTypeSettings) {
    const intensity = blurTypeSettings.intensity || 25;
    const color = blurTypeSettings.color || '#ff0000';
    const opacity = blurTypeSettings.opacity || 0.8;

    // Convert hex color to rgba
    const hexToRgba = (hex, alpha) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const backgroundColor = hexToRgba(color, opacity);
    const overlayColor = hexToRgba(color, Math.min(opacity + 0.1, 1));

    return `
        .wa-blur-target {
            filter: blur(${intensity}px) !important;
            pointer-events: none !important;
            transition: none !important;
            background-color: ${backgroundColor} !important;
            border-radius: 4px !important;
            position: relative !important;
            overflow: hidden !important;
            transform: scale(1.05) !important;
        }
        .wa-blur-image {
            filter: blur(${intensity + 5}px) !important;
            pointer-events: none !important;
            transition: none !important;
            background-color: ${backgroundColor} !important;
            border-radius: 4px !important;
            position: relative !important;
            overflow: hidden !important;
            transform: scale(1.05) !important;
        }
        .wa-blur-target::before {
            content: "🎨 CUSTOM BLUR" !important;
            position: absolute !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            background: ${overlayColor} !important;
            color: white !important;
            padding: 4px 8px !important;
            border-radius: 4px !important;
            font-size: 12px !important;
            font-weight: bold !important;
            z-index: 99999 !important;
            pointer-events: none !important;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3) !important;
        }
        .wa-blur-image::after {
            content: "🎨" !important;
            position: absolute !important;
            top: 5px !important;
            right: 5px !important;
            background: ${overlayColor} !important;
            color: white !important;
            padding: 3px 6px !important;
            border-radius: 4px !important;
            font-size: 14px !important;
            z-index: 99999 !important;
            pointer-events: none !important;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3) !important;
        }
    `;
}
