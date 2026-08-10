# Pacefold Product Contract

Pacefold is a private workday instrument. This document is a release constraint, not a mood board.

## 1. The clock is home

Pacefold opens to the clock and returns to the clock. Notes, context, logging, settings and sound are temporary folds around that centre; they must not become the product's default surface.

## 2. Encoded at rest, explicit on intent

The passive screen must not announce the owner's routines to nearby people. Water, preparation/noodles, meal, away, eye/body breaks, prayer times, work categories and note content are represented at rest with the private Pacefold vocabulary: position, small marks, colour, progress and time.

Human-readable meaning may appear only after deliberate owner intent such as hover, keyboard focus, opening a fold, or entering the relevant settings surface. A redesign must not replace this with permanently labelled buttons, cards or headings merely to make the interface more self-explanatory.

## 3. Quiet is a safe-surface contract

Quiet is stronger than a visual theme. While Quiet is active:

- the app returns to the clock;
- the document title is `Clock`;
- sensitive cue/category words do not remain in visible text, `aria-label` or `title` attributes;
- note/category content is not exposed;
- Daybook and revealing secondary surfaces are closed;
- abstract cue marks may remain, but their meaning is not written out.

## 4. Daybook is a transient fold

Daybook is not a dashboard and not a navigation launcher.

- It starts closed.
- Its closed state is a small paper/fold affordance with no note text, metrics, categories or explicit `Daybook` / `Open` labels on screen.
- Opening it reveals a focused local note sheet, not a productivity summary.
- Saving folds it closed after confirmation.
- Escape, clicking outside, hiding/blurring the app, and inactivity fold it closed.
- Unsaved work must not be silently discarded by future changes.
- Calendar/activity may be shown with private density marks; actual note text appears only after entering Notes intentionally.

## 5. NOW is an ambient glance

The right-side NOW face answers “what is around me / what is approaching?” It is not a productivity dashboard.

Appropriate passive information includes weather, the next scheduled mark represented privately, its time/countdown, and where the workday sits on its arc. Logged minutes, focus totals, note counts, work categories and verbose schedule explanations do not belong on the passive NOW face.

## 6. Day Unfold is the ambient timeline

The moving sun/day arc is the primary visual explanation of the day. Scheduled moments appear as restrained marks on that timeline. The system should prefer this spatial vocabulary over another stack of cards or labelled schedule tiles.

## 7. Preserve the user's data and muscle memory

Privacy/UI refactors must preserve existing localStorage/IndexedDB data addresses or migrate them safely. Notes, settings, backups, logs and existing cue state must survive releases. Do not reset setup or require reconfiguration merely because the visual layer changed.

## 8. Release gates

A Pacefold release is not acceptable merely because the DOM exists or JavaScript has no syntax errors. CI must separately prove:

1. core functionality;
2. viewport/geometry coherence;
3. privacy-safe Quiet behaviour;
4. discreet passive home behaviour;
5. transient Daybook behaviour;
6. ambient NOW behaviour;
7. local persistence and offline compatibility.

Screenshots from these audits are release evidence and should be inspected when changing the product surface.

## Historical anchors

This contract preserves deliberate Pacefold decisions already shipped before V25: the V17.1 rhythm-first/transient-notebook return and the V22.0.2 Day Unfold/privacy-safe cue model. Future versions may refine their implementation, but must not silently remove those principles.
