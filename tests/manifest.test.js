import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOT_DIR } from './helpers/extension-harness.js';

const manifest = JSON.parse(readFileSync(join(ROOT_DIR, 'manifest.json'), 'utf8'));

describe('manifest.json', () => {
    it('is a valid MV3 manifest with the required metadata', () => {
        expect(manifest.manifest_version).toBe(3);
        expect(manifest.name).toBeTruthy();
        expect(manifest.version).toMatch(/^\d+(\.\d+){0,3}$/);
        expect(manifest.content_scripts?.[0]?.matches).toEqual(['https://web.whatsapp.com/*']);
    });

    it('references only files that exist', () => {
        const referencedFiles = [
            manifest.action.default_popup,
            manifest.background.service_worker,
            ...manifest.content_scripts.flatMap((script) => script.js ?? []),
            ...Object.values(manifest.icons)
        ];

        referencedFiles.forEach((file) => {
            expect(existsSync(join(ROOT_DIR, file)), `${file} is referenced but missing`).toBe(true);
        });
    });

    it('keeps the least-privilege permission set', () => {
        expect(new Set(manifest.permissions)).toEqual(new Set(['activeTab', 'storage', 'contextMenus']));
    });

    it('has no inline scripts in extension pages (MV3 CSP)', () => {
        ['popup.html', 'test.html'].forEach((file) => {
            const html = readFileSync(join(ROOT_DIR, file), 'utf8');
            const scriptTags = html.match(/<script\b[^>]*>/gi) ?? [];

            scriptTags.forEach((tag) => {
                expect(tag, `${file} has an inline script tag: ${tag}`).toMatch(/\ssrc=/i);
            });
            expect(html, `${file} uses a javascript: URL`).not.toMatch(/javascript:/i);
        });
    });
});
