/* exported isBlurEnabled, currentSettings, blurObserver, lastBlurredElements, currentChatContext, managedUsers, WPP_EXPORT */
// Shared mutable state for the WhatsApp Blur content scripts (loaded first, see manifest.json).

let isBlurEnabled = false;
let currentSettings = null;
let blurObserver = null;
let lastBlurredElements = new Set();
let currentChatContext = null;
let managedUsers = new Map(); // Store multiple user blur settings
let WPP_EXPORT = null;
