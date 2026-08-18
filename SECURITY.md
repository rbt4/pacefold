# Security and privacy

Clock is a static, local-first Progressive Web App. It has no application server, account system, analytics endpoint or advertising SDK.

The Pages workflow builds from reviewed source, bundles one application runtime and one stylesheet, then runs syntax checks, static contracts, migration tests, security checks and current-product browser tests before deployment.

## Local data

Preferences, activity records, notes, cue acknowledgement state, profiles and custom moments are stored in browser storage. Existing storage identifiers are intentionally retained for upgrade continuity.

Backup restore is format-validated and capped at 5 MB before parsing. If the user chooses a live backup file, its browser-granted handle is stored in IndexedDB and the app writes the same versioned JSON backup after local changes when write permission remains granted.

## Network boundary

The production application uses a default-deny Content Security Policy. Network access is limited to the application origin plus the specific services needed for optional features:

- Open-Meteo for weather.
- Microsoft identity and Microsoft Graph for optional OneNote copy.
- YouTube's official IFrame Player API for user-requested music playback.
- YouTube image CDN for artwork after the user loads a track.

Direct media fetching from arbitrary HTTPS origins is not allowed by the parent document. External links use `noopener noreferrer` and no-referrer handoff behavior.

The application sends a strict-origin referrer policy at the document level. Controlled service-worker responses also add `X-Content-Type-Options: nosniff`, a strict referrer policy and `frame-ancestors 'none'`.

## Service worker

The offline worker precaches an explicit shell allowlist. Unknown same-origin GET requests are fetched without being added to the offline cache. Navigation responses are cached only under their canonical shell fallback, which avoids query-string cache growth. Microsoft auth bridge pages are network-only and are not part of the precached shell.

The durable cue database remains `pacefold-v26` so security updates do not invalidate existing acknowledgement state.

## Microsoft authentication

The optional OneNote connection uses Microsoft identity and delegated Graph `Notes.ReadWrite`. It has no client secret or application-only permission and sends only note date, time, category and text.

MSAL is configured to use `sessionStorage`, with auth-state cookies disabled. Microsoft access tokens are not persisted in `localStorage` and end with the window session.

The OneNote authority value is normalized before MSAL receives it, and the runtime rejects Microsoft Graph requests outside `/me/onenote`. Graph requests explicitly omit credentials/cookies, bypass browser caches and suppress referrer data.

## Privacy screen

When the full Clock interface is open and the window loses focus, an opaque privacy curtain is applied without changing the current view or stored state. This is intended to reduce note/rhythm exposure in task-switcher or window previews. The photographic start surface is already treated as the discreet surface and is not covered by this curtain.

## Platform limits

GitHub Pages does not provide application-controlled server response headers on the first uncontrolled visit. Security-critical restrictions that can be expressed in document metadata are therefore included in the HTML shell, while the service worker adds additional response headers after it controls the installed application. Cross-origin isolation headers are intentionally not enabled because the Microsoft popup flow and YouTube embed require compatible cross-origin behavior.
