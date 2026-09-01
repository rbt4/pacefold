# Pacefold — origin to final form

This is the product memory for Pacefold. It exists so a future redesign can simplify the implementation without simplifying away the reasons the product exists.

## The original idea

Pacefold began as a workday clock that could stay open all day and quietly hold the day around it. The clock was the object; everything else folded around it. The goal was never a productivity dashboard full of cards, streaks or demands.

The durable interaction model is therefore:

- Clock at the centre.
- Notes above, Day log left, Now right, Settings below.
- Directional movement returns through Clock.
- Information appears when useful and recedes when it is not.

## Time must feel alive

The clock keeps visible seconds and an analog instrument, not only a timestamp. Day Unfold turns the workday into a visual arc with a moving sun/current marker and scheduled points, carrying forward the early idea of seeing the day physically unfold.

The daily image belongs to the scenic front cover, with search and quick note kept there as lightweight browser-home utilities. Release 31 deliberately separates that entrance from the object left open all day: a quiet folio with analog and digital time, visible seconds, Day Unfold, rhythm and cues. This is not duplication; the two surfaces have different jobs.

## Quiet cues, not notification noise

Pacefold’s cues were conceived as subtle coloured marks that could be understood at a glance, including from the pinned/PWA identity:

- blue: water
- green: prayer/scheduled rhythm
- amber: noodles/prep
- violet: away
- warm red: meal
- cool blue: eyes
- olive: movement

The live clock favicon/taskbar identity and in-window cue beads are the browser/PWA expression of that idea. Several waiting cue colours may coexist. Clicking clears; holding/right-clicking snoozes. System notifications are silent and secondary.

## The personal defaults remain personal

The original profile is intentionally personal rather than pretending every default is universal:

- Muslim daily rhythm
- Hanafi Asr
- Toronto-area defaults
- original noodle timer
- hydration, meal/away, eye and movement care

For other profiles, the noodle timer presents as generic Prep and the rhythm can be everyday, mindful or custom. Personalization should generalize the product **without deleting the original behavior**.

## Prayer and discretion belong together

Prayer calculation is a real timing feature, but the ambient work Clock must remain discreet. Names, location and religious terminology do not leak just because a schedule exists.

The three modes are:

- **Neutral:** times/colour and “Scheduled moment” language.
- **Hidden:** rhythm card removed from Clock.
- **Names:** explicit moment names.

Neutral names can be deliberately revealed on Clock by a press-and-hold; passive hover must never reveal them. Quiet mode never makes the Clock less private.

## Daybook is a notebook, not a form

Notes evolved toward a paper-notebook Daybook: fast capture first, organization second. Its composer, recent entries and carry-forward work stay persistently in the lower half of Clock; the full upward fold adds calendar activity, categories, search, editing and contextual links to the day. It must remain useful even with no cloud connection and must not be replaced by a static summary.

Optional OneNote copy is additive. Pacefold local data remains the source of truth.

## The day log is a human record

Water, noodles/prep, away, meal, eyes, movement, notes, focus and field work can create a quiet timeline. The Day Log explains what happened without becoming employee surveillance. Comparison is against the same point yesterday so partial days are not compared with completed days.

## Now answers the next decision

Now is for immediate context: next scheduled point, waiting cues, active timers/focus, and useful weather. Weather should lead with temperature and near-term precipitation, include sunrise/sunset/UV, and carry enough forecast horizon across midnight to make “next 12 hours” meaningful.

## Music is one integrated dock

Pacefold originally had local focus sound. Later it gained YouTube/YouTube Music playback. Final form keeps both in one place:

- YouTube and YouTube Music song/playlist links
- real playlist track selection
- previous/next, seek, volume, shuffle and loop
- locally remembered My Music
- Brown hush, Rain glass, Soft fan and local audio

Private signed-in YouTube playlist enumeration is **not** simulated. That requires a real Google OAuth/Data API client. Public/unlisted links and My Music remain fully usable without it.

## Local-first means continuity

Historical storage names are compatibility anchors. Do not rename them casually:

- `pacefoldPrefsV15`
- `pacefold.notebook.entries.v2`
- `pacefold.dayflow.v1`
- cue DB `pacefold-v26`
- backup-handle DB `pacefold-v25`

A release may modernize code, but it must migrate forward without making the user set everything up again. JSON/live backups include the meaningful user state, including My Music in 27.1.

## Architecture lesson from V15–V24

The injection era accumulated layers over a frozen archive. It preserved features but made the product increasingly difficult to reason about and easy to regress. V25 Recovery was the necessary reset: direct readable source, one bundled runtime, one bundled stylesheet, explicit migration tests.

Future work should preserve the **behavioral lineage**, not the old layering technique.

## Final-form test

A change belongs in Pacefold when it makes the day quieter, clearer or more useful while keeping Clock central. If it adds another place to check, duplicates state, exposes private context passively, breaks local continuity, or replaces an older useful feature instead of integrating it, it is probably moving away from the product.
