# Broadcast and meeting mobile quirks

Role-play pass on `run.html` (Broadcast is this page with `#bc=1`). Served locally and driven with Playwright Chromium, touch, mobile emulation.

Devices: iPhone SE (320×568), iPhone 15 (393×659), Pixel 7 (412×839), a 360×740 Android, each in portrait and landscape.

Personas: church volunteer starting a broadcast, late viewer on a shared link, flaky connection, low-vision at a 32px root font, broadcaster who needs to flip cameras.

Screenshots for the open bugs are in `test/mobile/screenshots/before/`.

## Open

## Fixed

### Q30. A 200% text size still capped the dock at 64px

The phone controls followed the root size only up to 64px, and Hang up up to 72px. They now follow `2.75rem` up to 88px, and Hang up follows `3rem` up to 96px. At a 32px root on iPhone SE the dock is two rows: camera, flip, and mic at y=356, 88px; reactions, More, and Hang up at y=452, with Hang up 96px. The bar is 312×204, from y=350. The face stays 316×504. The dock covers 218px of that tile, under half. Gaps on a row are 8px. A short landscape stays a 44px row inside a 48px pill. `test/mobile/dock-scale.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-dock-88.png`.

Design: the controls are the large type, two rows, 8px apart, Hang up still the only red. The picture stays a stage under the chip. Large type stays at 4. A short landscape does not grow, and FaceTime still wins that dimension.

### Q29. The dock on a rotated picture was a solid white slab

The 48px pill was `rgba(255,255,255,.94)`, so the strip hid the picture it sat on. It is now `rgba(255,255,255,.58)` with a 16px blur. The face is still y=59 to y=320 on an iPhone SE landscape, and the pill is still y=258 to y=306. The round controls stay solid, so a chin behind a button is still covered. `test/mobile/landscape-stage.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-landscape-glass.png`.

Design: the gaps in the pill show the picture, and Hang up stays a solid red. Landscape stays at 4. The controls are still solid discs. Meet draws smaller glyphs on its strip, so more of the face stays readable.

### Q28. A rotated call still gave up a band when the controls came back

A tap used to lift the face so a 56px dock could sit under it. The face now stays put, from just under the title chip to the bottom of the phone. On an iPhone SE landscape the chip is y=14 to y=53 and the face is y=59 to y=320, 560×261. The dock is a 48px pill, y=258 to y=306, laid on that picture. Camera and Hang up stay 44px. A 32px root does not grow this row. The short side of the face stays well above 120px. `test/mobile/landscape-stage.spec.mjs`.

Before: `test/mobile/screenshots/after/iphone-se-landscape-chip.png`.
After: `test/mobile/screenshots/after/iphone-se-landscape-bar.png`.

Design: the picture is the phone under the chip. The dock is a white pill on the lower edge, with a little of the picture showing under it, and Hang up is the only red. Landscape stays at 4. Meet's bar is a thinner translucent strip, so the face stays easier to read while the controls are up.

### Q27. The dock stayed one size when the text grew

On a phone the controls were a fixed 44px or 56px row. They now follow the root text size, from 44px up to 64px, and Hang up from 44px up to 72px. At a 32px root on iPhone SE the row no longer fits, so the dock wraps: camera, flip, mic, and reactions on the first row at 64px, More and Hang up on the second at 64px and 72px. The bar is 312px wide and 156px tall, starting at y=398. The face stays 316×504. The dock covers less than half of that tile. Gaps on a row stay at least 8px. A short landscape keeps a single 56px row of 44px controls so a rotated face is not a strip. `test/mobile/dock-scale.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-dock-scale.png`.

Design: two rows of round controls, 8px apart, Hang up still the only red. The picture stays a stage under the chip. Large type stays at 4. The controls stop at 64px, and a short landscape does not grow. FaceTime still wins that dimension.

### Q26. A rotated meeting gave the title's band to the picture

With the controls away, the face started at y=0 and the title chip was invisible. The chip now keeps its band. On an iPhone SE landscape it sits at y=14 to y=53, and the face runs from y=59 to y=320. The dock stays off the screen (top 330) until a tap, then Hang up comes back above the chin. A second face in that box stays at least 120px on its short side. `test/mobile/landscape-stage.spec.mjs`.

