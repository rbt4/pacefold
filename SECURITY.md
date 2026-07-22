# Security and privacy

Pacefold is a static, local-first Progressive Web App. It has no Pacefold server-side application, account system, analytics endpoint or advertising SDK.

The Pages workflow reconstructs a pinned release archive and rejects it unless its SHA-256 matches the reviewed build. JavaScript syntax, static application checks and browser action/upgrade tests must pass before deployment.

Preferences, activity records, captures, notification deduplication, notification-action history, profiles and custom moments are stored in browser local storage. A separate same-origin action cache temporarily holds a clicked notification response until Pacefold records and acknowledges it; entries expire after seven days and contain only the cue key, source, action and timestamp.

The optional OneNote connection uses Microsoft identity and delegated Graph `Notes.ReadWrite`; it has no client secret or application-only permission and sends only capture time, category and text.
