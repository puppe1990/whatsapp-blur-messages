import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createChromeMock, ROOT_DIR, setupBrowserEnvironment } from './helpers/extension-harness.js';

const WHATSAPP_TAB = { id: 7, url: 'https://web.whatsapp.com/' };
const MANAGED_USERS = [{ name: 'Romeu Junior', isBlurred: false }];

let chromeMock;

beforeAll(() => {
    setupBrowserEnvironment(readFileSync(join(ROOT_DIR, 'popup.html'), 'utf8'));
    chromeMock = createChromeMock();
    globalThis.chrome = chromeMock.chrome;
    // Rendered during popup startup so the stored users list exists for the tests
    chromeMock.chrome.storage.sync.get.mockImplementation((keys, callback) =>
        callback({ managedUsers: MANAGED_USERS })
    );

    vm.runInThisContext(readFileSync(join(ROOT_DIR, 'popup.js'), 'utf8'), { filename: 'popup.js' });
    document.dispatchEvent(new Event('DOMContentLoaded'));
});

beforeEach(() => {
    vi.clearAllMocks();
    chromeMock.chrome.storage.sync.get.mockImplementation((keys, callback) =>
        callback({ managedUsers: MANAGED_USERS })
    );
    chromeMock.chrome.tabs.query.mockImplementation((query, callback) => callback([WHATSAPP_TAB]));
    chromeMock.chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        if (callback) callback({ success: true });
    });
});

function selectBlurType(type) {
    document.querySelectorAll('input[name="blurType"]').forEach((radio) => {
        radio.checked = radio.value === type;
    });
}

describe('popup bulk actions', () => {
    it('sends the selected blur type when blurring all users', () => {
        selectBlurType('hide');

        document.getElementById('blurAllUsersBtn').click();

        expect(chromeMock.chrome.tabs.sendMessage).toHaveBeenCalledWith(
            WHATSAPP_TAB.id,
            expect.objectContaining({
                action: 'blurAllUsers',
                users: [expect.objectContaining({ name: 'Romeu Junior', blurTypeSettings: { type: 'hide' } })]
            }),
            expect.any(Function)
        );
    });

    it('keeps a user specific blur type over the selected one', () => {
        selectBlurType('hide');
        chromeMock.chrome.storage.sync.get.mockImplementation((keys, callback) =>
            callback({
                managedUsers: [{ name: 'Romeu Junior', isBlurred: false, blurTypeSettings: { type: 'blackout' } }]
            })
        );

        document.getElementById('blurAllUsersBtn').click();

        expect(chromeMock.chrome.tabs.sendMessage).toHaveBeenCalledWith(
            WHATSAPP_TAB.id,
            expect.objectContaining({
                users: [expect.objectContaining({ blurTypeSettings: { type: 'blackout' } })]
            }),
            expect.any(Function)
        );
    });

    it('persists the selected blur type on the stored user', () => {
        selectBlurType('hide');

        document.getElementById('blurAllUsersBtn').click();

        expect(chromeMock.chrome.storage.sync.set).toHaveBeenCalledWith(
            expect.objectContaining({
                managedUsers: [expect.objectContaining({ isBlurred: true, blurTypeSettings: { type: 'hide' } })]
            })
        );
    });
});

describe('popup per-user toggle', () => {
    it('sends the selected blur type when enabling a user without settings', () => {
        selectBlurType('hide');
        document.querySelector('.user-toggle').click();

        expect(chromeMock.chrome.tabs.sendMessage).toHaveBeenCalledWith(
            WHATSAPP_TAB.id,
            expect.objectContaining({
                action: 'toggleUserBlur',
                userName: 'Romeu Junior',
                isBlurred: true,
                blurTypeSettings: { type: 'hide' }
            }),
            expect.any(Function)
        );
    });
});