Before: `test/mobile/screenshots/after/iphone-se-landscape-face.png`.
After: `test/mobile/screenshots/after/iphone-se-landscape-chip.png`.

Design: the title is a dark pill in its own band, and the picture is everything under it. The dock is gone until you tap. Landscape stays at 4. Meet still lays a thinner bar on the picture when the controls are up.

### Q25. Starting a broadcast took a tap before the service had a name

The lobby opened on Start broadcasting, and the name was a second screen. A broadcast now opens on Service name and Go live. Watch a broadcast is the outline button under it. The host key is still minted and stored, and Change host key reveals it. A meeting still starts from its own buttons and still shows the host key. `test/mobile/create-one-password.spec.mjs`.

Before: `test/mobile/screenshots/after/iphone-se-service-name.png`.
After: `test/mobile/screenshots/after/iphone-se-service-first.png`.

Design: the preview, one label, one field, then Go live. Change host key and Add a viewer password are blue text. Watch is an outline, with air under Go live. Warm copy stays at 4. A church desk still goes on with no host key at all.

### Q24. Chat stayed small at a 200% root font

The log and the composer were `0.85rem`, and the sender’s name was `0.7rem`. They are now `1rem` and `0.875rem`. A 32px root paints the message and the field at 32px and the name at 28px. Send stays 44px or taller, and the composer sits 24px above the dock on iPhone SE. A reaction word, the blur chip, and the stadium label follow the same root size. `test/mobile/chat-scale.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-chat-scale.png`.

Design: the message is the large text, the name is a smaller blue line on the dark bubble, and Send is the same size as the field. The dock stays a fixed row under the sheet. Large type is still not a 5. FaceTime still wins that dimension. The call controls do not grow with the text.

### Q23. A rotated meeting kept the dock on the picture

A landscape iPhone SE is 568×320. The face used to stop above a 56px dock, so the call was a band between the chip and the controls. The controls now leave until you tap the picture. The face runs from y=0 to y=320, and the dock sits at y=330, off the screen. A tap brings a 56px dock back, Hang up is hittable, and the face ends above it (y=59 to y=248, dock top 250). A few seconds later the controls leave and the face takes the screen again. More and Reactions hold the dock while they are open. `test/mobile/landscape-stage.spec.mjs`.

Before: `test/mobile/screenshots/after/iphone-se-landscape-stage.png`.
After: `test/mobile/screenshots/after/iphone-se-landscape-face.png` and `test/mobile/screenshots/after/iphone-se-landscape-chrome.png`.

Design: the idle screen is the picture, with the name in the corner. A tap returns a white dock and a red Hang up, and the face moves up so the chin stays clear. Landscape stays at 4. Meet still puts a thinner bar on the picture and does not give a band back to a title chip.

### Q22. A broadcast still asked for a host key before the service had a name

The create form opened on “Your host key” and Generate, then Create & enter. A broadcast now asks for a service name and Go live. The host key is still minted and stored, and Change host key reveals it. A viewer password stays behind its own step. A meeting still shows the host key on the form. Go live sits 12px under the last text link, and on a short landscape the extra title is hidden so those links stay above the buttons. `test/mobile/create-one-password.spec.mjs`.

Before: `test/mobile/screenshots/after/iphone-se-host-key.png`.
After: `test/mobile/screenshots/after/iphone-se-service-name.png`.

Design: one label, one field, one filled button. Change host key and Add a viewer password are blue text. Cancel is an outline. Warm copy and the first screen stay at 4. You still tap Start broadcasting before the name, and a church desk still goes on with no host key at all.

### Q21. The lobby sentence stayed 14px at a 200% root font

`.lob-quiet` was 14px and the preview name was 15px. They are now `0.875rem` and `0.9375rem`. A 32px root paints them at 28px and 30px. The line is “You join muted.” on a meeting and “Your picture is the preview.” on a broadcast, so it stays one sentence. The phone preview row is at most 18vh, and the card scrolls, so Start stays on the screen. `test/mobile/lobby-scale.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-lobby-scale.png`.

Design: the sentence and the name on the preview follow the text size, and the first action is still in the card. Large type is still not a 5. FaceTime still wins that dimension.

### Q20. A rotated meeting laid the face under the dock

