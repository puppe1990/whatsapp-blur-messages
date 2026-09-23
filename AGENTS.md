# Repository Guidelines

## Project Structure & Modules

- `manifest.json`: Chrome extension config (MV3).
- `content.js`: Injected into `web.whatsapp.com`; applies/removes blur, scans users.
- `background.js`: Service worker; context menu and messaging glue.
- `popup.html` / `popup.css` / `popup.js`: Popup UI, tabs, bulk actions, blur type settings.
- `test.html` / `test.js`: Local manual test page (no framework).
- `tests/`: Vitest + jsdom automated tests (content script messaging, background handlers, manifest/CSP checks).
- Assets: `icon16.png`, `icon48.png`, `icon128.png`, `logo.svg`.
- Legacy reference: `whatsapp-blur-final.js` (keep for context; do not ship new logic here).

## Build, Test, and Development

- Build: No build step for the extension itself. Load unpacked folder via `chrome://extensions/` → Enable Developer Mode → Load unpacked.
- Dev tooling: `npm install` installs ESLint, Prettier, Vitest, husky and lint-staged (dev-only; nothing from `node_modules/` ships with the extension).
- Checks: `npm run lint`, `npm run format:check`, `npm test` (use `npm run format` to auto-format).
- Hooks: the husky pre-commit hook runs ESLint + Prettier on staged files and the full test suite.
- CI: `.github/workflows/ci.yml` runs lint, format check and tests on every push/PR.
- Reload: After edits, click the extension’s Reload in `chrome://extensions/`.
- Local test page: Open `test.html` directly in your browser (or `python3 -m http.server` and visit the file). Use the buttons to simulate blur/clear.
- Target site: Validate on `https://web.whatsapp.com/` with the popup actions and context menu.

## Coding Style & Naming

- JavaScript: 4‑space indent, semicolons, `const`/`let`, arrow functions where suitable.
- Naming: camelCase for vars/functions; PascalCase only for classes/components.
- Strings: Prefer single quotes; match surrounding file if mixed.
- DOM/CSS: Add/remove classes instead of inline styles where possible.
- Keep console logs informative; remove noisy debugging before merging.

## Testing Guidelines

- Automated tests: Vitest + jsdom in `tests/` (`npm test`). They drive `content.js` through its message API (`ping`, `scanUsers`, `applyBlur`, `toggleBlur`, `clearBlur`, `toggleUserBlur`, …) and validate `background.js` handlers plus `manifest.json`/CSP invariants. Add or update tests when touching message handling or the manifest.
- Manual tests (still required for UI behavior). Cover:
    - Popup flows (Settings, Manage Users, bulk blur/unblur).
    - Content script effects across navigation and dynamic loads.
    - Permissions and CSP: no inline scripts, no `eval` (also asserted in `tests/manifest.test.js`).
- Regressions: Verify previously blurred elements re‑apply after page changes.

## Commit & PR Guidelines

- Commits: Imperative mood, concise summary (“Add…”, “Fix…”, “Refactor…”). Add context in body when needed.
- PRs must include:
    - Clear description, rationale, and testing steps.
    - Screenshots/GIFs for UI changes (popup, context menu).
    - Notes on `manifest.json` changes and required permissions.
    - Risk/impact and manual validation evidence.

## Security & Config Tips

- Limit permissions to what’s required (`activeTab`, `storage`, `contextMenus`).
- Respect WhatsApp DOM changes; use resilient selectors and `MutationObserver`.
- Keep content script CSS in injected `<style>` with a stable id; clean up on clear.
