# Broadcast and meeting mobile quirks

Role-play pass on `run.html` (Broadcast is this page with `#bc=1`). Served locally and driven with Playwright Chromium, touch, mobile emulation.

Devices: iPhone SE (320×568), iPhone 15 (393×659), Pixel 7 (412×839), a 360×740 Android, each in portrait and landscape.

Personas: church volunteer starting a broadcast, late viewer on a shared link, flaky connection, low-vision at a 32px root font, broadcaster who needs to flip cameras.

Screenshots for the open bugs are in `test/mobile/screenshots/before/`.

## Open

### Q2. The chat field sits under the dock

Same meeting, chat opened. The message field overlaps the dock on iPhone SE portrait, iPhone SE landscape, and 360 portrait. On portrait the Send button overlaps the dock too. Send is 34px tall, under a 44px touch target.

Broadcast viewers hide camera and mic, so the dock is narrower and Send clears it, but the message field still overlaps.

Before: `test/mobile/screenshots/before/iphone-se-meeting-chat.png`.

### Q3. More sheet starts above the viewport in iPhone SE landscape

Meeting or broadcast, More open, 568×320. The sheet box top is −8px and `overflow` is `visible`, so the top of the sheet is clipped and cannot be scrolled back. Button boxes in that pass were still inside the viewport. Shorter phones, or a host with more controls, get worse.

Before: `test/mobile/screenshots/before/iphone-se-landscape-more.png`.

### Q4. “Create & enter” is below the fold on every phone

Broadcast lobby (`#bc=1`), Start broadcasting expanded. The create button’s top is past the viewport on iPhone SE (y ≈ 853, viewport 568), iPhone 15, Pixel 7, and 360, portrait and landscape. The card can scroll (`scrollHeight > clientHeight`), and nothing tells a volunteer to scroll. Passwords and the create action are the part that matters.

Before: `test/mobile/screenshots/before/iphone-se-portrait-lobby-form.png`.

### Q5. No LIVE / OFF AIR / WATCHING signal

A broadcast viewer (`body.broadcast.admroom.notadmin`) shows the status “Joining the broadcast…”. A meeting that never reaches the room says “Just you — send the invite; the link has no expiry”. There is no on-air badge. Camera and mic are `display: none` for a broadcast viewer, which is intended, and easy to misread as “the app forgot the camera” when the status line is also vague. Flip camera stays `display: none` until `enumerateDevices` reports two cameras, so a phone host does not get a flip control up front.

Before: `test/mobile/screenshots/before/iphone-se-portrait-host.png`.

### Q6. 200% root font does not grow the status line

`document.documentElement.style.fontSize = '32px'`. Lobby actions use `rem` and grow. `.topchip .status` stays `17px` (`20px` only on the wide landscape dock). The in-call status is the line a low-vision viewer has to read for reconnecting versus alone.

Before: `test/mobile/screenshots/before/iphone-se-portrait-zoom.png`.

### Q7. No safe-area insets

The viewport meta is `width=device-width, initial-scale=1.0, interactive-widget=resizes-content`. The dock is `bottom: 14px` and the top chip is `top: 14px`. Neither uses `env(safe-area-inset-*)`, and the meta does not set `viewport-fit=cover`. On a notched phone the chip and the dock sit under the hardware.

### Q8. Chat header spends a third of a short screen

`#chathead` lays the title, the “private to this meeting…” subtitle, Transcript, and close in one wrapping row. On iPhone SE portrait the header measures 110px tall before any message. Combined with Q2, the log is a short band between a tall header and the dock.

## Fixed

### Q1. Hang up is off the screen on a 320px and 360px phone

Measured on a meeting (`#v=sundayroom`), portrait. Leave’s right edge was 374px on both a 320px iPhone SE and a 360px Android. The dock is `width: auto` with `overflow: visible`, so the red hang-up control was only a sliver.

Below 380px the dock now uses 44px primary controls and a 48px Leave, all inside the screen. `test/mobile/dock-fit.spec.mjs` covers iPhone SE, iPhone 15, Pixel 7, and the 360px Android.

Before: `test/mobile/screenshots/before/iphone-se-meeting-dock.png`.
After: `test/mobile/screenshots/after/iphone-se-meeting-dock.png` and `test/mobile/screenshots/after/android-360-meeting-dock.png`.
