# Connect Pacefold to Microsoft OneNote

Pacefold always saves captures on the device first. The Microsoft connection is optional and uses delegated `Notes.ReadWrite` access: it can append your captures only while you are signed in. No client secret belongs in Pacefold.

## One-time Microsoft Entra setup

1. Open [Microsoft Entra admin center](https://entra.microsoft.com/) and go to **Identity → Applications → App registrations → New registration**.
2. Name the registration `Pacefold`.
3. Choose the account type that matches the OneNote account. For a University of Toronto work account, use the organizational-directory option permitted by the tenant.
4. Under **Redirect URI**, choose **Single-page application (SPA)** and enter exactly:

   `https://rbt4.github.io/pacefold/app/auth.html`

5. Create the registration and copy its **Application (client) ID**.
6. Open **API permissions → Add a permission → Microsoft Graph → Delegated permissions**. Add `Notes.ReadWrite`.
7. Do not create or paste a client secret. A browser-based SPA cannot keep one confidential.
8. In Pacefold, open **OneNote**, paste the client ID, and use `organizations` as the tenant unless your administrator gives you a tenant ID or verified domain.
9. Sign in and choose the HSSys notebook and the section Pacefold should append to.

If the university blocks app registration, user consent, or OneNote Graph access, an administrator must approve the registration or permission. Captures continue working locally and remain queued; Pacefold does not bypass workplace policy.

## What is synchronized

- One dated page per day in the selected OneNote section.
- Capture time, category, and text.
- Follow-up captures receive OneNote's to-do tag.
- Offline captures retry when the app is online and Microsoft access is available.

Pacefold does not upload hydration, prayer, meal, away, movement, or screen-use records. Changing or disconnecting the destination keeps local captures intact.

Microsoft references: [MSAL Browser initialization](https://learn.microsoft.com/en-us/entra/msal/javascript/browser/initialization), [OneNote Graph overview](https://learn.microsoft.com/en-us/graph/integrate-with-onenote), [create a OneNote page](https://learn.microsoft.com/en-us/graph/onenote-create-page), and [update a OneNote page](https://learn.microsoft.com/en-us/graph/onenote-update-page).