A landscape iPhone SE is 568×320. The layout treated any width under 600 as a portrait phone, and the dock floated over the tiles. The local face ran from y=64 to y=320, under an 88px dock whose top was 218. A short landscape now reserves 72px for the dock, the dock itself is 56px with 44px controls, and the face ends above it (y=59 to y=248, dock top 250). A second person is given that same band, at least 40% of the screen tall. `test/mobile/landscape-stage.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-landscape-stage.png`.

Design: the stage is the face, the dock is a thin row under it, and Hang up does not cover the chin. Landscape is still not a 5. Meet still hides its controls and keeps a rotated call feeling like the whole phone.

### Q19. Broadcast create still talked like a password form

The host step said “Host password” over a masked field, so a volunteer had to invent a secret before the service existed. It now says “Your host key,” the key is readable, and the form opens with one already filled. Generate replaces it with another three-word key. Create stays the only filled button. A viewer password stays behind its own step. `test/mobile/create-one-password.spec.mjs`.

Before: `test/mobile/screenshots/after/iphone-se-one-password.png`.
After: `test/mobile/screenshots/after/iphone-se-host-key.png`.

Design: one label, one short sentence, the whole key on its own line, then an outline Generate and the blue Create. On a phone the key sits above Generate so it is not cut off. Warm copy for church is still not a 5. A church desk names the service and goes on. This path still keeps a host key.

### Q18. The status sentence was cut off on one line

On a 320px phone the chip showed “Just you — send the invite; the li…”. On a screen at least 500px tall the status now wraps to two lines, and the visible text includes “the link has no expiry”. Fit drops to `14px + 4.25rem` so it stays under the taller chip (chip bottom 118, Fit top 150 at a 32px root on iPhone SE). A short landscape stays one line, so Fit does not land on the dock. `test/mobile/status-scale.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-status-wrap.png`.

Design: the instruction is readable, and Fit remains a separate control with air under the chip. Large type is still not a 5. FaceTime still wins that dimension. Warm copy for a church host stays at 3: a host password is still required before the room exists.

### Q17. Reaction labels stayed 16px at a 200% root font

Hand, Clap, Yes, No, and Laugh were `16px` on a phone and `18px` on a wide layout. They are now `1rem` and `1.125rem`. A 32px root paints them at 32px. The tray has a real width and wraps, so it stays on the screen in portrait and in a short landscape. `test/mobile/react-scale.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-react-scale.png`.

Design: two rows on a 320px phone, 8px between the words, dark type on the light cards. The open Reactions control is the blue dock button. Large type is still not a 5. The status sentence is still one line, so a 32px root cuts off the invite instruction.

### Q16. More sheet labels stayed 16px at a 200% root font

Invite, Chat, and the rest of More were `16px` on a phone and `18px` on a wide layout. Blur was `14px`. They are now `1rem`, `1.125rem`, and `0.875rem`. A 32px root paints Invite at 32px and Blur at 28px, and the sheet stays inside the screen (top 20, bottom 452 on a 568px iPhone SE). `test/mobile/more-sheet.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-more-scale.png`.

Design: the labels are the same scale as Fit. The sheet is a light card, dark type on `#e8ecf1`, three columns, and the rest scrolls. Large type is still not a 5. The reaction tray labels are still 16px.

### Q15. Fit’s label stayed 14px at a 200% root font

`.fitbtn` was `font: 700 14px/1.2` with a 32px minimum. A 32px root now paints it at 32px, and the control is at least 2.75rem (44px at the default root, 88px at 32px). It still sits under the chip. On a screen shorter than 380px the minimum stays 44px, and a broadcast banner stays 44px tall, so Fit does not land on the dock. `test/mobile/status-scale.spec.mjs` and `test/mobile/live-badge.spec.mjs`.

Before: `test/mobile/screenshots/after/iphone-se-title-scale.png` (title already scaled, Fit still 14px).
After: `test/mobile/screenshots/after/iphone-se-fit-scale.png`.

Design: Fit is a real control beside a grown chip, with about 21px of air under the chip on iPhone SE at a 32px root. Large type is still not a 5. The More sheet labels are still 16px on a phone.

### Q14. Live, off air, watching, and reconnecting were a word in the chip

