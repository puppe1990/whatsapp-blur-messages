import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createChromeMock, loadExtensionScript, setupBrowserEnvironment } from './helpers/extension-harness.js';

// Asset captured on web.whatsapp.com (audio/mpeg, fetched per notification).
const NOTIFICATION_SOUND = 'https://static.whatsapp.net/rsrc.php/yW/r/BS_BUUXbKq5.mp3';
const VOICE_NOTE_SOUND = 'https://web.whatsapp.com/assets/voice-note.ogg';

const notifications = [];

class FakeNotification {
    constructor(title, options) {
        notifications.push({ title, options });
    }

    close() {}
}

beforeAll(() => {
    setupBrowserEnvironment();
    FakeNotification.permission = 'granted';
    FakeNotification.requestPermission = () => Promise.resolve('granted');
    Object.defineProperty(window, 'Notification', {
        value: FakeNotification,
        configurable: true,
        writable: true
    });

    loadExtensionScript('page-sound-guard.js', createChromeMock().chrome);
});

beforeEach(() => {
    notifications.length = 0;
    delete document.documentElement.dataset.waMuteUntil;
    delete document.documentElement.dataset.waMutedNames;
});

function playAudio(src) {
    const audio = new window.Audio(src);
    audio.play();
    return audio;
}

describe('notification sound playback', () => {
    it('leaves playback untouched outside the mute window', () => {
        expect(playAudio(NOTIFICATION_SOUND).muted).toBe(false);
    });

    it('mutes notification sounds while the mute window is open', () => {
        document.documentElement.dataset.waMuteUntil = String(Date.now() + 4000);

        expect(playAudio(NOTIFICATION_SOUND).muted).toBe(true);
    });

    it('stops muting once the window expired', () => {
        document.documentElement.dataset.waMuteUntil = String(Date.now() - 1000);

        expect(playAudio(NOTIFICATION_SOUND).muted).toBe(false);
    });

    it('leaves other audio sources alone', () => {
        document.documentElement.dataset.waMuteUntil = String(Date.now() + 4000);

        expect(playAudio(VOICE_NOTE_SOUND).muted).toBe(false);
    });

    it('lets the element sound again when playback ends', () => {
        document.documentElement.dataset.waMuteUntil = String(Date.now() + 4000);
        const audio = playAudio(NOTIFICATION_SOUND);

        audio.dispatchEvent(new Event('ended'));

        expect(audio.muted).toBe(false);
    });
});

describe('system notifications', () => {
    it('suppresses notifications from muted contacts', () => {
        document.documentElement.dataset.waMutedNames = 'romeu junior';

        new window.Notification('Romeu Junior', { body: 'oi' });

        expect(notifications).toHaveLength(0);
    });

    it('ignores bidi marks around the notification title', () => {
        document.documentElement.dataset.waMutedNames = 'romeu junior';

        new window.Notification('\u202ARomeu Junior\u202C', { body: 'oi' });

        expect(notifications).toHaveLength(0);
    });

    it('keeps notifications from other contacts', () => {
        document.documentElement.dataset.waMutedNames = 'romeu junior';

        new window.Notification('Ana Souza', { body: 'oi' });

        expect(notifications).toEqual([{ title: 'Ana Souza', options: { body: 'oi' } }]);
    });

    it('keeps the Notification API surface', () => {
        expect(window.Notification.permission).toBe('granted');
        expect(typeof window.Notification.requestPermission).toBe('function');
    });

    it('installs itself only once', () => {
        const installed = window.Notification;

        loadExtensionScript('page-sound-guard.js', createChromeMock().chrome);

        expect(window.Notification).toBe(installed);
    });
});
