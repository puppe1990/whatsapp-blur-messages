import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { vi } from 'vitest';

export const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const WINDOW_GLOBALS = [
    'window',
    'document',
    'navigator',
    'location',
    'history',
    'HTMLElement',
    'Element',
    'Node',
    'MutationObserver',
    'CSS',
    'getComputedStyle',
    'requestAnimationFrame',
    'cancelAnimationFrame',
    'Event',
    'CustomEvent',
    'KeyboardEvent',
    'MouseEvent'
];

let consoleSilenced = false;

function silenceConsole() {
    if (consoleSilenced) return;
    consoleSilenced = true;

    // The extension logs heavily; keep test output readable.
    ['log', 'info', 'warn', 'error', 'debug'].forEach((method) => {
        vi.spyOn(console, method).mockImplementation(() => {});
    });
}

export function setupBrowserEnvironment(html = '<!doctype html><html><head></head><body></body></html>') {
    silenceConsole();

    const dom = new JSDOM(html, {
        url: 'https://web.whatsapp.com/',
        pretendToBeVisual: true
    });

    WINDOW_GLOBALS.forEach((key) => {
        Object.defineProperty(globalThis, key, {
            value: dom.window[key],
            writable: true,
            configurable: true
        });
    });

    return dom;
}

function createEvent(name, listeners) {
    return {
        addListener: vi.fn((listener) => {
            listeners[name] = listener;
        })
    };
}

export function createChromeMock(initialStorage = {}) {
    const listeners = {};
    const storage = { ...initialStorage };

    return {
        chrome: {
            runtime: {
                onMessage: createEvent('message', listeners),
                onInstalled: createEvent('installed', listeners),
                lastError: null
            },
            storage: {
                sync: {
                    get: vi.fn((keys, callback) => callback({ ...storage })),
                    set: vi.fn((values, callback) => {
                        Object.assign(storage, values);
                        if (callback) callback();
                    }),
                    remove: vi.fn((keys, callback) => {
                        (Array.isArray(keys) ? keys : [keys]).forEach((key) => delete storage[key]);
                        if (callback) callback();
                    })
                }
            },
            contextMenus: {
                create: vi.fn(),
                onClicked: createEvent('contextMenuClicked', listeners)
            },
            tabs: {
                query: vi.fn(),
                sendMessage: vi.fn(),
                onUpdated: createEvent('tabUpdated', listeners)
            },
            action: {
                setBadgeText: vi.fn(),
                setBadgeBackgroundColor: vi.fn()
            }
        },
        listeners,
        storage
    };
}

export function loadExtensionScript(relativePath, chromeMock) {
    silenceConsole();

    const source = readFileSync(join(ROOT_DIR, relativePath), 'utf8');
    globalThis.chrome = chromeMock;
    vm.runInThisContext(source, { filename: relativePath });
}

export function contentScriptFiles() {
    const manifest = JSON.parse(readFileSync(join(ROOT_DIR, 'manifest.json'), 'utf8'));
    return manifest.content_scripts.flatMap((script) => script.js ?? []);
}

export function loadContentScripts(chromeMock) {
    silenceConsole();
    globalThis.chrome = chromeMock;

    contentScriptFiles().forEach((file) => {
        vm.runInThisContext(readFileSync(join(ROOT_DIR, file), 'utf8'), { filename: file });
    });
}

export function evaluateInPage(expression) {
    return vm.runInThisContext(expression);
}

export function sendContentMessage(chromeMock, request) {
    let response;
    chromeMock.listeners.message(request, { tab: { id: 1 } }, (value) => {
        response = value;
    });
    return response;
}