The state sat in the same pill as GifOS and the status sentence, about 84px wide. On a broadcast it is now a full-width banner, 2.75rem tall (44px at the default root), above the chip. The chip keeps the name and the detail sentence, 8px under the banner. Fit drops with the chip. A meeting does not show the banner. `test/mobile/live-badge.spec.mjs`.

Before: `test/mobile/screenshots/after/iphone-se-broadcast-offair.png`.
After: `test/mobile/screenshots/after/iphone-se-broadcast-banner.png` and `test/mobile/screenshots/after/iphone-se-broadcast-reconnecting-banner.png`.

Design: the state is the only full-width color, and it is the first thing on the screen. OFF AIR is light on `#3a3a3f`, RECONNECTING is light on `#8a5a00`, LIVE is light on `#b61622`, WATCHING is light on `#0b6b3a`. The sentence underneath is the detail. This is not a 5. YouTube and StreamYard still own the program monitor and the screen a viewer gets when the broadcast has ended.

### Q13. The chip title ignored a 200% root font

`.topchip .title` was `20px` on a phone and `26px` on a wide layout, so a 32px root left the word GifOS at 20px while the status line grew to 34px. The title is now `1.25rem` on a phone and `1.625rem` on a wide layout. At a 32px root that is 40px on a phone. Fit and the admin countdown drop with `14px + 2.75rem`, so at the default 16px root they stay at 58px and at 32px they sit under the taller chip (Fit top 102, chip bottom 81 on iPhone SE). `test/mobile/status-scale.spec.mjs`.

Before: `test/mobile/screenshots/after/iphone-se-status-scale.png` (status already scaled, title still 20px).
After: `test/mobile/screenshots/after/iphone-se-title-scale.png`.

Design: the name and the status are one scale. Fit stays a separate control under the chip, with about 21px of air on a 32px root. Large type is still not a 5: Fit’s own label is `14px`. Live, off air, watching, and reconnecting stay a small chip badge.

### Q10. Compact dock buttons sat 4px apart

Once Flip joined the dock, the phone gap was 4px. It is 12px from 381px up, and 8px on a 320px phone, with every control still at least 44px and Leave still on the screen. Wider layouts keep a little extra air before Hang up. `test/mobile/dock-gap.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-dock-gap.png`.

Design: the row reads as separate controls instead of one packed cluster. Hang up still has a touch more air than its neighbors on a wide phone, which keeps the destructive action visually apart. The chip title is still a fixed pixel size, so large type for church is not finished.

### Q12. Broadcast create demanded two passwords up front

Start broadcasting opened a host-password essay and a viewer-password essay before Create. The first step is now the room name and one host password: “Only you use this. Viewers join with the link.” Add a viewer password is a 44px text button that reveals the second field. `test/mobile/create-one-password.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-two-passwords.png`.
After: `test/mobile/screenshots/after/iphone-se-one-password.png`.

Design: one label, one short sentence, one field, then the blue Create. The optional password is not a second competing form. What is still heavier than a church desk is that a host password is required at all. The dock gap (Q10) is the next measured spacing miss.

### Q11. Join actions were the same color and touched

`Not now` and `Continue` were both the accent fill, and the gap between them measured 0. Continue is now the only filled button (`#0064c8`). Not now is an outline on the white card. The row gap is 12px, and both targets are at least 44px. Cancel beside Create uses the same outline, with a 12px gap. `test/mobile/action-buttons.spec.mjs`.

Before: `test/mobile/screenshots/after/iphone-se-appear-preview.png` (the preview, still with the paired purple actions).
After: `test/mobile/screenshots/after/iphone-se-join-actions.png`.

Design: one primary, one secondary, 12px of air, and the card matches the light meeting. What still fails a design pass is the host form: two long password essays before Create, so the first screen a volunteer sees after this step is still denser than the action. The 320px dock is still a 4px gap (Q10).

### Q9b. The join step now says how you will appear

The step leads with “This is how you’ll appear in the meeting.” A face (the system picture, or a letter when there is none) sits beside the name, and the name updates as you type. Change picture writes a new GifOS picture. Preview camera shows the camera in that face and can be put back. `test/mobile/appear-preview.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-appear-preview.png`.

Design: the face and the name are one group, with 12px between them, and the edits are outline buttons rather than a second primary. The card is still the old dark surface on a light meeting, and `Not now` and `Continue` are still the same purple with no gap (Q11). That pair is the next visual failure.

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
