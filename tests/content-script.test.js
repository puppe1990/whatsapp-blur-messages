import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
    createChromeMock,
    evaluateInPage,
    loadExtensionScript,
    sendContentMessage,
    setupBrowserEnvironment
} from './helpers/extension-harness.js';

const ALL_BLUR_SETTINGS = {
    chatListName: true,
    chatListMessage: true,
    chatListAvatar: true,
    headerName: true,
    headerAvatar: true,
    messageText: true,
    messageImages: true
};

const CHAT_FIXTURE = `
    <div id="pane-side">
        <div role="listitem">
            <span title="Romeu Junior">Romeu Junior</span>
            <span title="preview">Mensagem de prévia</span>
        </div>
        <div role="listitem">
            <span title="Ana Souza">Ana Souza</span>
        </div>
        <div role="listitem">
            <span title="settings-refreshed">settings-refreshed</span>
        </div>
    </div>
    <header>
        <span title="Romeu Junior">Romeu Junior</span>
    </header>
`;

let chromeMock;

beforeAll(() => {
    setupBrowserEnvironment();
    chromeMock = createChromeMock();
    loadExtensionScript('content.js', chromeMock.chrome);
});

beforeEach(() => {
    sendContentMessage(chromeMock, { action: 'clearBlur' });
    document.getElementById('wa-blur-style')?.remove();
    document.body.innerHTML = '';
});

describe('message routing', () => {
    it('answers ping', () => {
        expect(sendContentMessage(chromeMock, { action: 'ping' })).toEqual({
            success: true,
            message: 'Content script is loaded'
        });
    });

    it('rejects unknown actions', () => {
        expect(sendContentMessage(chromeMock, { action: 'doesNotExist' })).toEqual({
            success: false,
            error: 'Unknown action'
        });
    });

    it('starts with an empty export buffer', () => {
        const response = sendContentMessage(chromeMock, { action: 'wppExportGet' });

        expect(response.success).toBe(true);
        expect(response.count).toBe(0);
        expect(response.messages).toEqual([]);
    });
});

describe('scanUsers', () => {
    it('finds contacts in the chat list and header, skipping previews and navigation entries', () => {
        document.body.innerHTML = CHAT_FIXTURE;

        const response = sendContentMessage(chromeMock, { action: 'scanUsers' });

        expect(response.success).toBe(true);
        expect(response.users.map((user) => user.name)).toEqual(['Romeu Junior', 'Ana Souza']);
    });
});

describe('blur lifecycle', () => {
    it('injects blur styles and tags the matching chat row when blur is applied', () => {
        document.body.innerHTML = CHAT_FIXTURE;

        const response = sendContentMessage(chromeMock, {
            action: 'applyBlur',
            contactName: 'Romeu Junior',
            blurSettings: ALL_BLUR_SETTINGS,
            blurTypeSettings: { type: 'standard' }
        });

        expect(response).toEqual({ success: true });
        expect(document.getElementById('wa-blur-style')).not.toBeNull();

        const span = document.querySelector('div[role="listitem"] span[title="Romeu Junior"]');
        expect(span.classList.contains('wa-blur-target')).toBe(true);
        expect(span.dataset.waBlurUser).toBe('Romeu Junior');
    });

    it('removes blur styles when toggled off', () => {
        document.body.innerHTML = CHAT_FIXTURE;
        sendContentMessage(chromeMock, {
            action: 'applyBlur',
            contactName: 'Romeu Junior',
            blurSettings: ALL_BLUR_SETTINGS
        });

        const response = sendContentMessage(chromeMock, { action: 'toggleBlur' });

        expect(response).toEqual({ success: true, isEnabled: false });
        expect(document.getElementById('wa-blur-style')).toBeNull();
    });

    it('clears blur classes and keeps blur disabled afterwards', () => {
        document.body.innerHTML =
            '<div><span class="wa-blur-target">x</span><img class="wa-blur-image" src="x.png"></div>';

        sendContentMessage(chromeMock, { action: 'clearBlur' });

        expect(document.querySelector('.wa-blur-target')).toBeNull();
        expect(document.querySelector('.wa-blur-image')).toBeNull();
        expect(sendContentMessage(chromeMock, { action: 'toggleBlur' })).toEqual({
            success: true,
            isEnabled: false
        });
    });

    it('blurs and unblurs a single user', () => {
        document.body.innerHTML = CHAT_FIXTURE;

        sendContentMessage(chromeMock, {
            action: 'toggleUserBlur',
            userName: 'Ana Souza',
            isBlurred: true,
            blurSettings: ALL_BLUR_SETTINGS,
            blurTypeSettings: { type: 'standard' }
        });

        const span = document.querySelector('div[role="listitem"] span[title="Ana Souza"]');
        expect(span.classList.contains('wa-blur-target')).toBe(true);

        sendContentMessage(chromeMock, { action: 'removeUserBlur', userName: 'Ana Souza' });

        expect(span.classList.contains('wa-blur-target')).toBe(false);
    });
});

describe('isInTargetChat', () => {
    it('matches the open conversation ignoring case and accents', () => {
        document.body.innerHTML = '<header><span title="João Silva">João Silva</span></header>';

        expect(evaluateInPage("isInTargetChat('joao silva')")).toBe(true);
    });

    it('returns false when a different contact is open', () => {
        document.body.innerHTML = '<header><span title="Ana Souza">Ana Souza</span></header>';

        expect(evaluateInPage("isInTargetChat('Romeu Junior')")).toBe(false);
    });
});
