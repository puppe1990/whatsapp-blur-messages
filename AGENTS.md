# Repository Guidelines

## Commands

- Setup (clean checkout): `NODE_ENV=development npm install` (dev tooling only; the extension itself has no build step).
- Test: `npm test` (Vitest + jsdom, headless).
- Lint: `npm run lint` (autofix: `npm run lint:fix`).
- Format: `npm run format` (verify: `npm run format:check`).
- Typecheck: none (plain JavaScript).
- Load/reload: `chrome://extensions/` → Developer Mode → Load unpacked; click Reload after edits.
- Manual page: open `test.html` directly (or `python3 -m http.server`) and use its buttons.
- Target site: validate on `https://web.whatsapp.com/` with popup actions and context menu.

## Structure

- `manifest.json`: MV3 config; content scripts run in the order listed.
- Content scripts (injected into `web.whatsapp.com`, one shared scope, no imports):
    - `content-state.js`: shared mutable state (loaded first).
    - `blur-styles.js`: blur CSS generators per blur type.
    - `whatsapp-dom.js`: chat-context detection and navigation-chrome exclusions (`NAVIGATION_EXCLUSIONS`, `isNavigationChrome`).
    - `blur-controller.js`: apply/toggle/clear, mutation observer, re-apply monitoring.
    - `blur-contact.js`: per-contact blur across chat list, header and messages.
    - `user-scanner.js`: scan visible users, toggle/remove blur per user.
    - `user-bulk-actions.js`: blur/unblur all, full style cleanup, clear list.
    - `wpp-export.js`: message extractor (~930 lines — over budget; split before adding logic).
    - `notify-mute.js`: publishes blurred contact names and opens the mute window when one of them shows new chat-list activity.
    - `content.js`: message router and startup bootstrap (loaded last).
- `page-sound-guard.js`: separate `content_scripts` entry with `"world": "MAIN"`, `run_at: "document_start"` (requires Chrome 111+). Content scripts cannot patch page JavaScript, so this one runs in the page context to mute WhatsApp notification sounds and suppress system notifications for blurred/hidden contacts.
- `background.js`: service worker; context menu and storage defaults.
- `popup.html` / `popup.css` / `popup.js`: popup UI, tabs, bulk actions (~1200 lines — over budget; split before adding logic).
- `test.html` / `test.js`: local manual test page.
- `tests/`: Vitest + jsdom tests mirroring the content script message API, background handlers and manifest/CSP invariants; the harness loads the content scripts in manifest order.
- Legacy dumps: `whatsapp-blur-*.js` — ignored by lint/format; never ship new logic there.

## Conventions

- Content scripts share one scope: declare APIs a file consumes with `/* global */` and ones it provides with `/* exported */`; load order lives in `manifest.json`.
- Compare contact names through `normalizeContactName` (`whatsapp-dom.js`): it ignores case, accents and the bidi/zero-width marks WhatsApp adds to titles.
- Cross-world state (isolated → main) lives on `document.documentElement.dataset`: `data-wa-muted-names` (normalized blurred names, `\n` separated) and `data-wa-mute-until` (epoch ms). Change `notify-mute.js` and `page-sound-guard.js` together when touching that contract.
- Storage: the contact list (`managedUsers`, including each contact's hide/show state) lives in `chrome.storage.local`; UI settings stay in `chrome.storage.sync`.
- JavaScript: 4‑space indent, single quotes, semicolons — enforced by Prettier.
- Naming: camelCase for vars/functions; PascalCase only for classes/components.
- DOM/CSS: toggle classes instead of inline styles where possible; keep injected CSS in a `<style>` with a stable id and clean it up on clear.

## Rules

- Files stay under 500 lines; functions under ~20 lines, one job each.
- Names must be grep-unique; no `Manager`/`Service`/`util` dumping grounds.
- Max 2 levels of control flow nesting; prefer early returns.
- Keep WHY comments and provenance; delete only obvious noise.
- Errors and logs carry the offending value; remove noisy debugging before merging.
- Respect WhatsApp DOM changes: resilient selectors plus `MutationObserver`.

## Testing

- New behavior requires a new test; every bugfix requires a regression test.
- `npm test` must pass on a clean checkout. Pre-commit (husky) runs staged lint/format plus the full suite; CI runs lint, format check and tests on every push/PR.
- Manual tests still required for UI behavior: popup flows, content script across navigation/dynamic loads, no inline scripts / no `eval` (also asserted in `tests/manifest.test.js`).
- Main-world changes (`page-sound-guard.js`) only inject at `document_start`: reload the WhatsApp tab after installing or reloading the extension.
- Regressions: previously blurred elements must re‑apply after page changes.

## Commit & PR Guidelines

- Commits: imperative mood, concise summary (“Add…”, “Fix…”, “Refactor…”); add context in the body when needed.
- PRs include description/rationale, testing steps, screenshots for UI changes, `manifest.json`/permission notes and risk/impact.

## Boundaries

- Ask before: changing `manifest.json` permissions, touching CI/CD, force-pushing, publishing.
- Do not edit: `whatsapp-blur-*.js` legacy dumps, `node_modules/`, lockfiles by hand.
- Limit permissions to what’s required (`activeTab`, `storage`, `contextMenus`).
