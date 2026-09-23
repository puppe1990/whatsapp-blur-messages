import { beforeAll, describe, expect, it } from 'vitest';
import { createChromeMock, loadExtensionScript } from './helpers/extension-harness.js';

let chromeMock;

beforeAll(() => {
    chromeMock = createChromeMock();
    loadExtensionScript('background.js', chromeMock.chrome);
});

describe('install handler', () => {
    it('registers an onInstalled listener', () => {
        expect(chromeMock.listeners.installed).toBeTypeOf('function');
    });

    it('stores default settings and creates the context menu on install', () => {
        chromeMock.listeners.installed({ reason: 'install' });

        expect(chromeMock.chrome.storage.sync.set).toHaveBeenCalledWith(
            expect.objectContaining({ isEnabled: false, contactName: '' })
        );
        expect(chromeMock.chrome.contextMenus.create).toHaveBeenCalledWith(
            expect.objectContaining({ contexts: ['selection'] })
        );
    });
});

describe('context menu handler', () => {
    it('saves the selected text and forwards applyBlur to the tab', () => {
        chromeMock.listeners.contextMenuClicked(
            { menuItemId: 'whatsapp-blur', selectionText: '  Romeu Junior  ' },
            { id: 42 }
        );

        expect(chromeMock.storage.contactName).toBe('Romeu Junior');
        expect(chromeMock.storage.isEnabled).toBe(true);
        expect(chromeMock.chrome.tabs.sendMessage).toHaveBeenCalledWith(
            42,
            expect.objectContaining({ action: 'applyBlur', contactName: 'Romeu Junior' })
        );
    });

    it('ignores clicks that do not match the blur menu item', () => {
        chromeMock.chrome.tabs.sendMessage.mockClear();

        chromeMock.listeners.contextMenuClicked({ menuItemId: 'other' }, { id: 42 });

        expect(chromeMock.chrome.tabs.sendMessage).not.toHaveBeenCalled();
    });
});
