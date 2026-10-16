# Broadcast and meeting mobile quirks

Role-play pass on `run.html` (Broadcast is this page with `#bc=1`). Served locally and driven with Playwright Chromium, touch, mobile emulation.

Devices: iPhone SE (320×568), iPhone 15 (393×659), Pixel 7 (412×839), a 360×740 Android, each in portrait and landscape.

Personas: church volunteer starting a broadcast, late viewer on a shared link, flaky connection, low-vision at a 32px root font, broadcaster who needs to flip cameras.

Screenshots for the open bugs are in `test/mobile/screenshots/before/`.

## Open

### Q9b. The join step does not show how you will appear

The name step says “Pick a screen name”. It does not say “This is how you’ll appear in the meeting”, and there is no face-plus-name preview you can correct before Continue. The system picture is on the step now (Q9). The preview is next.

### Q11. Join actions are the same color and sit together

`Not now` and `Continue` both use the accent fill. There is no gap rule between them, so they read as one control. A primary and a secondary need different fills and at least 8px between them. Both targets are already 48px tall.

### Q10. Compact dock buttons sit 4px apart

Below 380px the dock gap is 4px so Leave still fits. Larger phones use 8px or 12px. The targets are 44px. The tighter gap is a polish item, after the phone-layout gaps. Not the next fix.

## Fixed

### Q9. The join step ignored the GifOS name and picture

A stored `gifos_name` skipped the step, so the field never showed it. With no name, the field was empty while a `Guest` number was stored in the background. The system picture was not on the step. The step now opens with the GifOS display name in the field and the GifOS picture above it. A first visit with no name still gets a guest seed so the room can connect. `test/mobile/appear-prefill.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-name-step.png`.
After: `test/mobile/screenshots/after/iphone-se-name-prefill.png`.

Design: the picture and the name are finally the same identity as Settings. The step still fails hierarchy. `Not now` and `Continue` are the same purple, with no gap, and the heading still says “Pick a screen name” instead of showing how you will look. Contrast of the muted sentence on the dark card is the old theme, not the light meeting.

### Q1. Hang up is off the screen on a 320px and 360px phone

Measured on a meeting (`#v=sundayroom`), portrait. Leave’s right edge was 374px on both a 320px iPhone SE and a 360px Android. The dock is `width: auto` with `overflow: visible`, so the red hang-up control was only a sliver.

Below 380px the dock now uses 44px primary controls and a 48px Leave, all inside the screen. `test/mobile/dock-fit.spec.mjs` covers iPhone SE, iPhone 15, Pixel 7, and the 360px Android.

Before: `test/mobile/screenshots/before/iphone-se-meeting-dock.png`.
After: `test/mobile/screenshots/after/iphone-se-meeting-dock.png` and `test/mobile/screenshots/after/android-360-meeting-dock.png`.

### Q2. The chat field sits under the dock

Same meeting, chat opened. The message field overlapped the dock on every phone in the pass, portrait and landscape. Send was 34px tall. On iPhone SE an overlaid keyboard (visual viewport at 46% of the layout height) pushed the field into the dock again until the phone header stopped wrapping.

The composer now sits in the band above the dock (`--dock-clear`), Send and the field are at least 44px, and a `visualViewport` shrink lifts both the dock and the field. `test/mobile/chat-dock.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-meeting-chat.png`.
After: `test/mobile/screenshots/after/iphone-se-meeting-chat.png`.

### Q8. Chat header spent a third of a short screen

`#chathead` wrapped the title, the privacy sentence, Transcript, and close into about 110px on iPhone SE. On a phone the sentence is now clipped for sighted layout and kept for screen readers, and Transcript / close are 44px. That was required for Q2: the tall header pushed Send under the dock once the keyboard opened.

### Q5b. Flip was hidden until a second camera was enumerated

`#flipcam` lived in More and stayed `display: none` until `enumerateDevices` reported two video inputs, which does not happen before the camera is granted. On a phone it now sits on the dock, at least 44px, as soon as the screen is narrow or the pointer is coarse. The grip steps aside so Leave still fits. A broadcast viewer still does not get it. A desktop still waits for a second camera. `test/mobile/flip-cam.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-portrait-host.png`.
After: `test/mobile/screenshots/after/iphone-se-flip-dock.png`.

### Q6. The status line ignored a 200% root font

`document.documentElement.style.fontSize = '32px'`. Lobby actions use `rem`. `.topchip .status` stayed `17px` on a phone and `20px` on a wide layout. It is now `1.0625rem` on a phone and `1.25rem` on a wide layout, so a 32px root paints it at 34px or 40px, and the chip stays on screen. `test/mobile/status-scale.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-portrait-zoom.png`.
After: `test/mobile/screenshots/after/iphone-se-status-scale.png`.

### Q7. The chip and the dock ignored the notch and the home indicator

The viewport meta had no `viewport-fit=cover`. The chip was `top: 14px` and the dock was `bottom: calc(14px + var(--kb))`, so both sat in the hardware inset. They now use `max(env(safe-area-inset-*), --safe-*)`. A 47px notch and a 34px home indicator move the chip, Fit, and the dock, and chat stays above the raised dock. Side insets do the same in landscape. `test/mobile/safe-area.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-safe-area.png` (red bands are the injected insets).

### Q3. More sheet started above the viewport in landscape

Meeting, More open. On iPhone SE landscape the sheet top was −194px (the earlier pass measured −8px with a shorter sheet). iPhone 15, Pixel 7, and the 360px Android landscape did the same. The sheet now has a max height that clears the dock and the top of the screen, and the rest scrolls. `test/mobile/more-sheet.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-landscape-more.png`.
After: `test/mobile/screenshots/after/iphone-se-landscape-more.png`.

### Q4. “Create & enter” was below the fold on every phone

Broadcast lobby (`#bc=1`), Start broadcasting expanded. The create button’s top was past the viewport on iPhone SE (y ≈ 853, viewport 568), iPhone 15, Pixel 7, and 360, portrait and landscape. Opening the form now parks the rest of the lobby, shrinks the preview on a short or narrow screen, and keeps Cancel / Create in the card while the fields scroll. `test/mobile/create-on-screen.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-portrait-lobby-form.png`.
After: `test/mobile/screenshots/after/iphone-se-portrait-lobby-form.png` and `test/mobile/screenshots/after/iphone-se-landscape-lobby-form.png`.

### Q5. No LIVE / OFF AIR / WATCHING signal

A broadcast had only the status sentence. A viewer sat on “Joining the broadcast…”. A host with the camera off had no off-air mark. The chip now shows RECONNECTING while the room is not reached, OFF AIR for a host who is not sending a picture, LIVE once that picture is on, and WATCHING for a viewer who is in. Meetings do not wear it. `test/mobile/live-badge.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-portrait-host.png`.
After: `test/mobile/screenshots/after/iphone-se-broadcast-reconnecting.png` and `test/mobile/screenshots/after/iphone-se-broadcast-offair.png`.
