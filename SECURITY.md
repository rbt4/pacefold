# Security and privacy

Pacefold is a static, local-first Progressive Web App. It has no server-side application, account system, analytics endpoint, advertising SDK, or external runtime API.

Preferences, activity records, notification deduplication, and Kaizen suggestions are stored in browser local storage. The service worker caches only Pacefold's own static files under a versioned `pacefold-v` cache prefix.

The GitHub Pages workflow validates JavaScript syntax, manifest data, icon dimensions, static references, service-worker shell entries, and DOM references before deployment.

Please report a security concern privately through the repository owner rather than publishing sensitive details in a public issue.
