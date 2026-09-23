import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createChromeMock, loadContentScripts, setupBrowserEnvironment } from './helpers/extension-harness.js';

const BLUR_SETTINGS = {
    chatListName: true,
    chatListMessage: true,
    chatListAvatar: true,
    headerName: true,
    headerAvatar: true,
    messageText: true,
    messageImages: true
};

const SAVED_USERS = [
    {
        name: 'Romeu Junior',
        isBlurred: true,
        blurSettings: BLUR_SETTINGS,
        blurTypeSettings: { type: 'hide' }
    },
    {
        name: 'Ana Souza',
        isBlurred: false,
        blurSettings: BLUR_SETTINGS,
        blurTypeSettings: { type: 'hide' }
    }
];

const FIXTURE = `
    <div id="pane-side">
        <div role="listitem"><span title="Romeu Junior">Romeu Junior</span><span>Prévia A</span></div>
        <div role="listitem"><span title="Ana Souza">Ana Souza</span><span>Prévia B</span></div>
    </div>
`;

beforeAll(() => {
    // Fake timers so the 2 s re-apply pass after load can be advanced
    vi.useFakeTimers();
    setupBrowserEnvironment();
    loadContentScripts(createChromeMock({}, { managedUsers: SAVED_USERS }).chrome);
});

describe('storage bootstrap', () => {
    it('re-applies the hide state saved in local storage after loading', () => {
        document.body.innerHTML = FIXTURE;

        vi.advanceTimersByTime(2500);

        const [hiddenRow, visibleRow] = document.querySelectorAll('div[role="listitem"]');
        expect(hiddenRow.classList.contains('wa-hidden-row')).toBe(true);
        expect(visibleRow.classList.contains('wa-hidden-row')).toBe(false);
        expect(document.getElementById('wa-blur-style')?.textContent).toContain('display: none !important');
    });
});
