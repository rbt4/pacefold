# Security and privacy

Pacefold is a static, local-first Progressive Web App. It has no server-side application, account system, analytics endpoint, advertising SDK, or external runtime API.

The Pages workflow reconstructs a pinned release archive and rejects it unless its SHA-256 matches the reviewed build. JavaScript syntax and static application checks must pass before deployment.

Preferences, activity records, notification deduplication, profiles, and custom moments are stored in browser local storage.
