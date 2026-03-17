# Web Studio Deferred Desktop-Only Matrix

This matrix documents desktop-only capabilities intentionally deferred from SaaS Web Studio, with safe replacements and acceptance criteria.

## Deferred Items

| Desktop-only feature | Why deferred in SaaS | Web-safe replacement now | Acceptance criteria |
| --- | --- | --- | --- |
| Native file/folder selection dialogs (`open` dialogs) | Browser cannot access arbitrary host paths securely | Upload-driven flows and app-scoped file APIs in workspace code mode | User can attach files and edit app files without host FS picker |
| OS keychain/native secret affordances | Host-specific APIs unavailable in browser | Provider settings forms stored via backend secret settings channels | API keys and provider settings are editable and persisted via bridge |
| Local model host controls (host process management) | Requires local machine process controls with high risk | SaaS-focused provider model selection + custom provider/model forms | User can select cloud/local provider records and custom models |
| Desktop notifications/system tray affordances | No browser access to Electron tray APIs | In-app status banners/panels (chat, preview, logs) | All operational status is visible inside Web Studio without tray |
| Native shell integration shortcuts | Would expose risky host execution from browser context | IPC-guarded integrations panel (GitHub/Supabase/Neon/MCP) | User can perform core integration actions from controlled server APIs |
| Multi-window desktop UX | Browser app should remain single SPA shell | Route-based panels (`/`, `/app/:id`, `/settings`) + workspace mode sidebar | User navigates core builder/settings flows without extra windows |

## Future Web Equivalents

- Add web-native file browser constrained to app workspace root.
- Add OAuth-based tenant auth and scoped per-user secret storage.
- Add role-based permissions around integrations and publish actions.
- Add server-side job queue for long-running operations and audit logs.

## Safety Notes

- Keep token-authenticated bridge with rate limiting enabled.
- Do not expose admin/internal routes through public gateway paths.
- Keep desktop-only APIs guarded in headless mode (`DYAD_HEADLESS=1`).
