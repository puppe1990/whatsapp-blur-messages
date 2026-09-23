import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { beforeAll, describe, expect, it } from 'vitest';
import { ROOT_DIR, setupBrowserEnvironment } from './helpers/extension-harness.js';

const TEST_PAGE_HTML = readFileSync(join(ROOT_DIR, 'test.html'), 'utf8');
const PAGE_SCRIPTS = [...TEST_PAGE_HTML.matchAll(/<script src="([^"]+)"/g)].map((match) => match[1]);

beforeAll(() => {
    setupBrowserEnvironment(TEST_PAGE_HTML);

    PAGE_SCRIPTS.forEach((file) => {
        vm.runInThisContext(readFileSync(join(ROOT_DIR, file), 'utf8'), { filename: file });
    });

    document.dispatchEvent(new Event('DOMContentLoaded'));
});

describe('test.html', () => {
    it('loads the real content-script engine', () => {
        expect(typeof globalThis.blurContact).toBe('function');
        expect(typeof globalThis.isNavigationChrome).toBe('function');
        expect(typeof globalThis.runBenchmark).toBe('function');
    });

    it('runs the benchmark end to end', async () => {
        document.getElementById('benchRowCount').value = '20';
        window.BENCH_FRAME_WINDOW_MS = 150;

        document.getElementById('benchRunBtn').click();

        const lines = await window.lastBenchmark;
        const output = document.getElementById('benchResult').textContent;

        expect(lines[0]).toBe('Synthetic chats: 20');
        expect(output).toContain('apply standard blur');
        expect(output).toContain('monitor window (150 ms)');
        expect(output).toContain('apply hide');
    });
});
