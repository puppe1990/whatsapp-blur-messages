# Repository Guidelines

## Project Structure & Modules
- `manifest.json`: Chrome extension config (MV3).
- `content.js`: Injected into `web.whatsapp.com`; applies/removes blur, scans users.
- `background.js`: Service worker; context menu and messaging glue.
- `popup.html` / `popup.css` / `popup.js`: Popup UI, tabs, bulk actions, blur type settings.
- `test.html` / `test.js`: Local manual test page (no framework).
- Assets: `icon16.png`, `icon48.png`, `icon128.png`, `logo.svg`.
- Legacy reference: `whatsapp-blur-final.js` (keep for context; do not ship new logic here).

## Build, Test, and Development
- Build: No build step. Load unpacked folder via `chrome://extensions/` → Enable Developer Mode → Load unpacked.
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
- Manual tests only. Cover:
  - Popup flows (Settings, Manage Users, bulk blur/unblur).
  - Content script effects across navigation and dynamic loads.
  - Permissions and CSP: no inline scripts, no `eval`.
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
