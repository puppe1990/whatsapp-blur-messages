import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
    createChromeMock,
    evaluateInPage,
    loadContentScripts,
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

const STORED_USERS = [
    {
        name: 'Romeu Junior',
        isBlurred: true,
        blurSettings: ALL_BLUR_SETTINGS,
        blurTypeSettings: { type: 'standard' }
    },
    { name: 'Ana Souza', isBlurred: false }
];

const PANE_FIXTURE = `
    <div id="pane-side">
        <div role="listitem">
            <span title="Romeu Junior">Romeu Junior</span>
            <span class="preview">Mensagem de prévia</span>
        </div>
        <div role="listitem">
            <span title="Ana Souza">Ana Souza</span>
            <span class="preview">Oi</span>
        </div>
    </div>
`;

let chromeMock;

const flushMutations = () => new Promise((resolve) => setTimeout(resolve, 0));

function rowPreview(name) {
    const spans = Array.from(document.querySelectorAll('#pane-side span[title]'));
    const titleSpan = spans.find((span) => span.getAttribute('title') === name);
    return titleSpan.parentElement.querySelector('.preview');
}

beforeAll(() => {
    setupBrowserEnvironment();
    chromeMock = createChromeMock({}, { managedUsers: STORED_USERS });
    loadContentScripts(chromeMock.chrome);
});

beforeEach(() => {
    document.body.innerHTML = PANE_FIXTURE;
    delete document.documentElement.dataset.waMuteUntil;

    // Restore the blurred state individual tests change.
    chromeMock.listeners.storageChanged({ managedUsers: { newValue: STORED_USERS } }, 'local');
    sendContentMessage(chromeMock, { action: 'toggleUserBlur', userName: 'Ana Souza', isBlurred: false });
    sendContentMessage(chromeMock, {
        action: 'toggleUserBlur',
        userName: 'Romeu Junior',
        isBlurred: true,
        blurSettings: ALL_BLUR_SETTINGS,
        blurTypeSettings: { type: 'standard' }
    });
    evaluateInPage('refreshBlurredNames()');
});

describe('published muted names', () => {
    it('publishes only blurred contacts on <html>', () => {
        expect(document.documentElement.dataset.waMutedNames).toBe('romeu junior');
    });

    it('adds contacts blurred during the session', () => {
        sendContentMessage(chromeMock, {
            action: 'toggleUserBlur',
            userName: 'Ana Souza',
            isBlurred: true,
            blurSettings: ALL_BLUR_SETTINGS,
            blurTypeSettings: { type: 'standard' }
        });

        evaluateInPage('refreshBlurredNames()');

        expect(document.documentElement.dataset.waMutedNames.split('\n').sort()).toEqual(['ana souza', 'romeu junior']);
    });

    it('drops contacts unblurred by the popup', () => {
        sendContentMessage(chromeMock, { action: 'toggleUserBlur', userName: 'Romeu Junior', isBlurred: false });
        chromeMock.listeners.storageChanged(
            { managedUsers: { newValue: [{ name: 'Romeu Junior', isBlurred: false }] } },
            'local'
        );

        evaluateInPage('refreshBlurredNames()');

        expect(document.documentElement.dataset.waMutedNames).toBe('');
    });
});

describe('mute window', () => {
    it('opens the window when a blurred contact row changes', async () => {
        rowPreview('Romeu Junior').textContent = 'Nova mensagem';

        await flushMutations();

        expect(Number(document.documentElement.dataset.waMuteUntil)).toBeGreaterThan(Date.now());
    });

    it('ignores rows of contacts that are not blurred', async () => {
        rowPreview('Ana Souza').textContent = 'Mensagem nova';

        await flushMutations();

        expect(document.documentElement.dataset.waMuteUntil).toBeUndefined();
    });

    it('ignores changes outside chat rows', async () => {
        document.body.appendChild(document.createElement('div')).textContent = 'Mensagem nova';

        await flushMutations();

        expect(document.documentElement.dataset.waMuteUntil).toBeUndefined();
    });

    it('matches rows whose title carries bidi marks', async () => {
        const preview = rowPreview('Romeu Junior');
        document
            .querySelector('#pane-side span[title="Romeu Junior"]')
            .setAttribute('title', '\u202ARomeu Junior\u202C');

        preview.textContent = 'Nova mensagem';
        await flushMutations();

        expect(Number(document.documentElement.dataset.waMuteUntil)).toBeGreaterThan(Date.now());
    });

    it('matches rows where the preview span comes first', async () => {
        document.body.innerHTML = `
            <div id="pane-side">
                <div role="listitem">
                    <span class="preview" title="Mensagem de prévia">Mensagem de prévia</span>
                    <span title="Romeu Junior">Romeu Junior</span>
                </div>
            </div>
        `;

        document.querySelector('#pane-side .preview').textContent = 'Nova mensagem';
        await flushMutations();

        expect(Number(document.documentElement.dataset.waMuteUntil)).toBeGreaterThan(Date.now());
    });

    it('keeps observing after the chat list is replaced', async () => {
        document.body.innerHTML = '<div id="pane-side"></div>';
        evaluateInPage('ensureChatListObserved()');
        document.body.innerHTML = PANE_FIXTURE;
        evaluateInPage('ensureChatListObserved()');

        rowPreview('Romeu Junior').textContent = 'Nova mensagem';
        await flushMutations();

        expect(Number(document.documentElement.dataset.waMuteUntil)).toBeGreaterThan(Date.now());
    });
});
