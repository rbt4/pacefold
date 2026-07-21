# Repository setup

Repository: `rbt4/pacefold`

## GitHub Pages

1. Open **Settings → Pages**.
2. Set **Source** to **GitHub Actions**.
3. Open **Actions** and confirm **Validate and deploy Pacefold** succeeds.
4. Open `https://rbt4.github.io/pacefold/` in Microsoft Edge.
5. Use the landing-page **Install Pacefold** control.
6. Pin the installed app from `edge://apps` when organizational policy permits.

## Release behaviour

- Pull requests run the full static validation job but do not deploy.
- Pushes to `main` validate first, build a clean `_site` artifact, validate the artifact again, and then deploy.
- Installed copies check automatically for updates while open.
- Local preferences and activity records are not stored in the repository and survive normal application updates.

## Platform limitations

Pacefold must remain open or minimized for live JavaScript timers, notifications, and taskbar badges. Workplace policy can disable installation, notifications, service workers, background activity, or badges.
