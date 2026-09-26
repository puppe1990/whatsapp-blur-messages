// Main-world guard (manifest entry with "world": "MAIN", run_at: document_start)
// that keeps notification sounds of blurred/hidden contacts silent. Content
// scripts run in an isolated world and cannot patch the page's JavaScript, so
// this file runs in the page context and hooks WhatsApp's own audio calls.
//
// The isolated notify-mute.js publishes the shared state on <html>:
//   data-wa-muted-names -> normalized names of blurred contacts (\n separated)
//   data-wa-mute-until  -> epoch ms until which notification sounds stay muted
(function () {
    if (window.__waSoundGuard) return;
    window.__waSoundGuard = true;

    // WhatsApp plays message sounds with new Audio(<static.whatsapp.net asset>).
    const NOTIFICATION_SOUND_MARKERS = ['static.whatsapp.net', 'data:audio'];

    // Mirrors normalizeContactName in whatsapp-dom.js; the main world cannot share it.
    function normalizeContactName(value) {
        return (
            (value || '')
                .normalize('NFD')
                .replace(/\p{Diacritic}+/gu, '')
                // WhatsApp wraps titles in bidi marks (U+202A…U+202C) and zero-width chars.
                .replace(/[\u200B-\u200D\u202A-\u202E\u2066-\u2069\uFEFF]/g, '')
                .replace(/\s+/g, ' ')
                .trim()
                .toLowerCase()
        );
    }

    function rootDataset() {
        return document.documentElement ? document.documentElement.dataset : null;
    }

    function isMutedContact(name) {
        const dataset = rootDataset();
        if (!dataset || !dataset.waMutedNames) return false;
        return dataset.waMutedNames.split('\n').includes(normalizeContactName(name));
    }

    function inMuteWindow() {
        const dataset = rootDataset();
        return Boolean(dataset) && Date.now() < Number(dataset.waMuteUntil || 0);
    }

    function isNotificationSound(element) {
        const src = element.currentSrc || element.src || '';
        return NOTIFICATION_SOUND_MARKERS.some((marker) => src.includes(marker));
    }

    function silencePlayback(element) {
        element.muted = true;
        element.addEventListener(
            'ended',
            function () {
                element.muted = false;
            },
            { once: true }
        );
    }

    function installPlaybackGuard() {
        const originalPlay = window.HTMLAudioElement.prototype.play;
        window.HTMLAudioElement.prototype.play = function play() {
            try {
                if (inMuteWindow() && isNotificationSound(this)) {
                    silencePlayback(this);
                }
            } catch (error) {
                // The guard must never break page playback.
            }
            return originalPlay.apply(this, arguments);
        };
    }

    function inertNotification() {
        return {
            close: function () {},
            addEventListener: function () {},
            removeEventListener: function () {},
            dispatchEvent: function () {
                return false;
            }
        };
    }

    function installNotificationGuard(OriginalNotification) {
        function GuardedNotification(title, options) {
            if (isMutedContact(title)) {
                return inertNotification();
            }
            return new OriginalNotification(title, options);
        }

        GuardedNotification.prototype = OriginalNotification.prototype;
        ['permission', 'maxActions'].forEach(function (name) {
            const descriptor = Object.getOwnPropertyDescriptor(OriginalNotification, name);
            if (descriptor) Object.defineProperty(GuardedNotification, name, descriptor);
        });
        if (typeof OriginalNotification.requestPermission === 'function') {
            GuardedNotification.requestPermission = OriginalNotification.requestPermission.bind(OriginalNotification);
        }

        window.Notification = GuardedNotification;
    }

    try {
        installPlaybackGuard();
    } catch (error) {
        // Environments without HTMLAudioElement keep the untouched playback.
    }

    try {
        if (window.Notification) {
            installNotificationGuard(window.Notification);
        }
    } catch (error) {
        // Keeping the real Notification API beats a half-installed wrapper.
    }
})();
