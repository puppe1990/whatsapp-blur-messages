/* exported NAVIGATION_EXCLUSIONS, findConversationHeader, isInTargetChat, isNavigationChrome */
// WhatsApp DOM helpers: chat-context detection and navigation-element exclusions.

// Navigation chrome of WhatsApp that must never be treated as a contact or blurred.
const NAVIGATION_EXCLUSIONS = [
    'chat-filled-refreshed',
    'chat-filled-refreshed1',
    'status-refreshed',
    'newsletter-outline',
    'community-refreshed-32',
    'settings-refreshed',
    'plus-rounded',
    'wa-wordmark'
];

// WhatsApp renders icons as text ligatures ("wds-ic-status", "ic-call"). They are
// short single words, so the scanner would otherwise treat them as contact names.
const ICON_LIGATURE_PATTERN = /^(wds-)?ic-[a-z0-9-]*$/;

function isNavigationChrome(value) {
    if (!value) return false;

    const text = value.trim();
    return NAVIGATION_EXCLUSIONS.includes(text) || ICON_LIGATURE_PATTERN.test(text);
}

// The conversation header holds the open chat; the first <header> in the DOM is
// usually the left navigation rail, so prefer a header that contains a span[title].
function findConversationHeader() {
    const conversationHeader = document.querySelector('[data-testid="conversation-header"]');
    if (conversationHeader) return conversationHeader;

    const headers = Array.from(document.querySelectorAll('header'));
    return headers.find((header) => header.querySelector('span[title]')) || headers[0] || null;
}

// Check if we're currently in the target chat
function isInTargetChat(contactName) {
    if (!contactName) return false;

    const normalize = (s) =>
        (s || '')
            .normalize('NFD')
            .replace(/\p{Diacritic}+/gu, '')
            .replace(/[\u200B-\u200D\uFEFF]/g, '') // zero-width chars
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    const target = normalize(contactName);

    // Candidate 1: Header area (primary source of truth)
    const header = document.querySelector('[data-testid="conversation-header"], header');
    if (header) {
        // Prefer a strict title attribute match
        const headerTitleSpans = header.querySelectorAll('span[title], div[title]');
        for (let span of headerTitleSpans) {
            const t = span.getAttribute('title');
            if (t && normalize(t) === target) return true;
        }
        // Fallback to exact visible text in header (normalized)
        const headerTextEls = header.querySelectorAll('h1, h2, span, div');
        for (let el of headerTextEls) {
            const text = normalize(el.textContent);
            if (text && text === target) return true;
        }
    }

    // Candidate 2: Selected item in the chat list (left pane)
    const selectedCandidates = [
        '[aria-selected="true"]',
        '[role="row"][aria-selected="true"]',
        'div[aria-selected="true"]',
        '[data-testid="cell-frame-container"][aria-selected="true"]'
    ];
    for (let sel of selectedCandidates) {
        const selected = document.querySelector(sel);
        if (selected) {
            const titleEl = selected.querySelector('span[title]');
            if (titleEl && normalize(titleEl.getAttribute('title')) === target) return true;
            const textEl = selected.querySelector('h1, h2, span, div');
            if (textEl && normalize(textEl.textContent) === target) return true;
        }
    }

    // If no strong signal, consider not in target chat
    return false;
}
