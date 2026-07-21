# Pacefold

**Your day, quietly kept.**

Pacefold is a local-first Progressive Web App for a calm workday rhythm: prayer mini-breaks, hydration, noodle preparation, desk meals, away lunches, and brief away/bathroom sessions.

## Pacefold 13

Version 13 turns the project into a root-scoped, installable PWA with a guided setup surface, automatic update checks, notification diagnostics, offline recovery, and a CI validation gate.

### Install

1. Open `https://rbt4.github.io/pacefold/` in Microsoft Edge.
2. Select **Install Pacefold** on the landing page.
3. Approve the Edge installation prompt.
4. Pin Pacefold to the taskbar from Edge Apps when workplace policy permits.
5. Open Pacefold or leave it minimized during work hours.

The landing page reports whether the browser, install prompt, offline engine, and notifications are available. The direct app also includes a setup dock and system health panel.

### Updates

Pacefold checks for a new service worker:

- shortly after startup;
- every 30 minutes while open;
- when the app regains focus;
- when it becomes visible again;
- when connectivity returns.

A verified update activates automatically and reloads the app once. Local settings and daily records are preserved across updates.

### Notifications

Notifications are optional. Pacefold works with its in-app signals and taskbar codes even when notifications are disabled.

- **Important only**: prayer, completed noodle timer, completed meal window, and unusually long away sessions.
- **All cues**: important cues plus hydration reminders.
- **Enable / test system notification** performs an immediate permission and delivery test.

Windows or organizational Edge policy may block notifications, PWA installation, background activity, or taskbar badges. Pacefold reports the browser's actual permission state rather than claiming notifications are active when they are blocked.

The app must remain open or minimized for JavaScript timers and scheduled cues to continue. A closed browser app cannot guarantee background reminders.

## Design system

Pacefold uses Japanese operating and spatial principles as product behaviour rather than decoration:

- **Ma** — protect meaningful intervals instead of treating every pause as waste.
- **Andon** — remain quiet and signal only the exception that needs attention.
- **Kiroku** — keep an accurate private record on the device.
- **Kaizen** — offer at most one optional, practical improvement at a time.
- **Hansei** — close the day with a calm summary and no productivity score.

## Workday model

- Prayer acknowledgement can begin a mini-break timer; press Enter again when back.
- Desk meal is the default because eating at the desk is not the same as leaving work.
- Shift+L starts the less-common away lunch.
- Collecting noodles can automatically begin a desk-meal window.
- Hydration pauses during prayer, meal windows, or away sessions and resumes after a grace period.
- Overlapping prayer, away, and away-lunch intervals are merged before off-desk time is totaled.
- A private timeline and Day Close remain local.

## Taskbar code language

| Code | Meaning |
|---|---|
| 1 | Prayer / schedule |
| 2 | Sip pace |
| 3 | Meal preparation |
| 4 | Away break |
| 5 | Meal window |

## Keyboard controls

- **W** — log 2–3 sips
- **N** — start or inspect noodle preparation
- **B** — start or finish an away break
- **L** — start a desk-meal window
- **Shift+L** — start an away lunch
- **P** — start or finish a prayer break
- **Enter** — perform the highest-priority action
- **S** — snooze or add five minutes
- **R** — temporarily reveal labels
- **H** — plain-clock cover
- **,** — settings

Global shortcuts are suppressed while a button, link, input, or editable control has focus.

## Validation

Pull requests and pushes to `main` run:

- JavaScript syntax checks;
- manifest and icon validation;
- local asset-reference validation;
- service-worker shell validation;
- DOM ID/reference validation;
- a clean Pages-artifact validation before deployment.

## Privacy

No account, analytics, advertisements, or external runtime APIs. Activity records, notification deduplication, and suggestions remain in browser storage.

## Version

Pacefold 13.0.0
