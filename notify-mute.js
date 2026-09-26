/* exported refreshBlurredNames, publishMutedNames, openMuteWindow, setupNotifyMuteObserver, ensureChatListObserved */
/* global isNavigationChrome, normalizeContactName */
// Bridges blurred/hidden contacts to the main-world sound guard (page-sound-guard.js):
// publishes the normalized contact names on <html> and opens a short mute window
// whenever one of those contacts shows new activity in the chat list.

const NOTIFY_MUTE_WINDOW_MS = 4000;
const CHAT_ROW_SELECTOR = 'div[role="listitem"], div[tabindex]';

let notifyMuteObserver = null;
let notifyMuteRoot = null;
let blurredNames = new Set();
let storedBlurredNames = new Set();

function blurredNamesFromUsers(users) {
    return new Set(
        (users || [])
            .filter((user) => user && user.isBlurred)
            .map((user) => normalizeContactName(user.name))
            .filter(Boolean)
    );
}

function publishMutedNames() {
    const root = document.documentElement;
    if (!root) return;

    const value = Array.from(blurredNames).join('\n');
    if (root.dataset.waMutedNames !== value) {
        root.dataset.waMutedNames = value;
    }
}

// The contact list lives in chrome.storage.local, but in-session flows
// (context menu, per-user toggle) only update the shared managedUsers map.
function refreshBlurredNames() {
    const names = new Set(storedBlurredNames);
    for (const [name, userData] of managedUsers) {
        if (userData && userData.isBlurred) {
            const normalized = normalizeContactName(name);
            if (normalized) names.add(normalized);
        }
    }

    blurredNames = names;
    publishMutedNames();
}

function openMuteWindow() {
    const root = document.documentElement;
    if (!root) return;
    root.dataset.waMuteUntil = String(Date.now() + NOTIFY_MUTE_WINDOW_MS);
}

// Rows carry the contact name and the message preview as span[title]; their
// order and bidi wrapping vary, so check every title of the row.
function rowTitleNames(node) {
    const start = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    if (!start || typeof start.closest !== 'function') return [];

    const row = start.closest(CHAT_ROW_SELECTOR);
    if (!row) return [];

    return Array.from(row.querySelectorAll('span[title]'))
        .map((span) => (span.getAttribute('title') || '').trim())
        .filter((name) => name && !isNavigationChrome(name));
}

function mutationTouchesMutedRow(mutation) {
    const candidates = [mutation.target];
    mutation.addedNodes.forEach((node) => candidates.push(node));

    return candidates.some((node) => rowTitleNames(node).some((name) => blurredNames.has(normalizeContactName(name))));
}

function handleNotifyMutations(mutations) {
    if (blurredNames.size === 0) return;
    if (mutations.some(mutationTouchesMutedRow)) {
        openMuteWindow();
    }
}

function chatListRoot() {
    return document.querySelector('#pane-side') || document.body;
}

function setupNotifyMuteObserver() {
    if (notifyMuteObserver) {
        notifyMuteObserver.disconnect();
    }

    notifyMuteRoot = chatListRoot();
    notifyMuteObserver = new MutationObserver(handleNotifyMutations);
    notifyMuteObserver.observe(notifyMuteRoot, {
        childList: true,
        subtree: true,
        characterData: true
    });
}

// WhatsApp recycles the pane when switching layouts; rebind when it is gone.
function ensureChatListObserved() {
    const root = chatListRoot();
    const isDetached = notifyMuteRoot && !notifyMuteRoot.isConnected;
    if (!notifyMuteObserver || notifyMuteRoot !== root || isDetached) {
        setupNotifyMuteObserver();
    }
}

function applyStoredUsers(users) {
    storedBlurredNames = blurredNamesFromUsers(users);
    refreshBlurredNames();
}

function loadStoredUsers() {
    chrome.storage.local.get(['managedUsers'], function (result) {
        applyStoredUsers(result.managedUsers);
    });
}

function watchStoredUsers() {
    if (!chrome.storage.onChanged) return;
    chrome.storage.onChanged.addListener(function (changes, areaName) {
        if (areaName === 'local' && changes.managedUsers) {
            applyStoredUsers(changes.managedUsers.newValue);
        }
    });
}

function startNotifyMuteMonitoring() {
    setInterval(function () {
        refreshBlurredNames();
        ensureChatListObserved();
    }, 1000);
}

watchStoredUsers();
loadStoredUsers();
refreshBlurredNames();
ensureChatListObserved();
startNotifyMuteMonitoring();
