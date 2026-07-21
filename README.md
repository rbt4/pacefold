# Pacefold

**Your day, quietly kept.**

Pacefold is a local-first Progressive Web App for a calm workday rhythm: prayer mini-breaks, hydration, noodle preparation, desk meals, away lunches and brief away/bathroom sessions.

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
- Hydration pauses during prayer, meal windows or away sessions and resumes after a grace period.
- Overlapping prayer, away and away-lunch intervals are merged before off-desk time is totaled.
- A private timeline and Day Close remain local.

## Taskbar code language

| Code | Meaning |
|---|---|
| 1 | Prayer / schedule |
| 2 | Sip pace |
| 3 | Meal preparation |
| 4 | Away break |
| 5 | Meal window |

## Deploy

The repository contains a tested static release bundle split into hash-verified Git objects and a GitHub Pages workflow.

1. In **Settings → Pages**, choose **GitHub Actions** as the source.
2. Push to `main` or run the workflow manually.
3. Open `https://rbt4.github.io/pacefold/` in Microsoft Edge.
4. Install Pacefold as an app and pin it to the taskbar where workplace policy permits.

## Privacy

No account, analytics, advertisements or external runtime APIs. Activity records and suggestions remain in browser storage.

## Version

Pacefold 12.0.0
