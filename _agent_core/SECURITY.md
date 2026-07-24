# Security and privacy

Pacefold is a static, local-first Progressive Web App. It has no Pacefold server-side application, account system, analytics endpoint or advertising SDK.

Preferences, activity records, captures, notification deduplication, notification-action history and Kaizen suggestions are stored in browser local storage. The service worker caches Pacefold's own static files, including a pinned local copy of Microsoft MSAL Browser, under a versioned `pacefold-v` cache prefix. A separate same-origin `pacefold-notification-actions-v1` cache temporarily holds a clicked notification action until the app records and acknowledges it; entries expire after seven days and contain only the cue key, source, action and timestamp.

The optional OneNote connection uses Microsoft identity and Microsoft Graph with delegated `Notes.ReadWrite`. It requires an explicit application ID, user sign-in and destination choice. Pacefold contains no client secret and requests no application-only permission. Only capture time, category and text are sent; the workday activity ledger remains local. Microsoft tenant policy can deny the connection.

Direct HTTPS audio is fetched only after a user saves that source. Generated soundscapes are created locally, and local audio files remain session-only object URLs.

The GitHub Pages workflow validates JavaScript syntax, manifest data, icon dimensions, static references, service-worker shell entries, and DOM references before deployment.

Please report a security concern privately through the repository owner rather than publishing sensitive details in a public issue.
