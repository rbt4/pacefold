# Repository setup

Repository: `rbt4/pacefold`

## GitHub Pages

1. Open **Settings → Pages**.
2. Set **Source** to **GitHub Actions**.
3. Open **Actions** and confirm **Validate and deploy Pacefold** succeeds.
4. Open `https://rbt4.github.io/pacefold/` in Microsoft Edge.
5. Use **Personalize first** or open `/app/?setup=1`; the setup wizard works even when Edge does not expose its native prompt.
6. Finish the profile, routine, comfort and alert steps.
7. Approve the native install prompt when offered, or follow **Edge → Apps → Install Pacefold**.
8. Pin the installed app from `edge://apps` when organizational policy permits.
9. Right-click the pinned icon to confirm the Log / clear, Capture, Care and Sound shortcuts appear. Manifest shortcut updates can require Edge to refresh the installed app registration.

## Release behaviour

- Pull requests run the full static validation job but do not deploy.
- Pushes to `main` validate first, build a clean `_site` artifact, validate the artifact again, and then deploy.
- Installed copies check automatically for updates while open.
- Local preferences and activity records are not stored in the repository and survive normal application updates.

## Platform limitations

Pacefold must remain open or minimized for live JavaScript timers, notifications, and taskbar badges. The taskbar stays empty until a cue is due and then shows a dot; the live numeric countdown is opt-in. Workplace policy can disable installation, notifications, service workers, background activity, or badges. Edge PWAs support numeric/dot badges, notification actions and right-click shortcuts; they cannot intercept a normal Windows taskbar click before the operating system opens or focuses the app, and cannot continuously replace the pinned icon artwork with a live clock face.
