# Security and privacy

Pacefold is a static, local-first Progressive Web App. It has no Pacefold server-side application, account system, analytics endpoint or advertising SDK.

The Pages workflow copies the reviewed direct source, then runs JavaScript syntax checks, static application checks, migration tests and current-product browser tests before deployment.

Preferences, activity records, notes, cue acknowledgement state, profiles and custom moments are stored in browser local storage. If the user chooses a live backup file, its browser-granted handle is kept in IndexedDB and Pacefold writes the same versioned JSON backup after local data changes.

The optional OneNote connection uses Microsoft identity and delegated Graph `Notes.ReadWrite`; it has no client secret or application-only permission and sends only note date, time, category and text.

## Microsoft authentication state

Pacefold explicitly configures MSAL to use sessionStorage with auth-state cookies disabled. Microsoft access tokens are not persisted in localStorage and end with the Pacefold window session.
