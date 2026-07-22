# Security and privacy

Pacefold is a static, local-first Progressive Web App. It has no Pacefold server-side application, account system, analytics endpoint or advertising SDK.

The Pages workflow reconstructs a pinned release archive and rejects it unless its SHA-256 matches the reviewed build. JavaScript syntax and static application checks must pass before deployment.

Preferences, activity records, captures, notification deduplication, profiles and custom moments are stored in browser local storage. The optional OneNote connection uses Microsoft identity and delegated Graph `Notes.ReadWrite`; it has no client secret or application-only permission and sends only capture time, category and text.
