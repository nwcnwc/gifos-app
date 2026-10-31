# Broadcast desktop UI quirks

Desktop pass on the Broadcast app, which is `run.html` wearing `#bc=1` (the Meeting page’s broadcast skin). Branch `cursor/qa-broadcast-desktop` off `release/0.9.23`.

Driven locally with Playwright in Chromium, Firefox, and WebKit. Viewports: 1280×720, 1920×1080, a 900×720 window, and live resizes between them. Personas: webinar producer, keyboard-only user, full-screen viewer, busy-chat moderator, someone who joins and leaves.

Geometry below is from `getBoundingClientRect` in Chromium unless a browser is named. Screenshot descriptions from a vision pass were checked against pixels; where they disagreed, the pixels won.

## Fixed

### Q25. A Watching viewer still had Video and Unmute
### Gallery tiles touched, with no gutter

- **Who hits it:** anyone in a desktop gallery of two or more, most of all a company call that compares us with Zoom or Meet.
- **What you saw:** faces butted edge to edge with square corners, so the wall read as one picture cut into pieces and a name strip ran up against the next face.
- **Repro:** `test/desktop/gallery-pack.spec.js` (“faces have a gutter between them and soft corners”) failed before the fix on Chromium and Firefox. With five faces at 1280 the gap was 0 (acd2fc6).
- **Fix:** on desktop each packed cell gives up 4px on every side, so faces have an 8px gutter, and a tile has 10px corners. Every tile is still the same size, a short row is still centered, and names still sit above the dock. A phone stays edge to edge.
- **Proof:** the repro passes at 1280 with five and seven faces and at 900 with seven, on Chromium and Firefox. At 1280 the five tiles are each 416×261 with 8px between them. Screenshots: `test/desktop/shots/gallery-gutter-before-1280.png`, `test/desktop/shots/gallery-gutter-after-1280.png`.

### A dead camera took about 9 seconds to come back

- **Who hits it:** anyone whose camera stays live but goes pure black or stops sending frames, often after another app takes the lens.
- **What you saw:** Camera stopped — bringing it back on your tile, then a black picture for the room until the restart, 7.4 to 8.9 seconds after the camera died.
- **Repro:** `test/desktop/phone-cam.spec.js` (“a desktop camera that goes pure black…” and “…that stops sending frames is grabbed again within a few seconds”) failed before the fix on Chromium and Firefox. It was grabbed again after 7.3 to 8.9 seconds against a 5.5 second limit (711029f).
- **Fix:** the watchdog samples the self-view every second instead of every three seconds. It grabs the camera again once it has been black or silent for about three more seconds, so a one-second hiccup is left alone. A dim room that is still sending frames still never counts. A track that has ended is still tried every three seconds, so three failed grabs still take about 9 seconds before the fail line.
- **Proof:** the repro passes, and the desktop suite passes, 182/182 on Chromium and Firefox. Measured over five runs each at 1280: base 8.9 s (pure black) and 7.4 s (no frames), fix 3.9 s and 3.4 s. WebKit is skipped because a canvas capture closes its tab.

### A quiet family call still showed buttons on every face

- **Who hits it:** two to four people talking on a desktop, with the pointer resting on someone's face.
- **What you saw:** the dock faded, but each face kept a Blur for all square and a Max button, and the face under the pointer kept Mute for everyone and Blur for everyone.
- **Repro:** `test/desktop/calm-dock.spec.js` "hides the tile buttons" failed before the fix on Chromium and Firefox: Blur for all was still shown on 2 tiles once calm.
- **Fix:** calm hides Blur for all, Max, and the hover row with the dock. Names and mute marks stay. Keyboard focus on a tile, or an open tile menu, keeps the call from going calm.
- **Proof:** the test passes on Chromium and Firefox; full desktop suite 176/176. Screenshots: `test/desktop/shots/calm-tiles-before-1280.png`, `test/desktop/shots/calm-tiles-after-1280.png`.

### A quiet family call still showed the whole dock

- **Who hits it:** two to four people talking on a desktop, with nobody touching the mouse.
- **What you saw:** the white dock, with eight buttons, stayed under the faces for the whole call. FaceTime and Meet hide their controls when you are not using them.
- **Repro:** `test/desktop/calm-dock.spec.js` failed before the fix. After 2 quiet seconds in a three-person call, the dock was still fully shown.
- **Fix:** after five seconds with no mouse, key, or wheel, the dock and Fit fade. The faces do not move. Any move or key brings them back. The dock stays while More, chat, Reactions, or a sheet is open, while the pointer is on the dock or a key has focus there, while you are alone, in a room of five or more, during a share or a broadcast, and on a phone.
- **Proof:** the four tests pass on Chromium and Firefox. Screenshots: `test/desktop/shots/calm-dock-before-1280.png`, `test/desktop/shots/calm-dock-after-1280.png`.

### A dim room had its camera restarted

- **Who hits it:** anyone calling from a dim room, such as an evening call with one lamp on.
- **What you saw:** about 9 seconds in, the header said Your camera was sending black video — restarting it…, the tile flashed Camera stopped, and the room saw your picture drop. It could happen three times.
- **Repro:** `test/desktop/phone-cam.spec.js` (“a dark room that is still painting never restarts the camera”) failed before the fix on Chromium and Firefox. The camera was grabbed again on the third sample.
- **Fix:** a dim picture that is still sending frames counts as a picture. Only no frames, or pure black, count toward a restart.
- **Proof:** the desktop suite passes, 166/166 on Chromium and Firefox. Screenshots: `test/desktop/shots/cam-dim-before-1280.png`, `test/desktop/shots/cam-dim-after-1280.png`.

### The song line never reached the room

- **Who hits it:** the volunteer running a church broadcast, and everyone watching it.
- **What you saw:** during Song the booth read the line on its own screen. The room saw only the camera, with no words to sing.
- **Repro:** `test/desktop/lyrics.spec.js` (“during Song the current line is on the picture the room sees”, blurred and clear) failed before the fix: no words on the outgoing frame (894a848). A first fix painted the line across the full width at the bottom. A real two-browser broadcast, booth and viewer on different machines, showed that the room sees this camera as a centered square with the name strip over its bottom 17%, so the viewer read “…ing g… how sweet the s…” under the name. The repro now checks for that too (8b2b1a3).
- **Fix:** while the run of show is on Song, the booth paints the current line onto the picture it sends: white on a dark band, wrapped to two lines, inside the centered square, and above the name strip. A clear camera goes through the same canvas only while Song is up. The next line stays on the booth.
- **Proof:** the repro passes on Chromium and Firefox, blurred and clear. In the two-browser broadcast the viewer reads the line on the booth’s picture. Screenshots: `test/desktop/shots/lyrics-air-before-1280.png`, `test/desktop/shots/lyrics-air-before-frame.png`, `test/desktop/shots/lyrics-air-after-1280.png`, `test/desktop/shots/lyrics-air-after-frame.png`, `test/desktop/shots/lyrics-air-viewer-after-1280.png`. WebKit is skipped because a canvas capture closes its tab. The song is one built-in hymn.

### A camera that painted pure black waited 9 seconds in silence

- **Who hits it:** someone whose camera stays live but sends only black, usually a phone or laptop after another app took the lens.
- **What you saw:** your own tile was black with no words. Nothing changed until the camera restarted, about 9 seconds later.
- **Repro:** `test/desktop/phone-cam.spec.js` (“a live camera that paints pure black says so before it restarts”) failed before the fix. One sample in, there was no line on the tile.
- **Fix:** if every pixel of a sample is pure black, the tile says Camera stopped — bringing it back on the first sample, in German and Spanish too. The restart still waits for the third sample. A dim room still has a little light in it, so it gets no line. That case has its own test.
- **Proof:** all five camera tests pass on Chromium and Firefox. WebKit is skipped because a canvas capture closes its tab. Screenshots: `test/desktop/shots/cam-black-before-1280.png`, `test/desktop/shots/cam-black-after-1280.png`.

### The gallery ran under the dock, and a short row was stretched

- **Who hits it:** anyone in a gallery of three or more, especially the people on the bottom row.
- **What you saw:** tiles reached the bottom of the window, so the dock covered the middle names. A row with fewer people was stretched, so those faces were a different size. Five people were two large tiles over three smaller ones. Seven people put a smaller rail beside the others.
- **Repro:** `test/desktop/gallery-pack.spec.js` failed before the fix (two names on a five-person wall intersected the dock).
- **Fix:** every tile in the gallery is the same size. A short row is centered. The gallery stops where the dock starts, so a name stays above it. The dock stays 104px.
- **Proof:** the test passes on Chromium, Firefox, and WebKit. At 1280 the five tiles are each 424×269, the pair on the bottom is centered, and the lowest name ends at y=594 while the dock starts at y=602. Screenshots: `test/desktop/shots/gallery-pack-before-1280.png`, `test/desktop/shots/gallery-pack-after-1280.png`.

### Reactions was only an icon

- **Who hits it:** anyone who does not already know the smile button opens reactions.
- **What you saw:** Reactions was a 68px circle with no word. The other dock buttons said what they do.
- **Repro:** `test/desktop/dock-labels.spec.js` failed before the label (`#reactbtn` had no `.dockword`).
- **Fix:** the button says Reactions, in German Reaktionen and Spanish Reacciones, at 16px. The smile icon stays. The button matches the other dock buttons. It stays on screen at 900px.
- **Proof:** the dock tests pass on Chromium, Firefox, and WebKit, and the German and Spanish dock lines pass on Chromium. Screenshots: `test/desktop/shots/react-label-before-1280.png`, `test/desktop/shots/react-label-after-1280.png`.

### Fit and the More words were small

- **Who hits it:** an older member reading the view switch or the More sheet.
- **What you saw:** Fit was 14px and 32px tall. The More headings were 12px capitals. Max, Min, and No blur were about 12px, Float 13px, and Blur 14px.
- **Repro:** `test/desktop/older-eyes.spec.js` failed before the change (Fit 14px; nine More words under 16px). A 44px Fit in its old place covered the top-right tile's Blur for all, and the test catches that too.
- **Fix:** from 601px wide and 501px tall, Fit is 16px, 44px tall, and sits in the header row just left of the build label, above the tiles. Every word in More is 16px, and the headings are written People, Share, Room, Help instead of capitals. While a screen is shared, Fit is hidden: the faces are a strip then, and Stop sharing owns that corner (a test checks Fit never covers it).
- **Proof:** the desktop suite passes 160/160 on Chromium and Firefox. WebKit is not checked: this box lacks its system libraries. Screenshots: `test/desktop/shots/older-eyes-before-1280.png`, `test/desktop/shots/older-eyes-after-1280.png`.

### The dock words were 12px

- **Who hits it:** anyone reading Camera, Unmute, Share screen, CC, Chat, More, or Leave.
- **What you saw:** the words under the icons were 12px. On a 700px window they were 11px.
- **Repro:** `test/desktop/dock-labels.spec.js` — “dock words are 16px on a desktop window” failed before the change (the mic word was 12px).
- **Fix:** those words are 16px from 900px up. The buttons stay 76px and the bar stays 104px, so the self-view does not move. Under 700px they stay 11px so Leave still fits. Reactions stays an icon.
- **Proof:** the dock tests pass on Chromium, Firefox, and WebKit. German and Spanish labels fit at 900px. Screenshots: `test/desktop/shots/dock-words-before-1280.png`, `test/desktop/shots/dock-words-after-1280.png`.

### Save, Steal, Hide, and Talk stayed English

- **Who hits it:** a German or Spanish person using an app in the meeting: saving a copy, taking the app home, hiding it, or turning Talk on.
- **What you saw:** the app bar said “Save”, “Steal”, “Hide”, and “Talk: off”, at 12px. Steal then offered “+ data”, “as I joined”, and “app only” in English.
- **Repro:** `test/desktop/app-bar.spec.js` failed before the translation (`appBarForTest` was missing, and a `de-DE` bar said “Save”).
- **Fix:** those four words, their tips, and the Steal choices follow the device. German uses Sie. Spanish uses tú. English stays the fallback. The four buttons are 16px. Invite, Leading, and Full screen on that bar stay English.
- **Proof:** the test passes on Chromium, Firefox, and WebKit. Screenshots: `test/desktop/shots/app-bar-before-de-1280.png`, `test/desktop/shots/app-bar-after-de-1280.png`.

### Stop app and Turn chat off stayed English

- **Who hits it:** a German or Spanish host, stopping a shared app or silencing chat.
- **What you saw:** the app bar said “Stop app” and “Help”, at 12px. Chat said “Turn chat off”, at 13px. The line in the log said “Chat was turned off”.
- **Repro:** `test/desktop/host-words.spec.js` failed before the translation (`appStopForTest` was missing, and the labels were English).
- **Fix:** Stop app, Stop for everyone, Help on that bar, Turn chat off, Turn chat on, and the line that says who turned chat off follow the device. German uses Sie. Spanish uses tú. English stays the fallback. Those two buttons are 16px. Save, Steal, Hide, and Talk on the app bar stay English when they appear.
- **Proof:** the test passes on Chromium, Firefox, and WebKit. Screenshots: `test/desktop/shots/host-words-before-de-1280.png`, `test/desktop/shots/host-words-after-de-1280.png`.

### Signing in as admin stayed English

- **Who hits it:** a German or Spanish host, opening Admin from All tools in a room that has an admin.
- **What you saw:** the button said “Admin sign-in”. The sheet said “Room admin”, “Sign in as admin”, and “Admin password”. The hint was English, at 13.6px.
- **Repro:** `test/desktop/admin-sheet.spec.js` failed before the translation (a `de-DE` button was “Admin sign-in”).
- **Fix:** the button, the sheet, the hint, the password check, and the banned-device list follow the device. German uses Sie. Spanish uses tú. English stays in the markup. Signing in behaves as before. The hint is 16px. Stop app and Turn chat off stay English.
- **Proof:** the test passes on Chromium, Firefox, and WebKit. Screenshots: `test/desktop/shots/admin-sheet-before-de-1280.png`, `test/desktop/shots/admin-sheet-after-de-1280.png`.

### The Who download for the police stayed English

- **Who hits it:** a German or Spanish device, handing the Who list to someone investigating.
- **What you saw:** the button already said Diese Liste laden or Descargar esta lista. The file still opened with “GifOS meeting — who was here” and “HOW TO READ THIS”, and your own row said “this device” and “(you)”.
- **Repro:** `test/desktop/who-file.spec.js` failed before the translation (`whoFileForTest` was missing, and a `de-DE` file was English).
- **Fix:** the title, the how-to, the column names, and the connection words follow the device. German uses Sie. Spanish uses tú. Names, addresses, ports, times, peer ids, and signatures stay as recorded. English stays the fallback. Signing in as admin, Stop app, and Turn chat off stay English.
- **Proof:** the test passes on Chromium, Firefox, and WebKit. Screenshots: `test/desktop/shots/who-file-before-de-1280.png`, `test/desktop/shots/who-file-after-de-1280.png`.

### The Run app sheet stayed English

- **Who hits it:** a German or Spanish device, opening Run app from All tools.
- **What you saw:** the button already said App starten or Abrir app. The sheet still said “Run an app in this meeting” and “Choose a GIF file”. The button tip was English too.
- **Repro:** `test/desktop/run-app.spec.js` failed before the translation (a `de-DE` title was “Run an app in this meeting”).
- **Fix:** the sheet, the tip, the loading line, and the errors follow the device. German uses Sie. Spanish uses tú. English stays in the markup. Opening an app behaves as before. The file you download from Who, to hand to the police, stays English.
- **Proof:** the test passes on Chromium, Firefox, and WebKit. Screenshots: `test/desktop/shots/app-sheet-before-de-1280.png`, `test/desktop/shots/app-sheet-after-de-1280.png`.

### A volunteer opening More got the whole room

- **Who hits it:** a church volunteer, or anyone older, who only wants to raise a hand, invite someone, or read Help.
- **What you saw:** More was four headings and fourteen buttons: Who, Hand, Invite, Float, Run app, Vote, Password, Stage, Record, Captions, Settings, Keys, Help, Transcript. The sheet was 536px tall.
- **Repro:** `test/desktop/more-groups.spec.js` — “More opens to Hand, Invite, and Help” failed before the fold (there was no All tools button).
- **Fix:** More opens to Hand, Invite, and Help, with blur above them. All tools opens the rest, and Fewer tools puts it away. German: Alle Funktionen / Weniger Funktionen. Spanish: Todas las funciones / Menos funciones. The choice stays for this tab. The keys still reach a control that is folded.
- **Proof:** the More, locale, settings, and shortcut tests pass on Chromium, Firefox, and WebKit. The short sheet is 230px. Screenshots: `test/desktop/shots/more-short-before-1280.png`, `test/desktop/shots/more-short-after-1280.png`, `test/desktop/shots/more-short-open-1280.png`.

### Invite, settings, and the rest of More needed the pointer

- **Who hits it:** a keyboard user who can already mute, share, and leave, and still has to open More for Who, Invite, or Settings.
- **What you saw:** the shortcut list stopped at Alt+Q. Who, Invite, Run app, Vote, Password, Stage, Record, captions, Settings, Transcript, and Help had no key.
- **Repro:** `test/desktop/shortcuts.spec.js` — “the rest of More has a key” failed before the chords (`#whobtn` had no `aria-keyshortcuts`).
- **Fix:** Alt+W Who, Alt+I Invite, Alt+Y Run app, Alt+U Vote, Alt+L Password, Alt+G Stage, Alt+R Record, Alt+K captions, Alt+, Settings, Alt+T Transcript, Alt+/ Help. They work while More is closed. They stay quiet while you are typing and while a dialog is open. The list names them, including German and Spanish. The sheet scrolls on a short window. Host bulk tools still have no key.
- **Proof:** the shortcut tests pass on Chromium, Firefox, and WebKit. Alt+I opens Invite. Alt+, opens Settings. Screenshots: `test/desktop/shots/more-keys-before-1280.png`, `test/desktop/shots/more-keys-after-1280.png`.

### The dock said Mic, and a second Unmute would duplicate it

The dock hid microphone and camera only under `body.notadmin`. A viewer session paints Watching without that class, so Video and Unmute stayed on the dock and a click called `getUserMedia` twice. The hide is now `body.bc-watching`, set from the watching seat itself (not the host, and not a stage grant). Clicks and `lateMedia` return before they publish. A host still has the buttons. The labeled-dock check runs as the host. Permanent repro: `test/e2e/broadcast-desktop.spec.js` (“a Watching viewer has no camera or mic…”).

### Q1. Chat composer slides under the control dock at 900px

The chat panel now keeps a band clear of the dock (`padding-bottom: 128px`, `112px` when the dock is the shorter phone size). At 900×720 the composer ends at y=592 and the dock starts at y=602, so attach, the message field, and send are all clear. The same holds after a live resize from 1920×1080 to 900×720.

Permanent repro: `test/e2e/broadcast-desktop.spec.js` (“chat composer stays clear…”). Passed on Chromium, Firefox, and WebKit. Before: `test/e2e/artifacts/chat-900-before.png`. After: `test/e2e/artifacts/chat-900-after.png`.

### Q2. A broadcast still talks like a meeting

`paintBroadcastChrome()` rewrites the in-room words when `body.broadcast` is set: chat title, privacy line, leave button, leave dialog, Help, Who, record, invite, and pinned files. A plain meeting stays “Meeting chat” / “Leave the meeting?”. Switching the chat panel to the transcript and back restores “Broadcast chat”, not “Meeting chat”.

### Q3. No Live / Watching state

The top chip now carries `#onair`. A host (stored admin key, or signed-in admin) sees a filled red **Live** pill. Everyone else in the broadcast sees **Watching**. Meetings hide the pill. It stays inside the viewport at 1280 and at 900. Screenshots: `test/e2e/artifacts/onair-live-1280.png`, `test/e2e/artifacts/onair-watching-900.png`.

Both are in `test/e2e/broadcast-desktop.spec.js` and passed on Chromium, Firefox, and WebKit.

### Q5. Primary dock controls are icon-only

Mic, camera, reactions, and More now carry a visible word inside the button (`Unmute` / `Mute` / `Video` / `React` / `More`). Off is filled red `#b61622` with white text; on is filled green. The word stays inside the 68px circle at 1280, 1920, and 900, and the dock stays inside the window after a resize from 1920 to 900. Screenshots: `test/e2e/artifacts/dock-labels-1280.png`, `test/e2e/artifacts/dock-labels-900.png`.

### Q6. No mute / camera keyboard shortcuts

`M` toggles the mic and `V` toggles the camera, except while focus is in a text field. The chat test types `m` into the composer and the mic stays on Unmute. The buttons’ titles name the shortcut.

### Q4. More sheet can leave the viewport

`#barmore` now has `max-height: calc(100dvh - 140px)` and `overflow-y: auto`. At 1280×360 the sheet used to start at y=−142 with Who, Invite, and the blur segments off screen and no scroll. It now stays inside the viewport, and Help can be scrolled into view. Screenshot: `test/e2e/artifacts/more-sheet-short-after.png`.

### Q11. Invite was a second tap inside More

`#invite` lived in `#barmore`, so with the dock collapsed (the default) its box was 0×0. It is now a labeled circle on the dock, between React and More, visible while More is closed. One tap opens “Share this broadcast”. The word Invite stays inside the 68px circle, and the dock stays inside 1280, 1920, and 900. The button is the same neutral gray as React and More (`rgb(232, 236, 241)`), so blue stays reserved for an open popover. Before: `test/e2e/artifacts/invite-dock-before.png` (and the buried control in `invite-more-before.png`). After: `test/e2e/artifacts/invite-dock-after.png`, `invite-modal-after.png`.

### Q12. Reactions were words, and the dock face was easy to misread

The reaction tray is now emoji: ✋ 👏 👍 👎 😂, with accessible names Raise hand, Clap, Yes, No, Laugh. A clap paints 👏 on your tile, not the word Clap. The dock control shows 😊 plus the word React. No sparkle glyph (✨ ✦ ✧ ⭐) is on this control; that mark stays available for AI. Before: `test/e2e/artifacts/react-tray-before.png`. After: `test/e2e/artifacts/react-tray-after.png`.

### Q7. Reactions and More occupied the same slot

Opening React while More was open put `#reacttray` on top of `#barmore` (overlap 392×88px at 1280×720). Opening one now closes the other. After the same two taps, More is `display: none` and the emoji tray is the only popover. Before: `test/e2e/artifacts/react-more-stack-before.png`. After: `test/e2e/artifacts/react-more-stack-after.png`.

### Q10. Full screen lived only on the tile

The dock now has `#fsbtn`, labeled Full, with the accessible name “Full screen”. It sits between Invite and More, visible while More is closed, and the dock stays inside 1280, 1920, and 900 (the bar measured 626px wide at 1280). One tap opens the filmstrip view (`body.fsopen`) following the speaker; the view’s close button leaves it. The tile glyph `⛶` is still there for a single feed. Before: `test/e2e/artifacts/dock-fullscreen-before.png`. After: `test/e2e/artifacts/dock-fullscreen-after.png`, `fullscreen-view-after.png`.

### Q8. Guest moderation tools were hover-first

A guest tile is now in the tab order (`tabindex="0"`, named “Jordan Lee. Guest controls.”). Focusing it shows Mute, Blur, and, for a host, Apps, Share, and Ban. Tab reaches Mute and then Ban. The words fit the buttons; the longer phrase stays on the accessible name (“Mute for everyone”). Before: `test/e2e/artifacts/modbar-keyboard-before.png`. After: `test/e2e/artifacts/modbar-keyboard-after.png`.

A broadcast hides the gallery, so this bar is the meeting surface. The same tools are painted on the broadcast stage (Q15).

### Q15. Guest tools were missing from the broadcast stage

A broadcast hides the gallery, so Mute, Blur, and Ban had nothing to sit on. The host now sees them on the stage: “On stage”, the guest’s name, and the same words. Tab reaches Mute, and Mute becomes Unmute. A viewer does not get the strip. The tools stay inside the picture area and clear of the dock at 1280 and 900. After: `test/e2e/artifacts/stage-mod-after.png`.

### Q14. The dock grip promised arrow keys and ignored them

The grip’s title says “Arrow keys nudge.” Arrow keys now move the dock 24px (48px with Shift). It stays 8px inside the window. A double click, or a double tap, puts it back in the center. Before: `test/e2e/artifacts/dock-grip-before.png`. After: `test/e2e/artifacts/dock-grip-after.png`.

### Q9. Lobby copy was one voice, and the password essay came first

A meeting lobby’s blue button is **Start a call** (“Anyone with the link can join”). **Host this call** is an outline button. The guest password stays hidden until “Add a password for guests”. A broadcast lobby’s blue button is **Go live**; the viewer password stays hidden until “Add a password for viewers”. The card stays inside 1280, 1920, and 900. The words “troublemaker”, “open room”, and “admin” are gone from the lobby. Before: `test/e2e/artifacts/lobby-simple-before.png`, `lobby-family-before.png`. After: `lobby-family-after.png`, `lobby-simple-after.png`, `lobby-golive-after.png`.

### Q13. The screen-name step skipped a saved name

Joining now shows “This is how you'll appear” with the GifOS display name filled in and the saved picture in the circle. The person can edit the name and choose another picture. Save is blue `#0064c8` and keeps the name and picture on screen. Clear is a white button with a gray outline and blanks both. The two do not touch (gap at least 8px). The lobby shows the same preview, so a call started from there does not ask twice. A direct link still asks. Before: the old lobby line “You'll join as …” in `lobby-family-after.png` from the previous round. After: `test/e2e/artifacts/appear-lobby-after.png`, `appear-dialog-after.png`.

### Q16. On air was a small pill

The top chip still says Live or Watching. A full-width bar under that chip now says **You are live** (red `#b61622`) or **You are watching** (light gray). It clears the chip, the Fit button, and the dock at 1280, 1920, and 900. A meeting hides it. After: `test/e2e/artifacts/onair-bar-live-after.png`, `onair-bar-watch-after.png`. The small pill in `onair-live-1280.png` is the earlier state.

### Q17. Chat lived in More, and a prayer looked like any other line

Chat is a labeled dock button, so it is one tap while More is closed. The dock still fits 1280, 1920, and 900. Prayer marks the composer (“Prayer request…”) and the sent line wears the word Prayer, separate from an ordinary message. The composer still clears the dock. After: `test/e2e/artifacts/chat-dock-after.png`, `chat-prayer-after.png`.

### Q18. An open room did not say whether it was a broadcast or a meeting

The full-width bar now names the room. A broadcast says **Broadcast · You are live** (red `#b61622`) or **Broadcast · You are watching** (gray `#e8ecf1`). A meeting says **Meeting** on green `#143024`. Chat, leave, invite, Help, and the tab title use the same words. The lobby still says Start a call or Go live. The two bars do not share a background, and both clear the chip, the Fit button, and the dock at 1280, 1920, and 900. Before: the Q16 bars, which only said “You are live” / “You are watching”, and a meeting that hid the bar. After: `test/e2e/artifacts/service-bar-live-after.png`, `service-bar-watch-after.png`, `small-group-bar-after.png`.

### Q19. Recording and who is here were inside More

The room bar now says **Not recording** or **Recording**, and a headcount (**1 here**) that opens the name list. More can stay closed. Recording is a white pill with red text. Not recording is an outline on the same bar. Both fit inside the bar at 1280, 1920, and 900, clear of the dock. Tapping Not recording opens the record sheet. Tapping the count shows the names, including your own. A broadcast keeps “Broadcast · You are live” beside those controls. After: `test/e2e/artifacts/trust-group-after.png`, `trust-group-recording-after.png`, `trust-service-after.png`.

### Q20. Leave was an unlabeled phone icon, and coming back said “meeting”

The dock button says **Leave**. The question is Stay (outline) and Leave (red), with a gap between them. After you leave, a white card says **You left the meeting** or **You left the broadcast**. Rejoin is blue `#0064c8`. Close is a white outline button. Rejoin reloads the same link and the room bar is back. The label fits inside the button at 1280, 1920, and 900. After: `test/e2e/artifacts/leave-dock-after.png`, `leave-ask-after.png`, `leave-rejoin-after.png`.

### Q21. Mute and camera were only a dock color

A full-width line under the room bar says **Microphone off** and **Camera off** while those are off. White on `#3a1014`. It sits under the room bar, clears the dock, and fits 1280, 1920, and 900. It hides when the microphone and camera are on. Someone only watching a broadcast does not see it. After: `test/e2e/artifacts/av-off-after.png`, `av-on-after.png`.
- **Who hits it:** a host of a large room, looking for a waiting room, a rename, and a way to put one person in front.
- **What you saw:** each other person had Mute. There was no switch for a waiting room, no Admit, no Rename, and no Spotlight.
- **Repro:** `test/desktop/host-roster.spec.js` failed before the fix (no `#roster-wait-toggle`). WebKit skips the walk that plays a canvas capture. A guest in an admin room is covered on WebKit too.
- **Fix:** Waiting room is a switch on the roster. Someone who arrives after it is on comes off the wall and sits under Waiting, with Admit. Rename edits their name on the tile. Spotlight marks them on stage and puts that tile first. A guest in an admin room does not see these. The person waiting is off the wall. (The lobby is sealed now: see “The waiting room was not sealed”.)
- **Proof:** the test passes on Chromium and Firefox, and the roster mute tests still pass on all three browsers. Screenshots: `test/desktop/shots/host-roster-before-1280.png`, `test/desktop/shots/host-roster-after-wait-1280.png`, `test/desktop/shots/host-roster-after-spot-1280.png`.

### The waiting room was not sealed

- **Who hits it:** a host of a large room who turns the waiting room on, and the person who arrives after.
- **What you saw:** in a real call on three machines, the host and a guest who was already there still played the waiting person's voice, the waiting person heard the room, and their mic was sending. The host's Waiting list said “No one is waiting”, so there was no Admit to press. The waiting page also held the host: to it everyone was new, so even after Admit it would have shown and played no one.
- **Repro:** `test/desktop/lobby-ears.spec.js` (two real browsers, both voices wired) failed before the fix on Chromium and Firefox: the host heard the guest, the guest heard the host, and the guest's mic sent. A three-machine run (host Chromium, earlier guest Firefox, late guest Chromium) showed the same, plus 0 Admit buttons.
- **Fix:** the waiting page says it is waiting on its own status beat (`wt`, one byte, the same size in any room). Every page holds a person who says so; before that word, only a page that was there when the waiting room went on holds someone new. A held person reads as muted wherever a host's mute is read (each speaker, captions, the recording), their own mic locks with the line “You are in the waiting room: your mic opens when the host lets you in” (German and Spanish too), they are left out of every composite a row head builds, and the waiting page plays no one. The Waiting list repaints when someone is held or let go. After Admit everyone hears everyone and the guest can unmute.
- **Proof:** the test passes on Chromium and Firefox, and the three-machine run passes: while waiting no page plays the guest and the guest plays no one, and after Admit all three hear each other and see three faces. WebKit has no fake microphone, so it is not run. Screenshots: `test/desktop/shots/lobby-ears-before-host-1280.png`, `test/desktop/shots/lobby-ears-before-guest-1280.png`, `test/desktop/shots/lobby-ears-after-host-1280.png`, `test/desktop/shots/lobby-ears-after-guest-1280.png`, `test/desktop/shots/lobby-x-before-host-1280.png`, `test/desktop/shots/lobby-x-after-host-1280.png`, `test/desktop/shots/lobby-x-before-guest-1280.png`, `test/desktop/shots/lobby-x-after-guest-1280.png`, `test/desktop/shots/lobby-x-before-admitted-guest-1280.png`, `test/desktop/shots/lobby-x-after-admitted-guest-1280.png`.

### Who, Share, and Vote stayed English

### Q22. A recording started without a card you had to read

Starting a recording, or seeing someone else start one, opens a white card. The title is **You are recording this meeting**, **You are recording this broadcast**, **Jordan Lee is recording this meeting**, or **This meeting is being recorded** when the name is missing. The body says it is saved on a device in this room and that the bar keeps saying Recording. OK is blue `#0064c8`. The card fits 1280, 1920, and 900. OK dismisses the card and leaves the bar on Recording. The record sheet says the same thing: Cancel is an outline, Start recording is blue. After: `test/e2e/artifacts/rec-notice-after.png`.

### Q23. Invite opened onto a governance essay

Invite is a dock button. The sheet is now a white card. A meeting says **Share this meeting** and **Send this link. Anyone who opens it joins you.** Copy is blue `#0064c8`. Close is an outline. The gap between the link and Copy is 12px. **A room you run** is a text link; the host password stays hidden until that tap. A broadcast says **Share this broadcast** and that people who open the link are watching. A host also sees that the host password stays with them. The card fits 1280, 1920, and 900, including after a live resize to 900, and the password step still fits. Before: `test/e2e/artifacts/invite-sheet-before.png`. After: `test/e2e/artifacts/invite-sheet-after.png`.

### Q24. The full-screen control said Full

The dock button now says **Full screen**. The word fits inside the button at 1280, 1920, and 900, and after a live resize from 1920 to 900. The dock stays inside the window. Before: `test/e2e/artifacts/dock-full-before.png`. After: `test/e2e/artifacts/dock-full-after.png`.

### Q25. Send was a short white button under an empty files strip

Send is blue `#0064c8`, 44px tall, white text. The message field is white with a gray border, also 44px. The files strip stays hidden until a file is pinned. Prayer still posts its own line. The composer clears the dock at 1280, 1920, and 900, and after a live resize to 900. Before: `test/e2e/artifacts/chat-send-before.png`. After: `test/e2e/artifacts/chat-send-after.png`.

### Q26. The lobby said Meeting or Broadcast

A cold open now says **Meeting**. Go live says **Broadcast**. The blue button is still Start a call or Go live, and the quiet line still says you come in muted, or that people watch with the link. The card fits 1280, 1920, and 900. After: `test/e2e/artifacts/lobby-words-after.png`, `lobby-service-after.png`.

### Q27. A meeting asked before you could leave

Leave on a meeting goes straight to **You left the meeting**. Rejoin is still blue. Close is still the outline. The confirm stays on a broadcast, because you are live: Stay is the outline and Leave is red. After: `test/e2e/artifacts/leave-onetap-after.png`.

### Q28. The status line was cut off

Alone in a room, the chip said “Just you — send the invite; the link has no expiry” and then clipped the rest, including at 1920. It now says **Just you. Send the invite.** The chip can use the width beside Fit. The whole line fits at 1280, 1920, and 900, and after a resize from 1920 to 900, and it does not cover Fit. After: `test/e2e/artifacts/status-fit-after.png`.

### Q29. The dock stayed up on a quiet meeting

On a meeting the dock slides off the bottom after the call sits quiet, and a pointer, a key, or focus brings it back. It stays put while More is open, reactions are open, a text field is focused, or a card is up. A broadcast does not tuck. Before: `test/e2e/artifacts/dock-tuck-before.png`. After: `test/e2e/artifacts/dock-tuck-after.png`.

### Q30. A meeting opened with three doors

Start a call is the button. Host this call and Join a link are text links in `#0064c8`, and each still opens its fields in place. A broadcast still leads with Go live, and Watch stays the outline button, because a volunteer and a viewer both need a door. The card fits 1280, 1920, and 900. Before: `test/e2e/artifacts/lobby-doors-before.png`. After: `test/e2e/artifacts/lobby-doors-after.png`, `lobby-doors-service.png`.

### Q31. Captions turned pale green when they were on

The More button says **Captions**. On is blue `#0064c8` with white text, and Record uses that same on state. The word fits at 1280, 1920, and 900, and after a resize from 1920 to 900. Before: `test/e2e/artifacts/captions-before.png`, `captions-on-before.png`. After: `test/e2e/artifacts/captions-after.png`.

### Q32. Broadcast is the stage. A meeting is the call.

Nathan’s Broadcast design: only the stage shows. No row, no stadium, no other tiles. The host steps on when the host key is adopted, and can step off. Raised hands are an admin list the host promotes from. A viewer’s name and picture are seen only if they raise a hand and are promoted. The host key stays.

What this desktop branch already matches: a broadcast hides `#grid` and `#stadium`. Comfy layout does not run on a broadcast. A meeting keeps the grid. That grid is the many-to-many call, and it is not the Broadcast product. The broadcast lobby still asks for the host password, and adopting that key calls `tryBroadcastStage`.

A Watching viewer keeps Hand. Unmute, Video, and Stage leave, keyed off the watching seat (`body.bc-watching`), so the session frame does not have to join or grow `notadmin`. Clicks on those controls do not ask for a camera or microphone and do not step onto the stage. Broadcast help no longer says ban lives on each tile: mute, blur, and ban are on each stage seat and on the raised-hands list, Promote calls someone up, and Demote on the stage seat sends them back. `#stagemod` stays the on-stage cards. `#handraise` is the host’s raised-hands list. A viewer’s join step says they stay off camera unless they raise a hand and the host promotes them. A meeting still says “This is how you'll appear.” Before: `test/e2e/artifacts/role-gaps/before/`. After: `test/e2e/artifacts/role-gaps/after/`. The stage-versus-grid shots stay at `test/e2e/artifacts/broadcast-stage-flag.png` and `small-group-grid-flag.png`.

### Q33. A live broadcast said Just you

Alone on a broadcast, the chip used the meeting sentence. A host now reads **You are live. Send the link.** A viewer reads **You are watching this broadcast.** A meeting still reads **Just you. Send the invite.** The line fits beside Fit at 1280, 1920, and 900, and after a resize from 1920 to 900. Before: `test/e2e/artifacts/service-alone-before.png`. After: `test/e2e/artifacts/service-alone-after.png`.

### Q34. Share screen was inside More

On a meeting, Share is a dock button. The label is **Share**, and the accessible name is Share screen. The word fits, and the dock stays inside the window at 1280, 1920, and 900, including after a resize to 900. A broadcast puts Share back in More, so the stage dock does not gain a meeting button. Before: `test/e2e/artifacts/dock-share-before.png`. After: `test/e2e/artifacts/dock-share-after.png`.

### Q35. Fit stayed after the dock tucked

On a quiet meeting, Fit slides off with the dock and comes back with it. A broadcast keeps Fit. The room bar, the mute line, and the status chip stay. Before: `test/e2e/artifacts/fit-idle-before.png`. After: `test/e2e/artifacts/fit-idle-after.png`.

### Q36. The host stepped on from inside More

On a broadcast the host’s dock says **Step on**. It turns red and says **Step off** once they are on, and the next tap steps off. The word fits, and the dock stays inside the window at 1280, 1920, and 900. A viewer does not get that button. A meeting still says Stage, inside More. Before: `test/e2e/artifacts/host-step-before.png`. After: `test/e2e/artifacts/host-step-after.png`.

### Q37. A watcher’s stage was a blank page

An empty broadcast now says **The stage is clear.** A host who has stepped on with the camera off reads **You are on stage. Your camera is off.** A picture fills the space between the room bar and the dock at 1280, 1920, and 900, and after a resize to 900. A meeting does not show the line. Before: `test/e2e/artifacts/stage-picture-before.png`. After: `test/e2e/artifacts/stage-picture-after.png`. Filled: `test/e2e/artifacts/stage-picture-fill.png`.

### Q38. The join sheet told a viewer they would appear in the meeting

The sheet’s title stays **This is how you'll appear.** There is no “in the meeting” line. A broadcast viewer also reads **Only seen if you raise your hand and are promoted to the stage.** A host and a meeting get the title only. The line fits inside the card at 1280, 1920, and 900. Before: `test/e2e/artifacts/appear-note-before.png`. After: `test/e2e/artifacts/appear-note-after.png`.

### Q39. A viewer raised a hand from inside More

On a broadcast the viewer’s dock says **Raise hand**. It turns blue and says **Lower hand** once the hand is up. The word fits, and the dock stays inside the window at 1280, 1920, and 900, including Lower hand at 900. A host and a meeting still say Hand, inside More. Before: `test/e2e/artifacts/viewer-hand-before.png`. After: `test/e2e/artifacts/viewer-hand-after.png`. Raised: `test/e2e/artifacts/viewer-hand-raised.png`.

A desktop walk of both journeys is in `test/e2e/artifacts/journey/`. The viewer joins, watches a clear stage, raises a hand, and steps off from More after a test promotion. The host opens the lobby, joins with the title only, goes live, steps on, steps off, and gets the leave question.

### Q40. A promoted viewer stepped off from inside More

Once a viewer is on the stage, the dock shows a red **Step off**, the same control as the host. The word fits, and the dock stays inside the window at 1280, 1920, and 900. Stepping off puts Stage back in More. A watcher who is not on stage does not get the button. Before: `test/e2e/artifacts/viewer-stepoff-before.png`. After: `test/e2e/artifacts/viewer-stepoff-after.png`.

### Q41. A viewer on stage was told the stage was clear

Anyone on the stage with no picture now reads **You are on stage. Your camera is off.** Stepping off brings back **The stage is clear.** A host already had the camera-off line. Before: `test/e2e/artifacts/viewer-onstage-before.png`. After: `test/e2e/artifacts/viewer-onstage-after.png`.

### Q42. The room bar still said You are watching

A person on the stage now reads **Broadcast · You are on stage**, on the red bar. The words fit beside Not recording at 1280, 1920, and 900. A host stays **Broadcast · You are live**. Stepping off returns the bar to **Broadcast · You are watching**. Before: `test/e2e/artifacts/viewer-air-before.png`. After: `test/e2e/artifacts/viewer-air-after.png`.

### Q43. The top line still said You are watching

A person on the stage now reads **You are on stage.** The badge says **On stage**. Neither overlaps Fit at 1280, 1920, or 900. Stepping off brings back **You are watching this broadcast.** and **Watching**. A host still reads **You are live. Send the link.** Before: `test/e2e/artifacts/viewer-chip-before.png`. After: `test/e2e/artifacts/viewer-chip-after.png`.

### Q44. Fit did nothing on a broadcast

Fit and Scroll lay out a gallery of faces. A broadcast is one stage, and the gallery layout does not run there, so the button only renamed itself. A broadcast now hides Fit, for the host and for a viewer, at 1280, 1920, and 900. A meeting still shows Fit, and a tap still switches it to Scroll. Before: `test/e2e/artifacts/fit-service-before.png`. After: `test/e2e/artifacts/fit-service-after.png`.

### Q45. Broadcast chat crushed its own title

Opening chat put **Broadcast chat** in a narrow column beside the privacy line, so the title wrapped and the line stacked in a 120px strip. The title now stays on one line. The privacy line sits under it, across the panel, and it does not cover the title or Close. The same layout holds a meeting’s **Meeting chat**. Checked at 1280, 1920, and 900, and after a resize to 900. Before: `test/e2e/artifacts/chat-head-before.png`. After: `test/e2e/artifacts/chat-head-after.png`.

### Q46. Broadcast help named a button that is not there

Help told a viewer to tap **Hand** and to step down. The dock says **Raise hand**, and leaving the stage says **Step off**. The broadcast help now uses those words. A meeting still has its own help, and it still explains the stadium. The card stays inside the window at 1280, 1920, and 900. Before: `test/e2e/artifacts/help-hand-before.png`. After: `test/e2e/artifacts/help-hand-after.png`.

### Q47. Full screen on a broadcast followed a speaker

The dock’s **Full screen** opened a black view whose only control was **Follow speaker**. A broadcast is one stage, so that view now shows the stage. A clear stage reads **The stage is clear.** A person on stage with the camera off reads **You are on stage. Your camera is off.** Close stays inside the window at 1280, 1920, and 900. A meeting still has Follow speaker. Before: `test/e2e/artifacts/fs-stage-before.png`. After: `test/e2e/artifacts/fs-stage-after.png`.

### Q48. The broadcast password was called a room lock

Password on a broadcast opened **Room password** and said anyone in the meeting can change it, and that new joiners must enter it. The lobby already calls this **Viewer password**, optional, and not part of the link (`run.html`, the broadcast lobby). `js/gifos-net.js` cites `docs/meet-security.md` §LOCK: the password is mixed into the room key, so without it you cannot read the room, and the link’s sid and token stay password-free, so people still route in. The stage rule in `run.html` (Nathan, 2026-08-03) is the same: the password is the read capability, and a clear stage with only the link is not allowed. The sheet now uses the lobby’s name and note, and says people can still watch while the stage stays blurred until it is set. The card stays inside the window at 1280, 1920, and 900. A meeting still says Room password. Before: `test/e2e/artifacts/viewer-pw-before.png`. After: `test/e2e/artifacts/viewer-pw-after.png`.

### Q49. Who is watching still described a meeting

The title already said **Who is watching**. The paragraph under it still said a server was not storing this meeting. It now says this broadcast. A meeting still says Who is here, and its paragraph still says meeting. The card stays inside the window at 1280, 1920, and 900. After: `test/e2e/artifacts/who-service-after.png`.

### Q50. A host alone had no Invite in the chip

The sentence said **You are live. Send the link.** The only Invite was the dock button, which opens a sheet. On a phone that same moment is a blue **Invite** in the chip (3f703a7). Desktop now shows that button beside the sentence. It is 44px, blue, and it copies or shares the viewer link. A viewer password in the link or in storage is left out. The button goes away when someone else is here. A viewer and a meeting do not get it. The sentence stays, and it still fits at 1280, 1920, and 900. Before: `test/e2e/artifacts/host-invite-before.png`. After: `test/e2e/artifacts/host-invite-after.png`.

### Q51. A host had to open More to put slides on the stage

Share sat in More on a broadcast. A meeting already had it on the dock. StreamYard, YouTube Live, and a church desk put screen share next to the camera, because the slides are the broadcast. A host’s **Share** is now on the dock, labeled Share, and the tip says it shows the stage a window, a tab, or the desktop. The bar still fits at 1280, 1920, and 900, including after a resize to 900. A viewer still finds Share in More. A meeting is unchanged. Before: `test/e2e/artifacts/host-share-before.png`. After: `test/e2e/artifacts/host-share-after.png`.

### Q52. Settings said people see you on a tile

On a broadcast, Settings said **What everyone sees on your tile.** A broadcast has a stage, not a tile. It now says **What everyone sees on the stage.** The line stays inside the window at 1280, 1920, and 900. A meeting still says tile. Before: `test/e2e/artifacts/stage-name-before.png`. After: `test/e2e/artifacts/stage-name-after.png`.

### Q53. The Chat tip still said meeting

The Chat button’s tip said the chat stays between the people on this meeting. The label inside the button kept that sentence from being replaced. A broadcast now says **Chat with everyone watching — stays between the people here, not on a server.** A viewer gets the same tip. A meeting still says meeting. The button stays on the dock at 1280, 1920, and 900. Before: `test/e2e/artifacts/chat-tip-before.png`. After: `test/e2e/artifacts/chat-tip-after.png`.

### Q54. Settings still called itself a meeting

The Settings tip said **Meeting settings** and promised a sound mix. On a broadcast the sound mix is hidden, and the sheet is the camera, the name, and the picture on the stage. The tip now says **Broadcast settings — the picture you send, and the name people see on the stage.** The button stays inside More at 1280, 1920, and 900. A meeting still says Meeting settings. Before: `test/e2e/artifacts/settings-tip-before.png`. After: `test/e2e/artifacts/settings-tip-after.png`.

### Q55. Chat still pinned a file to the meeting

The paperclip in broadcast chat said **Pin a file to the meeting.** The files heading already said this broadcast. The tip now says **Pin a file to this broadcast.** It stays in the composer at 1280, 1920, and 900. A meeting still says meeting. Before: `test/e2e/artifacts/pin-tip-before.png`. After: `test/e2e/artifacts/pin-tip-after.png`.

### Q56. Run app and Float still said meeting

Run app opened **Run an app in this meeting** and said the meeting’s audio and video wrap the app. Float’s tip said **Float the meeting.** A broadcast now says **Run an app on this broadcast**, and that it runs for everyone watching, around the stage. Float says **Float the stage.** The sheet stays inside the window at 1280, 1920, and 900. Where the browser can float a picture, Float stays inside More. A meeting still says meeting. Before: `test/e2e/artifacts/app-modal-before.png`, `test/e2e/artifacts/app-float-before.png`. After: `test/e2e/artifacts/app-modal-after.png`, `test/e2e/artifacts/app-float-after.png`.

### Q57. A host left the same way a viewer does

The host dock said **Leave**, and the confirm said **Leave the broadcast?** with no consequence. Ending a broadcast is not the same act as a viewer stepping out. The host dock now says **End**. The confirm says **End the broadcast?** and that everyone watching sees a five-minute countdown, then the room closes. That matches the admin-absence countdown: a short silent pause, then five minutes, then the room closes. Stay keeps the host there. After End, the card says **You ended the broadcast** and Rejoin keeps it open. A viewer still says **Leave the broadcast?** and leaves only themselves. A meeting still hangs up on the red button. The dock and the card stay inside the window at 1280, 1920, and 900. Before: `test/e2e/artifacts/host-end-dock-before.png`, `test/e2e/artifacts/host-end-ask-before.png`. After: `test/e2e/artifacts/host-end-dock-after.png`, `test/e2e/artifacts/host-end-ask-after.png`.

### Q58. A broadcast recording still offered the row and the stadium

Record this broadcast listed **Stage + my row** and **Everything I see**, and the second one named the stadium. A broadcast does not show a row or a stadium, so those choices would save a picture nobody is watching. The sheet now says **Only the stage.** Starting with an empty stage still stays on the sheet and says there is nothing to record. A meeting still offers the row and everything on screen. The sheet stays inside the window at 1280, 1920, and 900. Before: `test/e2e/artifacts/rec-stage-before.png`. After: `test/e2e/artifacts/rec-stage-after.png`.

### Q59. A clap on a broadcast never reached the stage

The reaction painted on your own tile. A broadcast hides that tile, so a clap left the stage saying **The stage is clear.** The same clap now appears on the stage, above the dock and clear of the reaction tray, at 1280, 1920, and 900. A meeting still paints it on the tile. Before: `test/e2e/artifacts/react-stage-before.png`. After: `test/e2e/artifacts/react-stage-after.png`.

### Q60. Float did nothing when the stage was empty

Float is in More where the browser can float a picture. On an empty stage the tap returned without a word, and the status line stayed **You are live. Send the link.** The tap now says **Nothing on the stage to float yet.** The line fits at 1280, 1920, and 900. Leaving the tab still stays quiet. A meeting is unchanged. Before: `test/e2e/artifacts/float-empty-before.png`. After: `test/e2e/artifacts/float-empty-after.png`.

### Q61. A viewer’s clap never reached the stage

A clap stayed on the person who sent it. The host’s stage had no sign of the audience. A broadcast now adds every clap into one pill on the stage: twelve viewers are **👏 12**, and a different reaction is its own pill. One person can add six in ten seconds, then further taps from that person wait. The pills sit above the dock at 1280, 1920, and 900. A meeting still paints a clap on the tile only. Before: `test/e2e/artifacts/react-count-before.png`. After: `test/e2e/artifacts/react-count-after.png`.

### Q62. A broadcast could not mute the stage

The sound mix is hidden on a broadcast, because the stage is the only bus. That also removed the only way to silence what you hear. The room bar now says **Sound on**. Tapping it says **Muted** and silences the stage on this device. The line says everyone else still hears it. The saved mix is unchanged. A meeting has no such button and still keeps the mix in Settings. The button sits inside the bar at 1280, 1920, and 900, clear of the dock. Before: `test/e2e/artifacts/stage-sound-before.png`. After: `test/e2e/artifacts/stage-sound-after.png`.

### Q63. A host alone on a broadcast read 1 here

The room bar counted everyone, so a host alone read **1 here**: it counted the host. A broadcast now counts the people watching. The host and everyone on the stage are left out. A host alone reads **0 watching**. Twelve viewers read **12 watching**. A viewer alone reads **1 watching**. Tapping it opens Who is watching. A meeting still reads **1 here**. The button sits inside the bar at 1280, 1920, and 900, clear of the dock. Before: `test/e2e/artifacts/watch-count-before.png`. After: `test/e2e/artifacts/watch-count-after.png`.

### Q64. One viewer clap counted twice on the host stage

A clap goes out over the direct link and over the mesh. The frame had no id, so the host added both copies: two claps read **👏 4**. Each clap now carries an id, and the host counts an id once. Two claps read **👏 2**, however they arrive. A frame from an older device without an id still counts. The pills sit above the dock at 1280, 1920, and 900. Before: `test/e2e/artifacts/clap-once-before.png`. After: `test/e2e/artifacts/clap-once-after.png`.

### Q65. A clap made as the link opened never reached the host

The specs handed the host a fake frame, so nothing proved a clap crossed a real link. `test/e2e/cross-clap.js` runs two real browsers through a relay, one per machine if you give it two Playwright run-servers. It found this: a clap goes to the people on the roster, and the roster catches up on its own tick. A viewer who clapped the moment the link opened had the host on an open channel but not on the roster yet, so the clap went nowhere. The viewer read **👏 2** and the host read **👏 1**, or nothing. A clap now also goes over every open channel the roster missed, and the id from Q64 drops the copy a host gets both ways. Before: `test/e2e/artifacts/clap-early-before.png`. After: `test/e2e/artifacts/clap-early-after.png`.

### Q66. A viewer saw a black square when the host's camera was off

`test/e2e/cross-camoff.js` runs a host and a viewer in real browsers. A host goes live with the camera off, and the viewer's stage was a black square. The host's name was burned into its foot, half under the On stage label. Nothing said the camera was off. The name card came up only for someone with a profile picture, and it sat at a fixed spot that could cover the room bar. Now anyone on the stage with the camera off shows their picture or initial, their name, and **Camera off** in the middle of the stage. The black frame under it is hidden. A screen share is still a picture, so it shows with no card. The host's own card leaves out Camera off, because the line under the room bar already says it. Before: `test/e2e/artifacts/camoff-stage-before.png`. After: `test/e2e/artifacts/camoff-stage-after.png`.

### Q67. A viewer at the name card saw Video and Unmute on the dock

A viewer is marked as a watcher only when they join. Behind "This is how you'll appear" the dock still showed the red **Video** and **Unmute** buttons, and they belong to whoever is on the stage. A viewer is now marked at boot, so the dock behind the card has no camera or mic: it starts with Raise hand. The captions and recording spec had read host-only buttons through the same leak, so it now opens as a host. `test/e2e/cross-namecard.js` checks it with the host and the viewer on two machines. Before: `test/e2e/artifacts/viewer-namecard-before.png`. After: `test/e2e/artifacts/viewer-namecard-after.png`.

### Q68. A viewer at the name card read watching, reconnecting, and 1 watching

A viewer joins the room only after they save "This is how you'll appear". Behind that card they read **You are watching this broadcast. · reconnecting to the room…** and **1 watching**. They were not watching yet, nothing had dropped, and the one counted was themselves. At the card the line now says **Joining the broadcast…** (a host's says **Going live…**), and the count is hidden until they join. After Save a viewer with the host live reads **1 watching**. `test/e2e/cross-cardstatus.js` checks it with the host and the viewer on two machines. Before: `test/e2e/artifacts/card-status-before.png`. After: `test/e2e/artifacts/card-status-after.png`.

### Q69. A joined viewer read the video quality and a password hint

A viewer who joined read **2 in this broadcast · 720p · a password unlocks clear video**. A viewer sends no video, so the quality and the password were talk for a host. The count counted the viewer too. The line now says **You are watching this broadcast.** `test/e2e/cross-viewline.js` checks it with the host and the viewer on two machines. Before: `test/e2e/artifacts/viewer-line-cross-before.png`. After: `test/e2e/artifacts/viewer-line-cross-after.png`.

### Q70. A live host read the meeting count and "a password"

A host with one viewer read **2 in this broadcast · 720p · a password unlocks clear video**, while the room bar said **1 watching**. The host had just typed a password to go live, and the line did not say which password it meant. The line now reads **You are live · 720p · blurred until you set a viewer password**, and **You are live · 720p** once a viewer password is set. `test/e2e/cross-hostline.js` checks it with the host and the viewer on two machines. Before: `test/e2e/artifacts/host-line-cross-before.png`. After: `test/e2e/artifacts/host-line-cross-after.png`.

### Q71. A live host's line cut off the viewer password

A live host with a viewer reads **You are live · 720p · blurred until you set a viewer password**. When the room link drops, **reconnecting to the room…** joins the line. At 1024 and 900 the line ran out of room and ended in **blurred until y…**, so the one thing the host could act on was cut. On a desktop a broadcast line now takes up to two lines. The chip still clears the room bar, and a meeting keeps its one line. `test/e2e/cross-hostfit.js` checks it with the host at 900 wide and the viewer on another machine: it cuts the host's relay link so the reconnect note shows. Before: `test/e2e/artifacts/host-fit-cross-before.png`. After: `test/e2e/artifacts/host-fit-cross-after.png`.

### Q72. The On stage label was near-black on the dark stage

The band at the foot of the stage is always dark, but its words used the page's text color. On the light theme that is near-black, so **On stage** read at a contrast of 1.2 and 10px, on the host and on every viewer. A shared screen's name sits in the same band. The band's words are now always light (contrast 15.4), and the stage's label is 12.8px. Stadium tiles keep their small label. `test/e2e/cross-stagelabel.js` reads the label on the host and on a viewer on another machine. Before: `test/e2e/artifacts/stage-label-cross-before.png`. After: `test/e2e/artifacts/stage-label-cross-after.png`.

### Q73. The Chat icon on the dock was a dot

The dock sizes each icon to 28px, but the rule left out Chat, so its speech bubble fell back to 1.2em of the dock's 11px label: 13px, beside 28px Invite, Full screen and More. It read as a dot on the host's dock and every viewer's, and on a meeting's dock too. Chat now has the same 28px icon. `test/e2e/cross-chaticon.js` reads both icons on the host and on a viewer on another machine. Before: `test/e2e/artifacts/chat-icon-cross-before.png`. After: `test/e2e/artifacts/chat-icon-cross-after.png`.

### Q74. A clap on the stage was only a count

A host saw **👏 4** on the stage and nothing about who clapped, though the room already lists the people watching. Under the pill a dark line now names them, latest first and once each: **Dee, Jo Park +2**. A viewer's own clap reads **You**. The count is unchanged, and a screen reader hears **4 claps from Dee, Jo Park and 2 others**. `test/e2e/cross-clapwho.js` has a viewer on another machine clap: the host's stage reads **Jordan Lee**, the viewer's **You**. Before: `test/e2e/artifacts/clap-who-cross-before.png`. After: `test/e2e/artifacts/clap-who-cross-after.png`.

### Q75. A viewer's header said watching three times

A joined viewer read **WATCHING · You are watching this broadcast.** right beside **Broadcast · You are watching**, and nothing in the header said who was live. The badge and the room bar keep saying watching; the line beside the badge now names the host: **Pastor Kim is live.** (or the first other person on the stage). Before anyone is known, the line still says **You are watching this broadcast.** `test/e2e/cross-wholive.js` has a viewer on another machine join: the line reads **Pastor Kim is live.** Before: `test/e2e/artifacts/who-live-cross-before.png`. After: `test/e2e/artifacts/who-live-cross-after.png`.

### Q76. The lobby preview showed your camera, but the call opened dark

The lobby shows your camera live, yet every call and broadcast opens muted with the camera off, and nothing on the preview said so. The card said **Turn the camera on here** with no camera control there, and a broadcast's list said **Broadcasts you start or watch**. The preview now carries **You join muted, with the camera off** at its top, clear of your name; the card says to turn the camera on from the call; a broadcast's list says **Broadcasts you start or watch show up here.** Spec `the lobby preview says you join muted with the camera off` checks 1280, 1920 and 900 for both kinds. Before: `test/e2e/artifacts/lobby-note-group-before.png`, `lobby-note-service-before.png`. After: `lobby-note-group-after.png`, `lobby-note-service-after.png`, and over a live camera `lobby-note-camera-after.png`.

### Q77. Escape left the chat open

With Chat open, the first Escape folded More and the next did nothing, so the panel kept covering the right of the stage until you found its ✕. This happened on a broadcast host, a viewer and a meeting. Escape now closes an open chat before it folds More, as a side panel closes in Meet and Zoom, and the keyboard lands back on Chat. A sheet opened over the chat (Invite) still closes first and leaves the chat open. Chat now says whether it is open (`aria-expanded`). Spec `Escape closes the chat panel and returns to the Chat button` checks 1280, 1920 and 900. `test/e2e/cross-chatesc.js` checks the host and a viewer on another machine, each with a message typed. Before: `test/e2e/artifacts/chat-esc-open-before.png`, `chat-esc-cross-before.png`. After: `chat-esc-after.png`, `chat-esc-cross-after.png`.

### Q78. The chat's close and attach buttons were only ✕ and 📎

A screen reader heard the chat's close button as "✕" and the attach button as "📎", on a broadcast host, a viewer and a meeting. Pressing close from the keyboard also left focus on the page body, so the next Tab started from the top of the page. Close is now named Close chat and returns the keyboard to Chat, as Escape does (Q77). Attach is named for its job: Pin a file to this broadcast, or Pin a file to the meeting on a meeting. Spec `the chat close and attach buttons have names, and closing returns to Chat` checks 1280 and 900. `test/e2e/cross-chatnames.js` checks the host and a viewer on another machine. Before: `test/e2e/artifacts/chat-names-before.png`. After: `chat-names-after.png`. The change is not visible in the shots; the names and focus are in the spec and cross output.

### Q79. Tab walked through eight links you could not see

After the room bar's last button, Tab stopped on eight links meant for AI agents (llms.txt, what GifOS is, the App Store, /apps/index.json, browser support, sitemap, source on GitHub, report a problem). They are clipped to 1px so agents can read them, so each stop showed no focus at all, on a broadcast host, a viewer and a meeting. run.html now takes them out of the Tab order. They stay in the HTML and in the screen reader's list of landmarks. Spec `the Tab walk in a session stops only on controls you can see` checks each Tab stop by what is drawn at its centre. `test/e2e/cross-tabwalk.js` checks the host and a viewer on another machine. Before: `test/e2e/artifacts/tab-walk-before.png` (focus on llms.txt, nothing on screen is focused). After: `tab-walk-after.png` (focus goes from the room bar back to the GifOS title).

### Q80. Tab ran the whole dock before the room bar

The room bar (Recording, who is watching, Sound) sits above the stage and the dock sits below it. Tab still went through every dock button first and only reached the room bar after End or Leave, on a broadcast host, a viewer and a meeting. The room bar came after the dock in run.html. It now comes before the dock, and the page looks the same: every box is in the same place at 1280 on a host, a viewer and a meeting. Spec `Tab reaches the room bar before the dock, top to bottom`. `test/e2e/cross-taborder.js` checks the host and a viewer on another machine. Before: `test/e2e/artifacts/tab-order-before.png`, `tab-order-cross-before.png`. After: `tab-order-after.png`, `tab-order-cross-after.png`.

### Q81. Nothing listed the keyboard shortcuts

M and V worked, but only a hover title said so. Pressing ? did nothing, and the mic and camera buttons did not tell a screen reader their keys, on a broadcast host, a viewer and a meeting. Zoom and Meet each list their shortcuts. Now ? (outside a text box, in a call, not in the lobby) opens a Keyboard shortcuts sheet that lists the keys that work for that person: M and V only when the mic and camera are on their dock, then Esc, Tab, the arrow keys on the grip, and ?. Escape closes it and focus goes back. Help links to it. `#mic` and `#cam` carry `aria-keyshortcuts`. Spec `? lists the keyboard shortcuts that work here`. `test/e2e/cross-keys.js` checks the host and a viewer on another machine. Before: `test/e2e/artifacts/keys-before.png`, `keys-cross-before.png`. After: `keys-after.png`, `keys-cross-after.png`.

### Q82. Only M and V acted; Chat, Reactions and Raise hand needed a Tab walk

On a broadcast host, a viewer and a meeting, the only keys that did anything were M and V. Chat, Reactions and a viewer's hand were reached only by walking the dock with Tab. Zoom and Meet each give chat and raise hand a key. Now C opens or closes the chat with the keyboard in the message box, R opens Reactions with the keyboard on the first one, and H raises or lowers your hand where a hand can go up (a viewer, a meeting; a broadcast host has none). Escape closes either one, as before. None of them fire while you type, in the lobby, or under a sheet. The ? list names them, and Chat, React and the hand buttons carry `aria-keyshortcuts`. Spec `C, H and R open Chat, raise a hand and open Reactions`. `test/e2e/cross-keys2.js` checks the host and a viewer on another machine, and that the host sees the viewer's H in the raised-hands line. Before: `test/e2e/artifacts/keys2-before.png`, `keys2-cross-before.png`. After: `keys2-after.png`, `keys2-cross-after.png`.

### Q83. The raised-hands line read near-black on the dark page

When a viewer raised a hand, the host's line above the stage read "✋ 1 waiting:" in near-black (1.1:1 against the page) and the first name in a dim blue (4.1:1). The session page is always dark, but the line took its colors from the light theme (`--text`, `--accent`). It is now light text with a light blue name (15.9:1 and 9.2:1), on a broadcast host and a meeting. Spec `the raised-hands line is readable on the dark page`. `test/e2e/cross-handq.js` has a viewer on another machine press H and reads the host's colors. Before: `test/e2e/artifacts/handq-before.png`, `handq-cross-before.png`. After: `handq-after.png`, `handq-cross-after.png`.

### Q84. The vote sheet's hints and Cancel were hard to read

In a meeting's Place a vote sheet, the hint under Vote onto stage and Vote off stage was near-black on the dark option buttons (1:1): the hint took the light theme's `--text`, but those two buttons are always dark. Cancel was pale grey on the white sheet (1.7:1). The two hints are now light (9.7:1), and Cancel takes the sheet's own text color (16.8:1). Vote out of room was already readable. Spec `the vote sheet is readable in a meeting`. `test/e2e/cross-votesheet.js` puts two people in a call on two machines and reads the first person's sheet. Before: `test/e2e/artifacts/vote-sheet-before.png`, `vote-cross-before.png`. After: `vote-sheet-after.png`, `vote-cross-after.png`.

### Q85. Full screen had no key, its close read ✕, and Escape folded More under it

On a broadcast host, a viewer and a meeting, Full screen was reached only by walking the dock with Tab. Zoom and YouTube give it a key. Its close button read only "✕" to a screen reader. When the browser kept the view out of real full screen, Escape reached the page and folded More beneath the black view instead of closing it. Closing left the keyboard on nothing, and in real full screen a refocus failed because the rest of the page stays inert until the exit lands. Now F opens Full screen with the keyboard on its close button, named Exit full screen. F again or Escape closes it, and the keyboard lands back on Full screen once the exit lands. F does not fire while you type, in the lobby, or under a sheet. The ? list names it, and the button carries `aria-keyshortcuts`. Spec `F opens Full screen, Escape closes it, and its close button is named`. `test/e2e/cross-fskey.js` checks the host and a viewer on another machine in real full screen. Before: `test/e2e/artifacts/fskey-before.png`, `fskey-cross-before.png`. After: `fskey-after.png`, `fskey-cross-after.png`.

### Q86. Full screen of a camera-off host was a black screen

With the host's camera off, the stage shows their picture or initial, their name, and **Camera off** (Q66). Full screen on the host and on every viewer showed the black frame under that card instead, with only the close button on it. Full screen now shows the same card, big: the picture or initial, the name, and Camera off (also on the host's own view, where the line under the room bar is out of sight). A screen share is still a picture, so it shows with no card. Spec `Full screen of a camera-off host shows who it is, not a black screen`. `test/e2e/cross-fscamoff.js` checks the host and a viewer on another machine. Before: `test/e2e/artifacts/fs-camoff-before.png`, `fs-camoff-cross-before.png`. After: `fs-camoff-after.png`, `fs-camoff-cross-after.png`.

### Q87. A viewer's stage stayed a bare frame when the feed came in after the host's status

With the host's camera off, a viewer's stage shows their picture or initial, their name, and **Camera off** (Q66). In real two-browser sessions, 2 joins in 4 showed a grey frame with no name instead, and it stayed that way. The viewer learned the camera was off before the stage feed arrived, and when the feed's tile went in, nothing repainted the card. It came up only if some later status change happened to arrive. The watcher on the stage feed now repaints the card as well as the plate, so the card is up on the first frame the tile is, and it leaves with the feed. Spec `a viewer sees the camera-off card when the stage feed arrives after the host status`. `test/e2e/cross-camofflate.js` puts the viewer on another machine and holds the feed's tile until the card is quiet, so the order happens every run. Before: `test/e2e/artifacts/camoff-late-before.png`, `camofflate-cross-before.png`. After: `camoff-late-after.png`, `camofflate-cross-after.png`.

### Q88. A joining viewer was told "The stage is clear." while the host was live

After Save, a viewer's stage read **The stage is clear.** until the host's feed came in, beside "Joining the broadcast…" on the top line. In real two-browser sessions that lasted 0.2 to 12 seconds at every join, and it stayed after the host's status said they were on stage (the roster lists the host a beat later). The plate now says **Joining the broadcast…** until the host is known, then **Connecting to Pastor Kim…** (the name of whoever is on stage) until the picture comes in. "The stage is clear." is kept for a stage that is known to be empty (a host knows their own stage), or a room nobody has answered from 20 seconds after joining. Three older specs read "clear" on a lone viewer no host had answered; they now place a host who is off the stage, which is what clear means. Local text only, no new messages. Spec `a joining viewer is not told the stage is clear while the host is live`. `test/e2e/cross-joinplate.js` puts the viewer on another machine and holds the feed's tile 2 seconds, so the window is there every run. Before: `test/e2e/artifacts/join-plate-before.png`, `joinplate-cross-before.png`. After: `join-plate-after.png`, `joinplate-cross-after.png`.

### Q89. The open chat covered the room bar's Sound on pill and the stage

At 1280 the chat panel (340 px, fixed to the right) lay over the room bar's Sound on pill for a host and a viewer, and over Fit in a meeting. At 1024 and 900 it also hid the status line, Invite and the watching count, and the stage stayed centred under the panel. On a window 800 px or wider, `body.chatside` now follows the panel (the same observer that keeps Chat's aria-expanded) and the room bar, header chip and stage narrow by the panel's width, as Meet and Zoom do beside a side panel; Fit moves left with it, and closing the chat gives the width back. The dock is unchanged: it already floats above the panel's bottom band, which the panel keeps clear. A phone keeps the panel over the call. Layout only, nothing sent. Spec `the open chat sits beside the room bar and stage, not over them` (host, viewer, meeting at 1280, 1920, 1024, 900). `test/e2e/cross-chatside.js` opens Chat on the host and on a viewer on another machine. Before: `test/e2e/artifacts/chat-side-before.png`, `chat-side-cross-before.png`, `chat-side-cross-viewer-before.png`. After: `chat-side-after.png`, `chat-side-cross-after.png`, `chat-side-cross-viewer-after.png`.

### Q90. The host's chat head wrapped the close ✕ alone onto a second row

Every button in the chat head pushed itself right (`margin-left: auto`), so at 1280 a host's Broadcast chat head fit the title, Transcript and Turn chat off on one row and dropped the ✕ alone under them (Firefox draws the buttons a little wider, so it wrapped there first). The privacy line under the title still began with the "·" it had when it sat beside the title. Only Transcript pushes right now, the head buttons are a size smaller (.78rem, tighter padding) and never wrap their own text, and the line reads "Private to this broadcast, gone when everyone leaves" (and meeting, meeting). Layout and wording only, nothing sent. Spec `the chat head keeps its buttons on one row beside the title` (host, viewer, meeting at 1280, 1920, 1024, 900). `test/e2e/cross-chathead.js` opens Chat on the host and on a viewer on another machine. Before: `test/e2e/artifacts/chat-headrow-before.png`, `chat-headrow-cross-before.png`. After: `chat-headrow-after.png`, `chat-headrow-cross-after.png`, `chat-headrow-cross-viewer-after.png`.

### Q91. The chat box cut its placeholder to "Message ever"

The chat box sat in one row between Prayer, 📎 and Send in the 340 px panel, which left it about 100 px of text room, so at every desktop width the host and each viewer read **Message ever** (and **Prayer request** lost its end with Prayer on). On a window 800 px or wider, Prayer and 📎 now take a small row above the box (36 px tall), and the box and Send share the full width, about 220 px of text room. The Tab order is unchanged: Prayer, 📎, the box, Send. A phone keeps the old row. Layout only, nothing sent. Spec `the chat box shows its whole placeholder beside Send` (host, viewer, meeting at 1280, 1920, 1024, 900, plain and Prayer). `test/e2e/cross-chatbox.js` opens Chat on the host and on a viewer on another machine. Before: `test/e2e/artifacts/chat-box-before.png`, `chat-box-cross-before.png`, `chat-box-cross-viewer-before.png`. After: `chat-box-after.png`, `chat-box-cross-after.png`, `chat-box-cross-viewer-after.png`.

### Q92. With chat off, the chat box cut its line to "Chat is off for guests — you c"

When the host pressed Turn chat off, the host's box read **Chat is off for guests — you c** (310 px of text in about 220 px) and each viewer's locked box read **Chat is off — only the host c** (291 px), on the host and a viewer on another machine at 1280 and at every desktop width. The placeholders are now **Chat is off for guests** (host, 156 px) and **Chat is off for now** (viewer, 147 px); the whole sentence moves to the box's title, and the chat log still says who turned chat off and that only the host can post. Wording only, nothing sent. Spec `the chat-off placeholders fit the chat box` (host and viewer at 1280, 1920, 1024, 900, through `chatGateForTest`). `test/e2e/cross-chatoff.js` turns chat off from a real host and reads both boxes on two machines. Before: `test/e2e/artifacts/chat-off-cross-before.png`, `chat-off-cross-viewer-before.png`. After: `chat-off-host-after.png`, `chat-off-viewer-after.png`, `chat-off-cross-after.png`, `chat-off-cross-viewer-after.png`.

### Q93. The lobby card ran flush to the window's right edge

On a desktop window (701 px and wider) the white lobby card for a broadcast and a meeting sat at the window's right edge, its rounded corners cut square, while the preview kept 16 px to the left and between the two. The card kept the narrow-window `width: 100%` and added its 16 px margin, so it overflowed its column by 16 px (Firefox also let the lobby scroll sideways by 16 px). The desktop card is now `width: auto`: 16 px on every side, corners round. Layout only, nothing sent. Spec `the lobby card keeps the same gap to the right edge as the preview has to the left` (broadcast and meeting at 1280, 1920, 1024, 900, 760). `test/e2e/cross-lobedge.js` opens a meeting's lobby and a broadcast's on two machines. Before: `test/e2e/artifacts/lobby-edge-group-before.png`, `lobedge-cross-group-before.png`, `lobedge-cross-service-before.png`. After: `lobby-edge-group-after.png`, `lobby-edge-service-after.png`, `lobedge-cross-group-after.png`, `lobedge-cross-service-after.png`.

### Q94. With the chat open, the dock ran across the chat's edge

With the chat open beside the call on a desktop window, the dock stayed centred on the whole window: at 1280 the host's dock ran from 204 to 1076 px with End over the chat's edge at 940, a viewer's Leave sat over it too, and the chat kept an empty 128 px band at its bottom for the dock, its box floating above it. On a window 800 px and wider, when the dock fits in the call beside the chat, `placeDock` now centres it on the call (drag and nudge stay inside the call), and the composer moves down to the panel's bottom. A dock wider than the call (a host at 1024 and 900) keeps the old place over the chat's bottom band, the composer above it. Closing the chat puts the dock back in the window's middle. Layout only, nothing sent. Spec `with the chat open, the dock sits in the call beside it, not across its edge` (host, viewer and meeting at 1280, 1920, 1024, 900). `test/e2e/cross-dockside.js` opens Chat on a live host and a viewer on another machine. Before: `test/e2e/artifacts/dock-side-before.png`, `dock-side-cross-before.png`, `dock-side-cross-viewer-before.png`. After: `dock-side-after.png`, `dock-side-cross-after.png`, `dock-side-cross-viewer-after.png`.

### Q95. With the chat open, the room bar broke its title and every pill in two

With the chat open beside the call on a 800 to 1024 px window, the call is 460 to 684 px wide, and the room bar squeezed its title and pills onto one row: a viewer at 900 read **Broadcast · You are watching** over two lines and every pill split in two (**Not / recording**, **1 / watching**, **Sound / on**); a host at 900 read **Broadcast · You are / live**. On a window 800 px and wider, the title and pills no longer break inside, and with the chat open the bar may put the pills on a row under the title (80 px tall instead of 52; Q89's spec now allows two rows below 1100 px). At 1100 px and wider, and with the chat closed, the bar is one row as before. Layout only, nothing sent. Spec `with the chat open, the room bar keeps each pill and its title on one line` (host, viewer and meeting at 900, 800, 1024, 1280). `test/e2e/cross-airwrap.js` opens Chat on a live host and a viewer on another machine at 900x720. Before: `test/e2e/artifacts/airbar-wrap-before.png`, `airbar-wrap-cross-before.png`, `airbar-wrap-cross-viewer-before.png`. After: `airbar-wrap-after.png`, `airbar-wrap-cross-after.png`, `airbar-wrap-cross-viewer-after.png`.

### Q96. With the chat open on a small window, the dock ran over the chat

With the chat open beside the call on a 800 to 1024 px window, the call is 460 to 684 px wide, but the host's dock was 872 px and a viewer's 648 px, so the dock kept its place across the chat: at 900 the host's Chat, Share, More and End sat on the panel (dock 14 to 886, chat edge 560), and a viewer's Leave ran over the edge at 800. When the dock is wider than the call beside the chat, it now takes the phone button sizes and moves Chat, then Invite, Full screen and Share, into More, one at a time, until it fits; More shows a button for each that presses the real one, and the dock sits centred in the call. Video, Unmute, Step on or off, Raise hand, React, More and End or Leave stay on the dock. Closing the chat (Escape or ✕) brings the whole dock back and puts the keyboard on Chat. Layout only, nothing sent. Spec `with the chat open on a small window, the dock fits in the call and the rest is under More` (host, viewer and meeting at 900, 800, 1024); the Escape spec now opens Invite from More when it is there. `test/e2e/cross-dockfit.js` opens Chat on a live host and a viewer on another machine at 900x720. Before: `test/e2e/artifacts/dock-fit-before.png`, `dock-fit-cross-before.png`, `dock-fit-cross-viewer-before.png`. After: `dock-fit-after.png`, `dock-fit-cross-after.png`, `dock-fit-cross-viewer-after.png`.

### Q97. The meeting lobby said muted twice

The meeting lobby's preview reads **You join muted, with the camera off**, and the card right beside it said it again: **You come in muted. Turn the camera on from the call if you want to be seen.** The card now says only what the preview does not: **Turn mic and camera on from the call.** It fits on one line at 900, 1280 and 1920. A broadcast's card (**You host. People watch with the link.**) is unchanged. Words only, nothing sent. Spec `the meeting lobby says muted once: the preview says it, the card does not repeat it` (1280, 1920, 900). `test/e2e/cross-lobmuted.js` opens the lobby on two machines. Before: `test/e2e/artifacts/lobby-muted-before.png`, `lobby-muted-cross-before.png`, `lobby-muted-cross-second-before.png`. After: `lobby-muted-after.png`, `lobby-muted-cross-after.png`, `lobby-muted-cross-second-after.png`.

### Q98. A broadcast host's React tray offered Raise hand

A broadcast host has no hand to raise: the dock gives them Step on instead of Raise hand, and H does nothing for them. But the React tray still opened on **✋ Raise hand**, and pressing it raised the host's own hand (the tray button turned blue and the hand went out to the room) at a broadcast where the host is the one who answers hands. The host's tray now holds the four reactions (Clap, Yes, No, Laugh), centred over the dock; R lands on Clap, and Tab skips the hidden hand. A viewer's tray is unchanged: ✋ first, and pressing it puts them on the host's raised-hands line. A meeting keeps ✋ for everyone. Nothing new sent; the host simply stops sending a hand. Spec `a broadcast host's React tray has no Raise hand; a viewer's still does` (host and viewer at 1280, 1920, 900); the C/H/R key spec now looks for the first shown reaction. `test/e2e/cross-reacthand.js` opens React on a live host and a viewer on another machine, then the viewer raises a hand from the tray and the host's line must name them. Before: `test/e2e/artifacts/react-nohand-before.png`, `react-nohand-cross-before.png`, `react-nohand-cross-viewer-before.png`. After: `react-nohand-after.png`, `react-nohand-cross-after.png`, `react-nohand-cross-viewer-after.png`.

### Q99. Float in the More sheet was a small label

In the desktop More sheet, Who, Stage, Settings and Help read at 18px, but Float (shown where the browser has a mini window: Chromium, Edge) was a 13px label pressed against its icon, so it looked like a different, lesser control. It is a phone-sized icon label that the sheet never resized. On windows 800px and wider, Float's label now takes the sheet's size and weight, with 8px between the icon and the word; host and viewer alike. Phones keep the old label: bcast-mobile's call. Nothing new sent. Spec `Float in the More sheet reads at the size of Who, Stage and Settings` (viewer and host at 1920, 1280, 900; in Firefox, which has no mini window, Float must stay hidden). `test/e2e/cross-morefloat.js` opens More on a live host and a viewer on another machine and reads Float against Who on both. Before: `test/e2e/artifacts/more-float-before.png`, `more-float-cross-before.png`, `more-float-cross-viewer-before.png`. After: `more-float-after.png`, `more-float-cross-after.png`, `more-float-cross-viewer-after.png`.

### Q100. A broadcast host's More sheet offered Hand

Q98 took ✋ Raise hand out of a broadcast host's React tray, but the host's More sheet still had **Hand**, and pressing it raised the host's own hand at their own broadcast (it read Lower hand and the hand went out on the host's status). A viewer's Hand sits on the dock as Raise hand, so only a host's stayed in More. A broadcast host's More sheet now leaves Hand out; a viewer still raises a hand from the dock and the host's line names them, and a meeting keeps its Hand. A page that turns out not to be the host (its key is refused) gets the Hand back. Nothing new sent; the host simply stops sending a hand. Spec `a broadcast host's More sheet has no Hand; a viewer raises one from the dock` (host, viewer and meeting at 1280, 1920, 900). `test/e2e/cross-morehand.js` opens More on a live host and a viewer on another machine, then the viewer raises a hand from the dock and the host's line must name them. Before: `test/e2e/artifacts/more-hand-before.png`, `more-hand-cross-before.png`, `more-hand-cross-viewer-before.png`. After: `more-hand-after.png`, `more-hand-cross-after.png`, `more-hand-cross-viewer-after.png`.

### Q101. The Blur row in the More sheet was small

The More sheet opens on a Blur row for anyone who sends video (a broadcast host, a person on the stage, everyone in a meeting). Under 18px buttons it was a 14px grey word and 11px Max / Min / No blur, the dark bar's sizes carried onto the light sheet, so the first row of the sheet was the hardest to read. On windows 800px and wider, Blur now reads at the sheet's 18px and weight in dark text, and Max / Min / No blur at 16px in the same 48px boxes with room around each word. Phones keep the old row: bcast-mobile's call. Nothing new sent. Spec `the Blur row in the More sheet reads at the sheet's size` (broadcast host and meeting at 1280, 1920, 900). `test/e2e/cross-moreblur.js` opens More on a live host with a viewer on another machine watching, reads the host's Blur row, and checks the viewer's sheet has none. Before: `test/e2e/artifacts/more-blur-before.png`, `more-blur-cross-before.png`, `more-blur-cross-viewer-before.png`. After: `more-blur-after.png`, `more-blur-cross-after.png`, `more-blur-cross-viewer-after.png`.

### Q102. Allow screen share broke over two lines in the More sheet

A live host's More sheet (a room admin's) has **Allow screen share**, and at 1280 it broke into "Allow screen / share" in its 168px box while every other button read on one line; the on state, **Stop guest shares**, broke too. On windows 800px and wider the sheet is now as wide as its longest label needs (four equal columns, 176px at 1280), still at least 720px and never wider than the window, or than the call when the chat is open beside it. Phones keep the old sheet: bcast-mobile's call. Nothing new sent. Spec `Allow screen share in the More sheet stays on one line` (broadcast host and meeting at 1280, 1920, 900, 800, and 1280 with the chat open; both labels). `test/e2e/cross-moreshare.js` opens More on a live host with a viewer on another machine watching, reads the button off and on, and checks the viewer's sheet has none. Before: `test/e2e/artifacts/more-share-before.png`, `more-share-cross-before.png`, `more-share-cross-viewer-before.png`. After: `more-share-after.png`, `more-share-cross-after.png`, `more-share-cross-viewer-after.png`.

### Q103. Share was the only dock control without a key

M, V, C, R, H and F each pressed a dock control, but Share took a Tab walk through the dock, on a broadcast host, an allowed viewer and a meeting. Zoom gives sharing a key. Now S opens the Share sheet with the keyboard on Choose what to share…, or stops a share that is on, wherever this person has Share: the dock, More, or More's stand-in when the dock is squeezed beside the chat (Q96). Escape closes the sheet and the keyboard lands back on Share, or on More when Share is folded under it. A viewer the host has not allowed to share has no Share, so S does nothing for them and the ? list leaves it out. S does not fire while you type, in the lobby, or under a sheet. The ? list names it, and Share carries `aria-keyshortcuts`. Nothing new sent. Spec `S opens Share where you can share, and the ? list names it` (broadcast host at 1280, meeting, host at 800 with the chat open). `test/e2e/cross-sharekey.js` checks a host and a viewer on another machine, before and after the host presses Allow screen share. Before: `test/e2e/artifacts/sharekey-before.png`, `sharekey-cross-before.png`, `sharekey-cross-viewer-before.png`. After: `sharekey-after.png`, `sharekey-cross-after.png`, `sharekey-cross-viewer-after.png`.

### Q104. Someone else's recording gave you only OK, and no name

When another person in a meeting started recording, the card offered only **OK**, and with real peers it read **This meeting is being recorded**: a peer's status carries no name, so the recorder's name (Q22) only ever showed in the spec. Zoom and Teams tell you that staying means consent and put Leave on the same notice. Now the card names the recorder from the roster (**Sam Rivera is recording this meeting**, and the title catches up if the name lands after the status), adds **Staying means you agree to be recorded.**, and offers **Leave** (outline) beside **Stay** (blue). Leave takes the same path as the dock's Leave, and the card does not come back over the You left screen. On a broadcast the same choice goes to a viewer who is on stage; the host, the person recording, and a viewer who is only watching (not in a broadcast recording) still get OK. Nothing new sent. Spec `someone else recording you gets Stay or Leave, as in Zoom and Teams` (1280, 1920, 900; the recorder; a watching viewer). `test/e2e/cross-recleave.js` starts a meeting on one machine, joins it from another, turns recording on, and presses Leave on the second machine; the first must see them go. Before: `test/e2e/artifacts/rec-leave-before.png`, `rec-leave-cross-before.png`. After: `rec-leave-after.png`, `rec-leave-cross-after.png`.

### Q105. The recording chip on a tile said meeting

While someone recorded a meeting, the chip on their tile read **⏺ recording this meeting**, under a card and a room bar that say meeting. The chip now uses the card's room word: **⏺ recording this meeting**, or **⏺ recording this broadcast** on a broadcast. The recorder's own check that the indicators are up (`recordingIndicatorsOk`) reads the same words. Nothing new sent. Spec `the recording chip on a tile names the meeting` (1280, 1920, 900; a call opened from the lobby on a relay that is not there, since an mb=1 page never draws a tile). `test/e2e/cross-recchip.js` starts a meeting on one machine, joins it from another, turns recording on, and reads the chip on the recorder's tile on the second machine. Before: `test/e2e/artifacts/rec-chip-before.png`, `rec-chip-cross-before.png`. After: `rec-chip-after.png`, `rec-chip-cross-after.png`.

### Q106. Fit hung over the top-right tile

In a meeting on a desktop the **▦ Fit** pill sat at 58px from the top, below the header and over the top-right tile: on a peer's tile it covered **Blur for all** and the speaking dot, so the button under the pointer was Fit. Zoom keeps View in the top bar, above the faces. On windows 800px and wider Fit now sits in the header band (22px from the top, 84px wide, a lighter pill with an edge so it reads on the dark band), the build label moves to its left, and the status line keeps clear of both. With the chat open Fit stays beside the panel; a broadcast still hides Fit (Q44); phones are unchanged. Nothing new sent. Spec `Fit sits in the header, clear of every tile and its controls` (1280, 1920, 900); `test/e2e/cross-fithdr.js` reads a real peer's tile on a second machine. Before: `test/e2e/artifacts/fit-header-before.png`, `fit-header-cross-before.png`. After: `fit-header-after.png`, `fit-header-cross-after.png`.

### Q107. A tile's menu opened under its Blur for all box

Hovering a peer's tile on a desktop opened its menu (**Mute**, **Blur**) at the tile's top right, under the tile's **Blur for all** box, which sits above it: Mute was hidden and a click on it landed on Blur for all. Zoom's hover menu never sits under another control. When the box is shown, the menu now starts 40px down, below the 32px box. Nothing new sent. Spec `a tile's hover menu sits clear of its "Blur for all" box` (1280, 1920, 900); `test/e2e/cross-tilemenu.js` hovers a real peer's tile on a second machine. Before: `test/e2e/artifacts/tile-menu-before.png`, `tile-menu-cross-before.png`. After: `tile-menu-after.png`, `tile-menu-cross-after.png`.

## Open

A recording card names who is recording, and the bar stays Recording (Q22). Trust stays short of Zoom and Teams: there is no waiting room, and the card does not hold the recording until the other people have answered. FaceTime is still ahead on how little chrome a personal call shows. The dock tucks on a meeting, and Fit leaves with it (Q35). The room bar, the mute line, and the status chip stay. The lobby stays at 4: one button, and the other ways in are still on the first screen. Labeled controls stay at 4. Share is on a meeting dock (Q34), and Zoom’s bar is still the reference. A Watching viewer’s dock, the raised-hands list, promote and demote, and the viewer join sentence are in Q32. The session frame records a Promote locally; a signed call-up still waits until this seat is an admin.
A recording card names who is recording, and the bar stays Recording (Q22). Trust stays short of Zoom and Teams: there is no waiting room. Someone else's recording names who records and offers Stay or Leave (Q104). FaceTime is still ahead on how little chrome a personal call shows. The dock tucks on a meeting, and Fit leaves with it (Q35). A broadcast keeps the dock and hides Fit (Q44). Broadcast chat keeps its title on one line (Q45). Broadcast help says Raise hand and Step off (Q46). Full screen on a broadcast shows the stage (Q47). The broadcast password sheet says Viewer password (Q48). Who is watching talks about the broadcast (Q49). A host alone gets Invite in the chip, and the live sentence stays (Q50). A host shares the stage from the dock (Q51). Settings on a broadcast says the stage (Q52). The Chat tip on a broadcast talks about the people watching (Q53). Settings on a broadcast is called Broadcast settings (Q54). A file pinned from broadcast chat is pinned to the broadcast (Q55). Run app and Float talk about the broadcast (Q56). A host ends the broadcast from the dock. A viewer still leaves (Q57). A broadcast recording captures the stage (Q58). A clap on a broadcast shows on the stage (Q59). Float on an empty stage says there is nothing to float yet (Q60). Viewer claps add up on the stage (Q61). A clap made as the link opens reaches the host (Q65). A host with the camera off shows as an initial or picture, a name, and Camera off on the stage (Q66). Sound on the room bar mutes the stage on this device (Q62). The room bar, the mute line, and the status chip stay. The lobby stays at 4: one button, and the other ways in are still on the first screen. Labeled controls stay at 4. Share is on a meeting dock (Q34), and Zoom’s bar is still the reference. The viewer join sentence is on the sheet (Q38). A viewer raises a hand from the dock (Q39). A promoted viewer steps off from a red dock button (Q40). On stage with the camera off, the stage says so (Q41). The room bar says Broadcast · You are on stage (Q42). The top line and the badge say On stage (Q43). The raised-hands list and promote and demote stay with the role-controls work (Q32). A viewer at the name card has no Video or Unmute (Q67). A viewer reads that they are watching, and a live host reads that they are live (Q69, Q70). The stage label is light on the dark band (Q72). The Chat icon on the dock is as large as its neighbours (Q73). The clap pill names who clapped (Q74). A viewer's line names who is live (Q75). The lobby preview says you join muted with the camera off (Q76). Escape closes the chat (Q77). The chat's close and attach buttons have names (Q78). Tab stops only on controls you can see (Q79). Tab reaches the room bar before the dock (Q80). ? lists the keyboard shortcuts (Q81). C, R and H open Chat, Reactions and raise a hand (Q82). The raised-hands line is light on the dark page (Q83). The vote sheet is readable (Q84). F opens Full screen, and Escape closes it (Q85). Full screen of a camera-off host shows who it is (Q86). The card comes up when the feed arrives late (Q87). A joining viewer reads Joining the broadcast… and then Connecting to the host, not The stage is clear (Q88). The open chat sits beside the room bar and stage (Q89). The chat head keeps its buttons on one row (Q90). The chat box shows its whole placeholder (Q91). With chat off, the box still shows its whole line (Q92). The lobby card keeps its gap to the right edge (Q93). With the chat open, the dock sits in the call beside it (Q94). With the chat open, the room bar keeps each pill on one line (Q95). With the chat open on a small window, the dock fits in the call and the rest is under More (Q96). The meeting lobby says muted once, on the preview (Q97). Float in the More sheet reads like the rest of the sheet (Q99). A broadcast host has no Hand in More (Q100). The Blur row in More reads at the sheet's size (Q101). Allow screen share in More stays on one line (Q102). S opens Share (Q103). Someone else's recording offers Stay or Leave (Q104). The recording chip on a tile says meeting or broadcast (Q105). Fit sits in the header, clear of the tiles (Q106). A tile's menu opens below its Blur for all box (Q107).

## How a session was opened without a relay

`run.html#mb=1&v=<room>&av=<16+ hex>&bc=1` adds `body.meet-session` and `body.broadcast` without knocking the network. Hash-only navigations do not re-run boot; tests must load that URL as a full navigation.

---

<!-- release/0.9.23: the desktop Meet quirks from cursor/qa-meet-desktop follows the Broadcast one above. -->

# Desktop Meet UI quirks

---

<!-- release/0.9.23: the phone Meet quirks from cursor/qa-meet-mobile follows. -->

# Meet mobile quirks

Branch `cursor/qa-meet-mobile`, measured against `run.html` on release/0.9.23.
Playwright Chromium, touch, fake camera/mic. Devices: iPhone SE (320×568 and landscape), iPhone 15, Pixel 7, a 360×740 Android phone, portrait and landscape.

Shots from the first pass live in `qa/mobile/shots/before-*.png`. The probe that produced the numbers is re-runnable with `NODE_PATH=/tmp/qa-pw/node_modules node qa/mobile/audit.js` while `python3 -m http.server 8765` serves the repo. `qa/mobile/audit.js` is the persona walk; the geometry numbers below were confirmed with a second pass over the same page.

Gallery packing, the self-view/stage placement, and the reactions icon are left alone. Other people own those.

## Fixed

### 1. Hang up is off the screen on a narrow phone

iPhone SE portrait and the 360px Android phone. The dock is `flex-wrap: nowrap` with a max width, and the buttons refuse to shrink (`min-width: 56px`, leave `64px`). The bar's scroll width was 366px. On the SE the bar was only 304px wide, so Hang up started at x=310 and ended at x=374, past the 320px edge. On the 360px phone it ended at x=374. The drag grip was 22×48.

Repro: `test/mobile/dock-fits.js`. It failed with `leavebtn off screen (right 374)` and `bargrip is 22x48` on both phones, then passed after the fix: grip and the round controls are 44px, Hang up is 52×52, all inside the viewport. Below 380px the row tightens. The icon artwork is unchanged. iPhone 15 and Pixel 7 stay on the larger row, which already fit.

Before: `qa/mobile/shots/before-grandparent-call.png`. After: `qa/mobile/shots/after-dock-iphone-se.png`, `qa/mobile/shots/after-dock-android-360.png`.

Fit was 59×32 then. It is 44px now (quirk 8).

### 2. Landscape More sheet hangs off the top and does not scroll

iPhone SE landscape (568×320). The sheet was `bottom: 102px`, about 398px tall, `overflow-y: visible`. Its top was at y=-194. Blur, Who, Float, Invite, Run app, Share screen, and Password were entirely above the screen. Same failure on iPhone 15, Pixel 7, and 360px landscape: Invite sat above the screen.

Repro: `test/mobile/more-sheet-fits.js`. It failed (`sheet top -194`, `overflow-y visible`, Password and Invite not reachable), then passed. The sheet is capped with `max-height: calc(100dvh - 160px)` and `overflow-y: auto`, so those controls scroll into the screen. Wide landscape uses a taller dock offset, which is why 160px rather than the narrow-phone gap.

Before: `qa/mobile/shots/before-host-more-land.png`. After: `qa/mobile/shots/after-more-iphone-se-land.png` (scrolled to Password).

### 3. Chat composer sits under the dock

iPhone SE portrait. Chat was a full-width panel (`z-index: 30`) pinned to `bottom: 0`. The dock is `z-index: 32` and covered y=466–554. The message field occupied y=526–560. Playwright's tap on `#chat-in` timed out: "div.bar intercepts pointer events". Send was 34px tall. Close was 23px. Attach was 41×34. The More sheet stayed open over the panel. `--kb` was ignored.

Repro: `test/mobile/chat-above-dock.js`. It failed on the tap, the sizes, the open sheet, and a 240px keyboard. It passes now. Opening chat folds More. The panel ends at `--dockh` (measured from the top of the dock) plus `--kb` from `visualViewport`. Close, attach, the field, and Send are at least 44px. On the SE the field bottom is y=474 and the dock starts at y=482.

Before: `qa/mobile/shots/before-chat-dock.png`. After: `qa/mobile/shots/after-chat-keyboard.png` (keyboard band set to 240px).

### 4. Lobby hides Join on a small phone

Cold open, no room in the link. The preview took `minmax(140px, 1.15fr)`.

- iPhone SE portrait: preview was 304px. Join a link sat at y=579–661, below the 568px screen.
- iPhone SE landscape: Start was already below y=320.
- 360×740 portrait: the three actions fit. Change-name scrolls into the card.

Repro: `test/mobile/lobby-join-visible.js`. It failed (`lob-join-btn` bottom 661, landscape `lob-open` bottom 325), then passed. Under 640px tall the preview is at most 16vh. Under 430px tall the preview hides so the actions fill the screen, and Join scrolls into the card.

Before: the cold lobby was not shot in the first pass. After: `qa/mobile/shots/after-lobby-iphone-se.png`, `qa/mobile/shots/after-lobby-iphone-se-land.png`.

### 5. 200% text size does not enlarge the controls

`gifos_ui_scale=2` sets the root to 32px. More-sheet labels stayed `font-size: 16px` (`#ccbtn` measured 16px on both an SE and a 360px phone).

Repro: `test/mobile/text-scale-controls.js`. It failed (`ccbtn font 16px` and the same for Password, Record, Help, Stage), then passed. Those labels, the blur segments, and the Blur caption are `1rem`, so at 200% they are 32px. The sheet still scrolls them on screen, and Hang up stays on screen.

Before: `qa/mobile/shots/before-lowvision-more.png`. After: `qa/mobile/shots/after-text-scale-more.png`.

### 7. Words a volunteer will not know

The captions control said "CC". The people list said "Who". The first probe read those strings on every phone.

Repro: `test/mobile/plain-words.js`. It requires the visible words Captions and People, each at least 44px. It passes. The ids are unchanged (`#ccbtn`, `#whobtn`). "Captions" still fits the landscape sheet (`more-sheet-fits.js`) and still grows at 200% (`text-scale-controls.js`).

### 6. No safe-area insets

The viewport meta was `width=device-width, initial-scale=1.0, interactive-widget=resizes-content`. The dock used `bottom: 14px` and the name chip `top: 14px`. With a 47px notch and a 34px home indicator (Chrome safe-area override), the chip sat at y=14 and the dock ended at y=645 on a 659px iPhone 15, 20px onto the indicator. Landscape put the dock on the bottom edge too.

Repro: `test/mobile/safe-area.js`. It failed on the meta, the chip, the dock, and hang up, then passed. The meta is `viewport-fit=cover`. Chip, Fit, dock, More sheet, and the reaction tray use `env(safe-area-inset-*)`. On that iPhone 15 the chip is at y=61 and the dock ends at y=611, above the indicator line at 625.

After: `qa/mobile/shots/after-safe-area-iphone-15.png`.

### 8. Fit is a 32px target

`#fitbtn` was `min-height: 32px` and `font: 700 14px`. On an SE and a 360px phone it measured 59×32, and at 200% text the label stayed 14px. Tapping it switches the label to Scroll, which is wider, so both words have to clear the name chip.

Repro: `test/mobile/fit-target.js`. It failed (`Fit is 59x32`, and `Fit font 14px at 200%`), then passed. The control is at least 44×44, `font-size: 1rem`, on screen, and it does not cover the name chip or the dock in either word. At 200% the label is 32px.

Before: `qa/mobile/shots/before-fit-iphone-se.png`. After: `qa/mobile/shots/after-fit-iphone-se.png`.

### 9. Header says "Just you" while other people are on screen

The chip used the long sentence `Just you — send the invite; the link has no expiry · reconnecting to the room…`. On an iPhone 15 that line is cut to `Just you — s…`. The four faces in the first shots were cloned tiles, not peers, so the count stayed 1. A cloned tile is not someone in the room.

Repro: `test/mobile/header-count.js`. It failed (`header "Just you — send the invite…"`, `clipped`, count 1, four names on screen), then passed. The header reads the real peer tiles and says `4 in call`, and that phrase fits in the chip. The longer sentence stays on the tooltip. QA seeding goes through `__gifosVideo.presentPeers`, the same peer records the grid uses.

Before: `qa/mobile/shots/before-header-count.png`. After: `qa/mobile/shots/after-header-count.png`.

### 10. Join step ignored the system name and picture

A stored GifOS name skipped the join step. A first visit showed an empty field and seeded `Guest NNNN` behind the user's back. Continue and Not now were the same purple, with no gap. The lobby said "You'll join as … · change" in small type and never showed the system picture.

Repro: `test/mobile/appear-preview.js`. It failed (no "This is how you'll appear", no picture, empty field, join skipped when a name was already stored), then passed. The field opens with the system name, or `Guest NNNN` on a first visit. The system picture is in the preview. Continue is blue. Not now is white with a gray border, 12px away, and both are at least 44px. Not now keeps the stored name. On the lobby the same preview sits on the camera so Start, the admin action, and Join stay on screen.

Before: `qa/mobile/shots/before-appear-lobby.png`, `qa/mobile/shots/before-appear-name.png`. After: `qa/mobile/shots/after-appear-lobby.png`, `qa/mobile/shots/after-appear-name.png`.

### 11. The dock covered the bottom row of faces

On an iPhone 15 with four people, David and Sam's tiles ran to y=659 while the dock started at y=557. The same overlap was on an SE (tiles to 568, dock at 482) and a 360×740 phone (Sam to 740, dock at 654). The content box was `vh - top`. The packer was not the problem; it filled the box it was given, and that box ran under the controls.

Repro: `test/mobile/dock-clears-faces.js`. It failed with those bottoms, then passed. `viewBox` now takes a measured bottom inset (`innerHeight - bar.top`) and the gallery packer is unchanged. Each face ends at or above the dock and stays at least 48px tall.

Before: `qa/mobile/shots/before-dock-faces-iphone-15.png`. After: `qa/mobile/shots/after-dock-faces-iphone-15.png`.

### 12. The drag grip was 22×48 on a normal phone

The 44px grip rule only applied under 380px. A later `.bar #bargrip` rule set 22×48, so an iPhone 15 and a Pixel 7 both measured 22×48. The mark was also `#8d93a0` on white.

Repro: `test/mobile/grip-target.js`. It failed (`bargrip is 22x48`), then passed. The grip is 44×44 on iPhone 15 and Pixel 7, the icon is `#3a3a3f` on an `#e8ecf1` plate, and Hang up stays inside the screen. Below 393px the row gap tightens so the wider grip does not push Hang up off.

Before: `qa/mobile/shots/before-grip-iphone-15.png`. After: `qa/mobile/shots/after-grip-iphone-15.png`.

### 13. No waiting-room admit list

A host could set a password, record, and step on stage. There was no list of people at the door, and no Admit control. That is the job Zoom and a church volunteer panel both put on the phone.

Repro: `test/mobile/wait-list.js`. It failed (`no Waiting room button`) on an iPhone 15 and an SE in landscape, then passed. Waiting room is off until the host turns it on, so a dark return still answers the door. When it is on, Ruth and David show above the dock. Admit is blue, Not now is white with a gray border, both at least 44px, 8px apart. Admit removes Ruth and asks the existing door answer to let her in. Not now removes David and hides the list when it is empty. The mesh admission protocol is unchanged.

Before: `qa/mobile/shots/before-wait-iphone-15.png`. After: `qa/mobile/shots/after-wait-iphone-15.png`.

### 14. More said Password, Vote, and Stage

Those three words do not say what a host is about to do. Password could be an account. Vote could be a poll. Stage could be a view. The longer meaning lived only on the button title, which a phone does not show.

Repro: `test/mobile/host-words.js`. It failed (`Password`, `Vote`, `Stage`, and `Step down` once you were on stage) on an iPhone 15, an SE, and a 360px phone at 200% text, then passed. The controls say Room password, Vote on someone, and Step on stage. On stage, the same button says Step off stage. The phone sheet is two columns so the phrases fit inside the button, including at 32px type. Each control stays at least 44px and scrolls into view.

Before: `qa/mobile/shots/before-host-words-iphone-15.png`. After: `qa/mobile/shots/after-host-words-iphone-15.png`.

### 15. Landscape More hid Invite and Room password

On an SE held sideways the sheet is 160px tall. Blur took the first row, then People and Float, so Invite ended at y=236 while the sheet ended at y=204. Room password, Waiting room, and Chat were further down. An iPhone 15 showed Invite and still cut off Room password. A 740px-wide landscape phone uses four columns and still clipped Room password by a few pixels.

Repro: `test/mobile/landscape-first.js`. It failed with those bottoms, then passed. Invite, Room password, Waiting room, and Chat are the first four controls, so they sit on the first screen with no scroll on an SE, an iPhone 15, and a 360×740 phone in landscape. Blur, People, and Record follow, and the sheet still scrolls to them.

Before: `qa/mobile/shots/before-landscape-first-se.png`. After: `qa/mobile/shots/after-landscape-first-se.png`.

### 16. Record and Captions lived only inside More

A producer could not see that the call was live, or that someone was recording, without opening More. The tile chip said "recording this meeting" in small type on the face. StreamYard, Restream, and YouTube keep a live and record state on the call itself.

Repro: `test/mobile/call-state.js`. It failed (`no live/record state on the call`) on an iPhone 15, an SE, and a 360px phone at 200% text, then passed. Live, Record, and Captions sit above the dock. Live is red with white type. Record stays quiet until it is on, then it says Recording in the same red. Captions turns blue, so it is not the same mark as Live. Each is at least 44px, the words fit at 32px type, and they do not cover the header or the dock. Tapping Captions turns captions on. Tapping Record opens the record sheet. The faces still end above that row. The More buttons are still there.

Before: `qa/mobile/shots/before-call-state-iphone-15.png`. After: `qa/mobile/shots/after-call-state-iphone-15.png`.

### 17. Landscape lobby hid Join

On an SE held sideways the card is 320px tall. Start a meeting and Start a room you run fit. Join a link started at y=311 and ended at y=378, so almost the whole button was below the screen. You could scroll to it. A grandparent who turned the phone did not see the thing the text told them to tap.

Repro: `test/mobile/lobby-join-visible.js`. It failed (`lob-join-btn off screen (bottom 378)`), then passed. In that short landscape the three actions sit in one row. Start stays the only blue button. Join is on screen, at least 44px, and the explanation under each label still fits. Portrait is unchanged.

Before: `qa/mobile/shots/before-lobby-join-land.png`. After: `qa/mobile/shots/after-lobby-iphone-se-land.png`.

### 18. Unread chat is only a label inside More

An incoming line did `Chat (2)` on the More button. With the sheet closed, the call showed no count. The live row also sat on top of the message field (both y=430–474 on an SE), so a tap on the field hit Live.

Repro: `test/mobile/chat-badge.js`. It failed (`no on-call unread count`) on an iPhone 15, an SE, and a 360px phone at 200% text, then passed. The count is a blue pill above Live, at least 44px, and the number grows with the text size. It does not cover the header, Fit, Live, or the dock. Tapping it opens chat and clears the count. More still says Chat. The open chat sheet paints over the live row, so the field takes the tap again (`chat-above-dock.js`).

Before: `qa/mobile/shots/before-chat-badge-iphone-15.png`. After: `qa/mobile/shots/after-chat-badge-iphone-15.png`.

### 19. A new line did not show what was said

The count arrived on the call, and the words stayed inside chat. With the sheet closed you could see "2" and not the sentence.

Repro: `test/mobile/chat-preview.js`. It failed (`no message preview`), then passed on an iPhone 15, an SE, and a 360px phone at 200% text. The latest line sits in a white banner beside the count, above Live. The sender and the text are 1rem, dark on white. Tapping the banner opens chat and clears both. Four faces end above the banner.

Before: `qa/mobile/shots/before-chat-preview-iphone-15.png`. After: `qa/mobile/shots/after-chat-preview-iphone-15.png`.

### 20. No emoji control on the phone composer

The field had attach and Send. A phone in this test has no system emoji keyboard, so there was no way to drop in a 👍 or a 🙏.

Repro: `test/mobile/chat-emoji.js`. It failed (`no emoji control`), then passed on an iPhone 15, an SE, and a 360px phone at 200% text. Emoji opens a row of 44px characters above the field. Tapping 👍 writes it into the field and does not send. The row stays above the dock.

Before: `qa/mobile/shots/before-chat-emoji-iphone-15.png`. After: `qa/mobile/shots/after-chat-emoji-iphone-15.png`.

### 21. Send slid off the screen beside Emoji

The field refuses to shrink below its placeholder, so adding the emoji button pushed Send to x=382 on an SE (the screen is 320) and to x=435 on an iPhone 15.

Repro: `test/mobile/chat-above-dock.js` now requires Send on screen. It failed (`send off screen (right 382)`), then passed. The field may shrink. Send stays inside the screen.

### 22. Chat bubbles were small, dark, and the same color

Body type was .85rem (13.6px). The name was .7rem in #7b9cff, contrast 2.61 on the bubble. Mine and theirs both used the surface color, so your line did not read as yours. A long line used 94% of the sheet.

Repro: `test/mobile/chat-bubbles.js`. It failed on the font, the name contrast, the shared color, and the long bubble width, then passed on an iPhone 15, an SE, and a 360px phone at 200% text. Theirs is a light bubble with dark type. Mine is blue with white type. The name is 1rem. A long line wraps inside 78% of the sheet.

Before: `qa/mobile/shots/before-chat-bubbles-iphone-15.png`. After: `qa/mobile/shots/after-chat-bubbles-iphone-15.png`.

### 23. The keyboard was added on top of the dock

`--kb` came from the visible viewport, and the sheet inset was the dock plus that band. On a sideways SE the two together left almost no sheet, and focusing the field scrolled Close off the top. The field type was still .85rem.

Repro: `test/mobile/chat-keyboard.js`. It failed (inset 0, field under the keyboard line, Close off screen in landscape), then passed. The sheet ends at the larger of the dock and the keyboard. Landscape hides the file list so the field and Close stay on screen. The field is 1rem.

Before: `qa/mobile/shots/before-chat-keyboard-land.png`. After: `qa/mobile/shots/after-chat-keyboard-land.png`.

### 24. Four faces squeezed into a short bottom row

On an iPhone 15 the grid was 1, 1, 2. Pat and Ruth were 389×176 strips. David and Sam were 195×88. On an SE the bottom pair was 158×73. Every tile was about 2.2 times as wide as it was tall.

Repro: `test/mobile/see-everyone.js`. It failed (`David is 195x88`, `3 rows`), then passed. On a phone a tile may not be a wide squash. Four people are two rows of two, each tile taller than 140px on an iPhone 15 and 120px on an SE, and the shape stays between a portrait phone and a square. Desktop packing is unchanged.

Before: `qa/mobile/shots/before-see-everyone-iphone-15.png`. After: `qa/mobile/shots/after-see-everyone-iphone-15.png`.

### 25. Fit sat on a face, and the build tag looked like a button

Fit was at y=58–102 while the top-right tile started at y=64, so it covered the corner of that face. The build name was a solid dark pill in the same corner.

Repro: `test/mobile/call-calm.js`. It failed (`Fit covers a face`, `build tag looks like a button`), then passed. Faces start below Fit. The build name is a faint line under the header, with no fill. Fit still clears the header and stays 44px.

Before: `qa/mobile/shots/before-call-calm-iphone-15.png`. After: `qa/mobile/shots/after-call-calm-iphone-15.png`.

### 26. Live, Record, Captions, and the dock stay on the call

On an iPhone 15 the dock and the Live row stayed up for the whole call, covering the bottom of the faces. FaceTime tucks those controls until you tap.

Repro: `test/mobile/chrome-idle.js`. It failed (`chrome stays up when idle`), then passed on an iPhone 15 and an SE. The controls start on screen. After the quiet moment, Hang up does not take a tap, the faces grow into that band, and a tap brings Live, Record, Captions, and Hang up back at 44px. More, chat, the reaction tray, the waiting list, and a dialog hold the controls up. This is separate from the camera idle timer.

Before: `qa/mobile/shots/before-chrome-idle-iphone-15.png`. After: `qa/mobile/shots/after-chrome-idle-iphone-15.png`, `qa/mobile/shots/after-chrome-back-iphone-15.png`.

### 27. More covers the call with a wall of equal buttons

On an iPhone 15, More was 13 buttons from y=44, over the name and the faces. Invite was the same gray as Room password. An SE showed 12.

Repro: `test/mobile/more-calm.js`. It failed (`13 buttons on the first screen`, sheet top 44), then passed on an iPhone 15 and an SE. The first screen is Invite, Room password, Waiting room, and Chat. Invite is the blue one. The rest scroll. The name stays clear.

Before: `qa/mobile/shots/before-more-calm-iphone-15.png`. After: `qa/mobile/shots/after-more-calm-iphone-15.png`.

### 28. Blur for all is a small tab on the tile corner

On a phone and on the desktop the per-tile control was 83×32, flush with the top-right corner (`top: 0; right: 0`). A tap meant for the video hit it.

Repro: `test/mobile/blur-tile.js`. It passes on an iPhone 15, an SE, and a 1280×800 desktop. The button is a 64px square, 12px in from the corner, over the video. The name, full screen, and the tile menu stay at least 12px away. The label is still "Blur for all".

Before: `qa/mobile/shots/before-blur-tile-iphone-15.png`, `qa/mobile/shots/before-blur-tile-desktop.png`. After: `qa/mobile/shots/after-blur-tile-iphone-15.png`, `qa/mobile/shots/after-blur-tile-desktop.png`.

### 29. The join step said Not now and Continue

Not now closed the step and kept the name. Continue was the word for keeping it. Neither said what happened to the picture.

Repro: `test/mobile/appear-preview.js`. The buttons say Clear and Save. Save is the solid blue one and Clear is the outline. Save leaves the stored name and picture. Clear removes both and closes the step.

Before: `qa/mobile/shots/before-join-clear-iphone-se.png`. After: `qa/mobile/shots/after-join-save-iphone-se.png`.

### 30. A sideways phone squashed every face into a strip

Four people on an iPhone SE held sideways were one row of 141×46 tiles (aspect 3.07). On an iPhone 15 sideways the bottom pair was 130×60 (aspect 2.19). The content box was only as tall as the gap between Fit and Live, and a wide phone was packed with the desktop shape limit.

Fit now shares the name-chip row on a short landscape phone, so the faces start higher. A landscape phone that cannot hold a legal tile by stretching the grid keeps every tile inside the portrait-phone shape (short side at least 96, aspect at most 1.05) and centers that row. A further row grows downward and the feed scrolls. Portrait phones stay two rows of two. Desktop 1280×800 packing is unchanged. `test/mobile/sideways-tiles.js`.

Before: `qa/mobile/shots/before-sideways-tiles-iphone-se.png`, `qa/mobile/shots/before-sideways-tiles-iphone-15.png`. After: `qa/mobile/shots/after-sideways-tiles-iphone-se.png`, `qa/mobile/shots/after-sideways-tiles-iphone-15.png`.

### 31. At 200% text the lobby hid Join

On an iPhone SE with the text size at 200%, Join a link ended at y=986 on a 568px screen. The admin action ended at 772. Sideways, all three actions ended at 539 on a 320px screen. The essay under each button was the height.

Repro: `test/mobile/lobby-large-text.js`. On a phone the essay is hidden and the padding stays 10px, so the title can grow and Start, the room you run, and Join stay on screen. Start stays the only blue button. A wide screen still shows the essay.

Before: `qa/mobile/shots/before-lobby-200-iphone-se-200.png`, `qa/mobile/shots/before-lobby-200-iphone-se-land-200.png`. After: `qa/mobile/shots/after-lobby-200-iphone-se-200.png`, `qa/mobile/shots/after-lobby-200-iphone-se-land-200.png`.

### 32. A caption line grew off the face

On an iPhone SE the line "The Lord is my shepherd…" was 283px tall on a 155px face and started at y=-42. At 200% text it was 618px tall on a 236px face and started at y=-329. The words left the screen.

Repro: `test/mobile/caption-on-tile.js`. The line is anchored to the bottom of the face, capped at 42% of the tile, and stays 1.25rem so it is 40px at 200% text.

Before: `qa/mobile/shots/before-caption-tile-iphone-se-200.png`. After: `qa/mobile/shots/after-caption-tile-iphone-se-200.png`.

### 33. Start recording sat below the fold

On an iPhone SE, Start recording ended at y=758 on a 568px screen. Sideways it ended at 603 on a 320px screen. At 200% text it ended at 1865. The button was the same color as Cancel, at 13px.

Repro: `test/mobile/record-start.js`. The sheet says what will be recorded, in one sentence. Start recording is the blue button and stays on screen. Cancel is the outline. The other choices scroll above those buttons. On a phone the essays under the choices are hidden.

Before: `qa/mobile/shots/before-record-start-iphone-se.png`. After: `qa/mobile/shots/after-record-start-iphone-se.png`.

### 34. At 200% text three of four faces left the screen

On an iPhone SE and an iPhone 15 with the text size at 200%, Live and the dock left a short box. The packer made one column of large tiles. Ruth, David, and Sam started under Live and continued off the screen.

Repro: `test/mobile/large-text-faces.js`. When every face can sit in the box at a portrait-phone shape, they do, above Live. A sideways phone that only has room for one row still uses that row.

Before: `qa/mobile/shots/before-large-text-faces-iphone-se.png`. After: `qa/mobile/shots/after-large-text-faces-iphone-se.png`.

### 35. A long caption was cut off on the face

The line sat in the bottom 42% of one tile with the overflow hidden. On a phone the rest of the sentence could not be read. At 200% text the same line had previously grown off the top of the screen.

Repro: `test/mobile/caption-read.js`. The caption is one block above Live, white on black, at 1.25rem. It shows the start of the line. When the line is longer than the block, the rest scrolls inside it. It does not cover Live or the dock.

Before: `qa/mobile/shots/before-caption-read-iphone-se-200.png`. After: `qa/mobile/shots/after-caption-read-iphone-se-200.png`.

### 36. A texted link joins muted with no word for it

The lobby says you join muted. A link skips that page. The mic is a slashed icon and the dock has no words, so a first call looks broken.

Repro: `test/mobile/join-unmute.js`. It failed (`no Unmute a person can read` on an SE, at 200% text, and sideways), then passed. Unmute is blue, 44px, and 1rem. It sits in the header band, clear of the faces and of Fit. A tap turns the mic on and the button goes away. It stays when Live and the dock tuck.

Before: `qa/mobile/shots/before-join-unmute-iphone-se.png`. After: `qa/mobile/shots/after-join-unmute-iphone-se.png`.

### 37. Live was a small chip beside Record and Captions

On a phone Live was 72×44. More is 56px on an iPhone 15. From a stand, a volunteer could not see that the room was on.

Repro: `test/mobile/live-stands-out.js`. It failed (SE Live 44px tall and 72px wide; sideways Live 72px wide), then passed. Upright, Live is its own band, 64px tall and the width of the row. Record and Captions share the next row. Sideways, Live takes the rest of the one row, so the faces keep their height. The word stays Live. At 200% text the band stays full width without growing the row past the faces.

Before: `qa/mobile/shots/before-live-stands-out-iphone-se.png`, `qa/mobile/shots/before-live-stands-out-iphone-se-land.png`. After: `qa/mobile/shots/after-live-stands-out-iphone-se.png`, `qa/mobile/shots/after-live-stands-out-iphone-se-land.png`.

### 38. The header counted people and never named the room

A manager between meetings read "4 in call" or "Just you". The room id was only in the link.

Repro: `test/mobile/header-count.js`. It failed (`header "4 in call"`), then passed. Four peers read `header-count · 4 in call`, and the phrase fits on an SE and an iPhone 15 without covering Fit. On a sideways phone the chip stops short of Unmute.

Before: `qa/mobile/shots/before-room-name-iphone-15.png`. After: `qa/mobile/shots/after-room-name-iphone-15.png`.

### 39. The lobby's admin button looked like the way to start

"Start a meeting" and "Start a room you run" both began with Start. At 200% text the admin label wrapped until that button was 102px and the blue Start was 62px. A volunteer would tap the bigger one.

Repro: `test/mobile/lobby-which-start.js`. It failed, then passed on an SE, at 200% text, and sideways. The admin button says Room you run. It is not blue, and it is not taller than Start a meeting. Join a link stays on screen.

Before: `qa/mobile/shots/before-lobby-which-start-iphone-se.png`, `qa/mobile/shots/before-lobby-which-start-iphone-se-200.png`. After: `qa/mobile/shots/after-lobby-which-start-iphone-se.png`, `qa/mobile/shots/after-lobby-which-start-iphone-se-200.png`.

### 40. The camera is off and nothing says so

A texted link joins with the camera off. The self view is a letter. The dock camera is a slash with no words, so a first call looks like the face is broken. The picture stays on the video feed. There is no second avatar layer.

Repro: `test/mobile/camera-words.js`. It failed (`no Camera a person can read`), then passed on an SE, at 200% text, and sideways. Unmute is the word while the mic is off. After that, the same slot says Camera until the camera is on. A tap turns it on. The button stays when the dock tucks, and it does not cover a face.

Before: `qa/mobile/shots/before-camera-words-iphone-se.png`. After: `qa/mobile/shots/after-camera-words-iphone-se.png`.

### 41. Alone, the header told you to send the invite

The chip said "sunday · Just you". The tooltip was "Just you — send the invite; the link has no expiry". That is a sentence, not a control.

Repro: `test/mobile/header-invite.js`. On a phone, alone, the header is the room name and an Invite button. The button is at least 44px, the word grows at 200%, and it stays inside the chip without covering Fit, Unmute, or Camera. A phone with a share sheet gets that sheet and the meeting link. Otherwise the link is copied. With other people here the button is gone and the header is "sunday · 4 in call". Wide screens keep the sentence. `.topchip[data-invite="1"]` and `__gifosVideo.shareInvite` are the hook for the desktop header.

Before: `qa/mobile/shots/before-header-invite-iphone-se.png`. After: `qa/mobile/shots/after-header-invite-iphone-se.png`.

### 42. No blur snapped back to Min, then started on its own after a minute

In a password meeting the header said "You are ready for clear video…" and Min stayed selected. The tap landed on No blur. The button was not disabled. The choice was saved as 0. The segment then painted the feed level, and the room rule keeps that feed at Min until everyone is ready, so the control jumped back to Min.

Repro: `test/mobile/blur-none.js`. It failed (`No blur did not stay selected (min true, none false)`, feed blur 1, header "You are ready for clear video — it shows when everyone here is (camera on, No blur: 1 of 2)."), then passed. The choice stays on No blur. The feed stays Min until the room is ready. Gate: `NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/blur-none.js`.

Before: `qa/mobile/shots/before-blur-none-pixel-7.png`. After: `qa/mobile/shots/after-blur-none-pixel-7.png`.

About a minute later the same tap started working with no second press. There is no segmentation-model fetch on this path. Blur is the canvas pipe. The minute is `HOLDOVER_MS` (60s): an away or still-connected peer who has not consented stays in the roster, so the feed stays at Min while the header already says you are ready. When that status ages out, the peer drops and clear video starts on its own. The control shows the choice the whole time. It does not wait for that minute.

Repro: `test/mobile/blur-none-delay.js`. Gate: `NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/blur-none-delay.js`.

### 43. No blur stayed off Min while the camera was off

The header said "No blur picked — turn your camera on to be ready for clear video." The segmented control did not. The wish was 0 and the feed stayed at Min, because clear video needs the camera. A white ring on No blur did not read as the selected choice, and this case never clears after a minute. The filled segment is the choice. The header says why the picture is still blurred.

Repro: `test/mobile/blur-none-cam.js`. It failed (`No blur is not the selected segment (wait true)`, fill white), then passed. Min is not selected. No blur is the black selected segment. The feed stays Min. Gate: `NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/blur-none-cam.js`.

Before: `qa/mobile/shots/before-blur-cam-pixel-7-seg.png`. After: `qa/mobile/shots/after-blur-cam-pixel-7-seg.png`.

### 44. A bot was a tiny square

Four people were in the header. The notes bot was a 72×72 stamp on the bottom right, on top of another face, so the room looked like three. A bot is packed with everyone else. The bot badge stays on the tile.

Repro: `test/mobile/bot-tile.js`. It failed (`bot tile 72x72 beside 136; bot covers guest-3106`), then passed. Blur for all stays in the corner of that full tile and does not cover the bot badge. Gate: `NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/bot-tile.js`.

Before: `qa/mobile/shots/before-bot-tile-pixel-7.png`. After: `qa/mobile/shots/after-bot-tile-pixel-7.png`.

### 45. Captions on was a faint green

In More, Captions selected was light green text on the gray button. The on-call Captions toggle is already blue with white text. The More button uses that same on state.

Repro: `test/mobile/cc-on.js`. It failed (fill `rgb(232, 236, 241)`, word `rgb(156, 255, 180)`), then passed. Gate: `NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/cc-on.js`.

Before: `qa/mobile/shots/before-cc-on-pixel-7.png`. After: `qa/mobile/shots/after-cc-on-pixel-7.png`.

### 46. Landscape More covered the header

On a sideways phone wider than 700px the sheet skipped the short phone cap and started at y=24, over the header. It now stops under the header and above the dock, and the rest of the rows scroll inside that band.

Repro: `test/mobile/more-land.js`. It failed (`sheet covers the header (top 24, chip 58)`), then passed. Gate: `NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/more-land.js`.

Before: `qa/mobile/shots/before-more-land-pixel-7.png`. After: `qa/mobile/shots/after-more-land-pixel-7.png`.

### 47. The header cut the message off

"No blur picked — turn your camera on…" and "4 in the meeting · 180p …" were one ellipsized line. A phone does not show the title tooltip. Tapping the line opens the whole message. The GifOS name stays the link home.

Repro: `test/mobile/header-full.js`. It failed (`no full-message sheet`, and the line was truncated), then passed. Gate: `NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/header-full.js`.

Before: `qa/mobile/shots/before-header-full-pixel-7.png`. After: `qa/mobile/shots/after-header-full-pixel-7.png`.

Guest 3106 showing stepped away is the away chip: the peer has been away for 25 seconds (screen off or another app). The mark in this build is "⏾ stepped away".

### 48. Captions are personal. The meeting is always transcribed.

Each browser writes its own voice while it is unmuted (`ownVoiceWanted` in `run.html`). That does not depend on CC. CC (`ccView`) only shows or hides captions on this screen, and it is not gossiped. Tiles do not say who is transcribing. Transcript is in More from the start, and Download transcript is on that panel. The same rule is in the shared meeting page, so desktop uses it too.

Repro: `test/mobile/captions-room.js`. It failed (CC on because a bot had `cc`, bot tile "📝 Captions", a line shown with CC off), then passed. Gate: `NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/captions-room.js`. Selected CC stays blue with white text (`test/mobile/cc-on.js`).

Before: `qa/mobile/shots/before-captions-room-pixel-7.png`. After: `qa/mobile/shots/after-captions-room-pixel-7.png`.

### 49. LIVE was on a regular meeting

`docs/meeting.md` is cited from `run.html` and is not in this repository, on `main` or on `release/0.9.23`. Nothing there says a meeting shows a LIVE pill. The Broadcast skin is the place a host is live on the Stage (`run.html`, the Broadcast comment above `BC_INTENT`). `#call-live` was always on during a Meet. It was not the recording button and not the transcription state.

A regular meeting hides it. Record and Captions stay. Broadcast still shows Live.

Repro: `test/mobile/live-meet.js`. It failed (`Broadcast did not open` on the first load, then the Meet half already had LIVE hidden), then passed. Gate: `NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/live-meet.js`.

Before: `qa/mobile/shots/before-live-meet-iphone-se.png`. After: `qa/mobile/shots/after-live-meet-iphone-se.png`.

### 50. People opened on internet addresses

Zoom, Meet, Teams, and FaceTime open a list of names. Ours opened "Who is on this meeting" and led with a paragraph about internet addresses, then "address unknown" beside each name at 12.8px.

The sheet is People. Each row is the name, plus Muted or Camera off. The address file stays on Download.

Repro: `test/mobile/people-list.js`. It failed (`title "Who is on this meeting"`, Ruth 12.8px, `Ruth address unknown`), then passed. Gate: `NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/people-list.js`.

Before: `qa/mobile/shots/before-people-list-iphone-se.png`. After: `qa/mobile/shots/after-people-list-iphone-se.png`.

### 51. A chat line had no clock

Zoom, Meet, Teams, and FaceTime put a time on the bubble. Ours showed the name and the words and nothing about when the line was sent.

Each line now shows the hour and minute beside the name, in the same ink as the bubble. A line sent at 14:41 UTC reads 10:41 AM on a phone set to New York.

Repro: `test/mobile/chat-time.js`. It failed (`no clock time on Ruth`), then passed. Gate: `NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/chat-time.js`. `test/mobile/chat-bubbles.js` still passes.

Before: `qa/mobile/shots/before-chat-time-iphone-se.png`. After: `qa/mobile/shots/after-chat-time-iphone-se.png`.

### 52. An empty file list sat under the messages

The chat sheet always showed "Files pinned to this meeting", including when nothing was pinned. On an iPhone SE that block left the log at 278px and a 79px gap above the field. Attach already says files need a room password.

The list stays hidden until a file is pinned. The paperclip stays. Unpinning the last file hides the list again.

Repro: `test/mobile/chat-files.js`. It failed (`empty files tray is showing`), then passed. Gate: `NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/chat-files.js`.

Before: `qa/mobile/shots/before-chat-files-iphone-se.png`. After: `qa/mobile/shots/after-chat-files-iphone-se.png`.

### 53. Someone else's line matched the sheet

On the light theme the chat page and the other person's bubble were both `#e8ecf1`. The line had no edge. Mine, in blue, was the only bubble you could see.

A phone chat is a white page. The gray bubble and the blue one stay, so both lines have an edge.

Repro: `test/mobile/chat-sheet.js`. It failed (`Ruth's bubble matches the sheet`), then passed on an iPhone SE and a sideways iPhone 15. Gate: `NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/chat-sheet.js`.

Before: `qa/mobile/shots/before-chat-sheet-iphone-se.png`. After: `qa/mobile/shots/after-chat-sheet-iphone-se.png`.

### 54. Send was the same white as the page

On the white chat sheet, Send and the paperclip were both white. The word Send was there, and the control had no edge.

Send is the blue button, white type, 44px. The paperclip and emoji stay a gray key.

Repro: `test/mobile/chat-send.js`. It failed (`Send is rgb(255, 255, 255)`, the paperclip had no edge), then passed. Gate: `NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/chat-send.js`.

Before: `qa/mobile/shots/before-chat-send-iphone-se.png`. After: `qa/mobile/shots/after-chat-send-iphone-se.png`.

### 55. A new line had no way back down

The log already stayed put when you had scrolled up. The new line arrived below, and nothing offered to take you there. Zoom, Meet, and Teams show that control.

New messages sits under the log, blue, 44px. A tap jumps to the newest line and clears it. Scrolling to the bottom yourself clears it too.

Repro: `test/mobile/chat-new.js`. It failed (`no way back down`), then passed. Gate: `NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/chat-new.js`.

Before: `qa/mobile/shots/before-chat-new-iphone-se.png`. After: `qa/mobile/shots/after-chat-new-iphone-se.png`.

### 56. Two Unmute controls, and the dock lost its words

Nathan's live-meet shot on an iPhone SE showed a blue Unmute pill in the header and a mic on the dock with no words. Mic, Video, React, More, and Leave had been labeled earlier and then dropped.

The header pills are gone. The dock says Mic, Video, React, More, and Leave. The mic is the only unmute. Share screen and Chat stay in More, so a 320px row still fits and More's first screen is still Invite, Room password, Waiting room, and Chat. The people count on a wide window opens the roster. A phone keeps the one status line.

Repro: `test/mobile/dock-labels.js`. It failed (`mic has no label`, `header Unmute is showing`), then passed. Gate: `NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/dock-labels.js`.

Before: `qa/mobile/shots/before-dock-labels-iphone-se.png`. After: `qa/mobile/shots/after-dock-labels-iphone-se.png`. Compared with `qa/mobile/shots/after-live-meet-iphone-se.png`, the shot Nathan marked.

### 57. A long chat had no way to find one line

Twelve budget lines and one vote sat in the log. Nothing on the sheet could narrow it to Tuesday. Zoom, Meet, and Teams put a search field on the chat.

Find in chat sits under the title. Typing a word leaves the matching lines and hides the rest. The search looks through the lines this browser still holds, not only the ones already on screen. Clear restores the log. A miss says No matches. The field is 44px and stays off Send. It hides while Transcript is open.

Repro: `test/mobile/chat-find.js`. It failed (`no way to find a line`), then passed. Gate: `NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/chat-find.js`.

Before: `qa/mobile/shots/before-chat-find-iphone-se.png`. After: `qa/mobile/shots/after-chat-find-iphone-se.png`.

### 58. Typing @ did not offer the people on the call

The composer took @Ru as ordinary text. Ruth and David were on the call, and nothing offered a name. A sent mention looked like the rest of the line.

The list opens under the log while the caret is on an @name. It offers people whose names match, at 44px, and stays off Send. Choosing Ruth writes @Ruth and closes the list. On the line, that name is marked: blue on someone else's bubble, gold on yours.

Repro: `test/mobile/chat-mention.js`. It failed (`no one to mention`), then passed. Gate: `NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/chat-mention.js`.

Before: `qa/mobile/shots/before-chat-mention-iphone-se.png`. After: `qa/mobile/shots/after-chat-mention-iphone-se.png`.

### 59. A mention while chat was closed looked like any other line

Ruth wrote @Nathan the vote is Tuesday while the sheet was closed. The preview stayed a white card of the latest line. Naming David did the same thing. A later "See you Sunday" would have replaced it. Zoom, Meet, and Teams call the named person back.

The banner turns blue and says Ruth mentioned you, with the line under that. A later ordinary line leaves it there. Opening chat clears it. A mention of someone else stays the ordinary white preview. @Nathaniel does not match Nathan.

Repro: `test/mobile/chat-mention-alert.js`. It failed (`the preview does not say you were mentioned`), then passed. Gate: `NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/chat-mention-alert.js`.

Before: `qa/mobile/shots/before-chat-mention-alert-iphone-se.png`. After: `qa/mobile/shots/after-chat-mention-alert-iphone-se.png`.

### 60. Answering a line started a new message at the bottom

Ruth wrote "the vote is Tuesday." The only way to answer was a new line, so the answer and the vote did not stay together. Zoom and Teams quote the line you answer.

Reply sits on the line, at 44px, and stays off Send. The composer keeps Ruth's line until the answer is sent or Cancel is tapped. The answer shows that line in a quoted strip.

Repro: `test/mobile/chat-reply.js`. It failed (`no Reply`), then passed. Gate: `NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/chat-reply.js`.

Before: `qa/mobile/shots/before-chat-reply-iphone-se.png`. After: `qa/mobile/shots/after-chat-reply-iphone-se.png`.

### 61. The room name was a 23px tap

The header line opens the rest of the status. On an iPhone 15 it was 162×23, and the same on an SE, including sideways. The words were readable. The tap was not.

The chip is the target. The line is 44px, the phrase still fits, and a tap opens the longer status. It stays off Fit and off the faces.

Repro: `test/mobile/header-tap.js`. It failed (`room name is 162x23`), then passed. Gate: `NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/header-tap.js`.

Before: `qa/mobile/shots/before-header-tap-iphone-15.png`. After: `qa/mobile/shots/after-header-tap-iphone-15.png`.

### 62. Full screen on a face was 28×32

The corner control that opens a face was 28×32 on an iPhone 15. On an SE it also sat on David's name. A thumb misses a target that small.

The control is 44px and stays on the face. The name stops before it, so it no longer covers the person.

Repro: `test/mobile/tile-fullscreen.js`. It failed (`full screen is 28x32`), then passed. Gate: `NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/tile-fullscreen.js`.

Before: `qa/mobile/shots/before-tile-fullscreen-iphone-15.png`. After: `qa/mobile/shots/after-tile-fullscreen-iphone-15.png`.

### 63. A sideways phone cut every name

Four people on an iPhone SE held sideways sat in a row of 105px tiles. The name was capped beside Full screen, so Nathan, Ruth, David, and Sam were cut off. Blur, 64px on a 100px tile, also sat on the name.

The name takes the bottom of the tile and shows the whole name. Full screen and Blur move to the top corners at 44px, so they stay tappable and off the name. An iPhone 15 sideways keeps the whole name too.

Repro: `test/mobile/sideways-names.js`. It failed (the name was clipped, and blur covered Ruth), then passed. Gate: `NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/sideways-names.js`.

Before: `qa/mobile/shots/before-sideways-names-iphone-se.png`. After: `qa/mobile/shots/after-sideways-names-iphone-se.png`.

### 64. An address in chat was plain text

Ruth wrote "Meet us at https://example.com/park." The address was the same ink as the sentence. Nothing to tap. Zoom, Meet, Teams, and Messages make that a link.

An http or https address becomes a link. The mark is underlined, blue on someone else's line and gold on yours. A trailing period stays out of the address. javascript: stays text.

Repro: `test/mobile/chat-link.js`. It failed (`the address is not a link`), then passed. Gate: `NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/chat-link.js`.

Before: `qa/mobile/shots/before-chat-link-iphone-se.png`. After: `qa/mobile/shots/after-chat-link-iphone-se.png`.

### 65. Your own chat line could not be taken back

Nathan sent "I will be late." The line had Reply and nothing else. Ruth's line was the same. Zoom, Meet, and Teams let you remove what you sent.

Delete sits on your line, at 44px, and stays off Send. The line leaves. Ruth's line has no Delete. A delete is accepted only from the person who wrote the line. An admin's signed delete is unchanged.

Repro: `test/mobile/chat-delete.js`. It failed (`no way to take back your line`), then passed. Gate: `NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/chat-delete.js`.

Before: `qa/mobile/shots/before-chat-delete-iphone-se.png`. After: `qa/mobile/shots/after-chat-delete-iphone-se.png`.

### 66. A chat line had no reaction

Ruth wrote "the vote is Tuesday." The only answers were Reply or a new line. Zoom, Meet, and Teams let you put a 🙏 or a 👍 on a line.

React sits on someone else's line, at 44px, beside Reply. It opens 👍 ❤️ 😂 🙏 👏, each 44px. The pick stays on the line with a count, and yours is outlined. Tap it again to take it off. Your own line keeps Reply and Delete on one row. The line's buttons are their own row, so a short line does not wrap them. A reaction frame counts only from the person it names, and a newcomer gets each person's own picks when they join.

Repro: `test/mobile/chat-react.js`. It failed (`no way to react to a line`), then passed. Gate: `NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/chat-react.js`.

Before: `qa/mobile/shots/before-chat-react-iphone-se.png`. After: `qa/mobile/shots/after-chat-react-iphone-se.png`.

### 67. A sideways keyboard covered the chat field again

On an SE turned sideways, the keyboard leaves about 120px. Find in chat (64px with its border) came after the keyboard fix, and it took that band with the header. The message field and Send sat under the keys (field bottom 171, keyboard line 120).

While the keyboard is up on a short screen, Find in chat steps aside unless you are typing in it. The field and Send sit above the keys. Tap Find with the keyboard up and it stays, at 61 to 105px.

Repro: `test/mobile/chat-keyboard.js`. It failed (`field cannot be tapped; keyboard covers field (bottom 171, line 120); send is not above the keyboard`), then passed. All 18 chat tests pass.

Before: `qa/mobile/shots/before-chat-keyboard-land.png`. After: `qa/mobile/shots/after-chat-keyboard-land.png`, and `qa/mobile/shots/after-chat-find-kb-land.png` (Find in use with the keyboard up).

### 68. A search in chat hid the line you sent

Search "Tuesday" and the log shows only that line. The Search key did nothing, so on a sideways SE the keyboard stayed on Find and the message field sat under the keys. Once Find stepped aside, nothing on screen said the log was cut down. And a line you sent did not match, so it vanished as you sent it.

The Search key ends the search and drops the keyboard; the filter stays. While a search is on, the chat title reads 'Lines with "Tuesday"' (it trims, and Close stays put). Sending a line clears the search, so your line shows with the rest.

Repro: `test/mobile/chat-find-sign.js`. It failed (`Search key leaves the keyboard on Find; message field cannot be tapped; keyboard covers field (bottom 171, line 120); the line you sent is not in the log`), then passed. All 19 chat tests, safe-area.js and landscape-first.js pass. `header-full.js` fails with and without this change.

Before: `qa/mobile/shots/before-chat-find-sign-land.png`. After: `qa/mobile/shots/after-chat-find-sign-land.png`, and `qa/mobile/shots/after-chat-find-iphone-se.png` (the title in portrait).

### 69. A phone header never showed a message

On a phone, a message in the header (No blur picked, "⛔ Only the person who runs this room can change its password.", "🛡 Wrong admin password.") never showed. setStatus wrote it only to the wide-window line, which a phone hides, so the chip kept the room name. The message was only in a title, and a phone does not show titles.

setStatus now writes the phone line too. The message shows while it holds (4s, 12s for a refusal), and then the room name comes back.

Repro: `test/mobile/header-message.js`. It failed 3 of 3 runs (`phone header reads "header-message", not the message`), then passed 3 of 3. `header-full.js`, `header-tap.js`, `header-count.js`, `header-invite.js` pass. The rest of test/mobile passes except `caption-on-tile.js` and `caption-read.js`, which fail the same way without this change (`iphone-se-200: no caption on the call`).

Before: `qa/mobile/shots/before-header-message-pixel-7.png`. After: `qa/mobile/shots/after-header-message-pixel-7.png`, and `qa/mobile/shots/after-header-full-pixel-7.png`.

### 70. A cut phone header message had no "…"

On a phone, a message too long for the header chip ("Faces stay blurred until this room has a password…", a refusal, a reach warning) was cut mid-word ("until th"), with no sign there was more to tap for. The phone made `#status` a flex box for its 44px tap, and `text-overflow: ellipsis` is never drawn on a flex box (a WebKit button is one inside, too).

The text now sits in an inner `.statustext` span, a block that clips with "…". The button keeps its 44px tap, and a tap still opens the whole line.

Repro: `test/mobile/header-ellipsis.js`. It failed 3 of 3 runs on iPhone SE and Pixel 7 (`a cut message has no "…" (display flex …)`), then passed 3 of 3. Firefox at the same phone sizes passes too. Safari (WebKit) was not run: no fleet machine can launch it this cycle. `caption-read.js` and `caption-on-tile.js` failed only because they never turned CC on, which captions need since a801ad4. They tap CC first now and pass.

Before: `qa/mobile/shots/before-header-ellipsis-iphone-se.png`, `qa/mobile/shots/before-header-ellipsis-pixel-7.png`. After: `qa/mobile/shots/after-header-ellipsis-iphone-se.png`, `qa/mobile/shots/after-header-ellipsis-pixel-7.png`.

## Open

The build name is a faint line under the header. A green round "A" in Nathan's shot did not appear in the Playwright capture. Fit and the name chip stay while the dock is tucked. A closed chat says who mentioned you, Reply keeps that line on the answer, and Delete takes back your own line. An address in a line is a link. The room name and full screen are 44px taps. A sideways phone shows the whole name. A chat line takes a reaction. The keyboard leaves the chat field and Send in view on a sideways SE. The chat title says when a search is cutting the log down. A phone header shows a message while it holds. A long header message ends in "…". Safari has not been checked for the "…".

## Personas (what was actually tried)

- Grandparent, iPhone SE, text link `#v=qa-mobile-sunday`, no saved name. Name dialog appears, typing works, Continue enters the call. More opens. Keyboard coverage of that dialog was only simulated with `--kb`, which the page ignores.
- Exec, Pixel 7, portrait then a landscape resize. Mic and camera toggled. More opened. Dock fits on this phone; landscape More was not the SE failure but the sheet is the same unscrollable panel.
- Teen, iPhone 15, eight fast taps across mic, camera, reactions, and More. No crash. Reactions icon was not changed.
- Low vision, 360px, root font 32px. Dock and More captured.
- Host, iPhone SE landscape. More opened, Password tapped with `force: true` because the button is off screen. Password sheet shot saved.
- Chat, iPhone SE. Opened from More. Composer tap blocked by the dock.

With no saved confirmation for this session, joining shows how you will appear: your GifOS name and picture, editable. Save keeps them. Clear blanks both. A session that already confirmed skips the card.

### More sheet is a dense grid of mixed labels

More opens to Hand, Invite, and Help. All tools shows Who, Run app, Vote, Password, Stage, Record, Captions, Settings, Keys, and Transcript. Captions is also on the dock. Each of those has a key, including while All tools is folded. Host tools stay hidden until there is a host, and those bulk tools still have no key. The full list, once opened, is still long.

### Invite, Leading, and Full screen on the app bar stay English

Save, Steal, Hide, and Talk follow a German or Spanish device. Invite, Leading, and Full screen on that bar still appear in English.

### Status line is easy to lose

“5 in the meeting” used to be one ellipsized sentence, and four faces whose calls had not connected yet still read “Just you”. The count is now its own uncut phrase, it includes every face on the wall, and it opens the roster. The quality and password notes may still trail off.

### Not yet walked end to end

Gallery packing, self-view placement, and the reactions icon are not in this pass. A shared slide fills the stage and Stop sharing sits on it. Share screen is one button on the dock, Alt+S does the same thing, and one click opens the picker. The stage says whose screen it is, at 16px, and that line follows German and Spanish. A broadcast says off air and on air, and the booth has a run of show. During Song the booth has Program and Preview. On a short window that card stays under Off air. Those words stay on this computer. They are not on the outgoing picture. The roster can mute someone for everyone, hold a new arrival until Admit, rename them, and spotlight them. The waiting room is not a sealed lobby. Who, Share, Vote, Password, and Invite follow German and Spanish, including the tips and the line after you share or vote. Run app stays English. The Who download for the police stays English. Stepping away shows Away, and coming back says you are still in the call. A phone that ends the camera says so on your tile and brings it back, including when the page never goes to the background. A camera that stays live and sends no frames says so on the first quiet sample. A camera that is still painting black frames waits on the watchdog.

---

<!-- release/0.9.23: the phone Meet quirks from cursor/qa-meet-mobile follows. -->

Four faces are real peer records (`__gifosVideo.presentPeers`), not cloned tiles. On a phone the packer now refuses a wide squash, including when the phone is sideways; desktop packing is unchanged. On a phone the dock and the Live row tuck when the call is quiet, and a tap brings them back.
Self-view placement is not in this pass. Reactions says the word. The gallery packs equal tiles and stops above the dock. A shared slide fills the stage and Stop sharing sits on it. Share screen is one button on the dock, Alt+S does the same thing, and one click opens the picker. The stage says whose screen it is, at 16px, and that line follows German and Spanish. A broadcast says off air and on air, and the booth has a run of show. During Song the booth has Program and Preview. On a short window that card stays under Off air. Those words stay on this computer. They are not on the outgoing picture. The roster can mute someone for everyone, hold a new arrival until Admit, rename them, and spotlight them. The waiting room is a sealed lobby: until Admit the person waiting sees and hears no one, and no one hears them. Who, Share, Vote, Password, Invite, the Run app sheet, the Who download, signing in as admin, Stop app, Turn chat off, and Save, Steal, Hide, and Talk follow German and Spanish, including the tips and the line after you share or vote. Invite, Leading, and Full screen on the app bar stay English. Stepping away shows Away, and coming back says you are still in the call. A phone that ends the camera says so on your tile and brings it back, including when the page never goes to the background. A camera that stays live and sends no frames says so on the first quiet sample. A camera that paints pure black says so on the first sample. A dim room that is still sending frames is never restarted.
# Broadcast and meeting mobile quirks

Role-play pass on `run.html` (Broadcast is this page with `#bc=1`). Served locally and driven with Playwright Chromium, touch, mobile emulation.

Devices: iPhone SE (320×568), iPhone 15 (393×659), Pixel 7 (412×839), a 360×740 Android, each in portrait and landscape.

Personas: church volunteer starting a broadcast, late viewer on a shared link, flaky connection, low-vision at a 32px root font, broadcaster who needs to flip cameras.

Screenshots for the open bugs are in `test/mobile/screenshots/before/`.

## Design rules

- GifOS design rule: there cannot be any possibility in our design for growth of a single node's bandwidth in direct proportion to users. Any feature where one node's (host, viewer, relay, peer) upload or download scales with the number of users is rejected; fan out instead.

## Open

### Q81. My Media's Download button does nothing on iPhone

Deferred by Nathan. Not fixed in this pass.

My Media (`js/sample-apps.js`, the Download button `#mdown`, handler `downloadCur`) opens an item and offers Download. Download builds a blob URL and clicks an `<a download>` named for that file. The same tap saves the file in Chromium, in Firefox, and in Linux WebKit. On iPhone it does nothing. Suspected cause: iOS ignores a blob `<a download>` click that happens inside the null-origin sandboxed app iframe. Possible fixes, not tried here: `navigator.share` on iOS, or a runtime `gifos.download` bridge from the app iframe to the host page. The bridge is a core change. Deferred by Nathan.

### Q80. A late arrival that heard the host's spare copy before its relay pulled a full copy from the host

Q79's open part 2, now reproducible on demand. The host sends its stage feed live to two seats only (STG-DIRECT). Every other neighbour gets the host's copy as a parked spare (`sb:1`) and should watch a one-hop relay from a direct seat. But a late arrival's link to the host and its link to the relaying seat come up in a race. When the host's spare is heard first, it is the only candidate, so `claimRedun` makes it the first claim. The no-primary seed also asks for it hot: it ranks copies by raw hop count, and the spare's `h: 0` beats any relay. The host then feeds that late arrival a full copy until failback moves it to the relay. That happens to every late arrival that loses the race: in `late-host-upload` the host sent media on 2 links with 3 joiners in one row (where it has one direct seat) about 1 wave in 3, and on a 3rd link at 6 joiners.

`test/mobile/late-relay-first.spec.mjs` forces the race. The host is on this machine and the joiners are on two other fleet machines. Joiner A is the host's direct seat. A starts no new relay (`holdRelayForTest`, debug only) until joiner B already hears the host's spare, then 2 s more. The test counts the host's bytes on B's link for 30 s after B joins and asserts at most 15 KB (about 2 s of one copy). It also asserts that B ends on A's relay and that B's picture advances. A second case holds A's relay for good: B's picture must still run, and keep running past any wait.

| | host → late arrival in 30 s | late arrival watches |
|---|---|---|
| c3cb7a8 (today), iphone-se: 2/2 fail | 79.6 KB, 90.6 KB (the spare claimed at once; 34 KB before the relay was even released) | host, then the relay ~8.5 s after it came |
| Fix tried (not shipped), 4 profiles + 2× iphone-se: 6/6 pass | 0 B every run | the relay |

The fix tried: a newcomer holds the first claim of the stager's `sb:1` spare for up to 6 s while it waits for a relay. Any other copy that arrives meanwhile wins. The no-primary seed skips the spare during the wait and ranks stage copies like `prefCand` (`stgRank`). The spare is still claimed when no relay comes (the second case passed, 2/2). It is not shipped because `rebroadcast.spec.mjs` regressed on it. With the joiners on two other machines: before 8/8 pass, with the fix 5/8. One failure was a mid-rebroadcast joiner getting 3 frames in 3 s instead of more than 20. The other two (pixel-7) were RECONNECTING and "outside your network" states. Likely cause, not verified: a newcomer on a fresh relay waits for a keyframe that comes down the pipe lane late, while the host's fresh copy started at once. So the spare was hiding how slowly a relayed copy starts. The next step is to make a fresh relay start fast (a keyframe on claim), then wait for it.

The `late-host-upload` gate is also red for reasons outside this race. Over 16 runs, before and with the fix, the same kinds of failure showed up:
- A late arrival never gets a seat: no coordinate and no links for 60 s, sometimes as the only joiner.
- The status-beat ratio check reads a low 1-joiner baseline (560 B/s instead of ~840).
- A relay hiccup wakes the spares of its children for ~7 s, then they fail back. That is the standby doing its job, bounded by the relay's children.

Before: `test/mobile/screenshots/before/*-late-relay-first-*`.

## Fixed

### Q79. A broadcast host passed on every viewer's heartbeat

Q78's open part. The status heartbeat floods its sender's section (`scope: 'section'`, up to C² = 25 seats), and every seat in the section passes each beat on over its section links. The host is one of those seats, so its channel upload grew with every viewer, up to 25 of them: one node's bandwidth in proportion to users. Nobody shows a viewer's tile in a broadcast, so the flood bought nothing there.

Now a broadcast viewer (not the host, not on the Stage) sends its beat only on its own links (row, cross, up/down: at most C + 2), with no section flood (`bcViewerBeat`). Its neighbours still hear it first-hand, which is all the near field reads (relay claims from `conns`, playout need, seat reports). What the room needs from a viewer far away (a raised hand, a Stage ask, being counted) already rides the tree's fold, so a broadcast reads the fold at any size (`foldIsRoom`: hands, Stage asks, the count), not only past one section. The host and anyone on the Stage still flood their section, as before.

`test/mobile/late-host-upload.spec.mjs` (host here, 1/3/6 late joiners on two other fleet machines) now also counts the host's channel bytes by kind (`__gifosVideo.txKindBytes()`) and asserts its status-beat bytes per open link at 6 joiners stay within 1.5× of 1 joiner; the host still counts 7, and the last joiner (not linked to the host) raises a hand that reaches the host's queue.

| | host status beats per link, B/s (1, 3, 6 joiners) | all host channel bytes per link (1 → 6) | host beats total at 6 |
|---|---|---|---|
| Before (427a57f + byte counter only), iphone-se, android-360: fail | 840, 1460-1580, 2980-3115 | 1340 → 4530-6050 | 11.9-15.6 KB/s |
| After, 4 profiles: beat check passes 4/4 | 842, 608-610, 657-985 | 1340 → 2000-2630 | 3.3-4.9 KB/s |

Open parts, both on the host at 6 joiners, both seen before this change too:
1. Mesh `ROUTE` probes (S1 liveness probes of rook cells routed through the tree) add 3.0-4.5 KB/s on the host at 6 joiners (3.5-9.4 before), and `S1SYNC` grows with the section's occupancy. Both are mesh control traffic capped at C² seats, but they still grow with users up to there.
2. Sometimes (3 of 10 after runs, 1 of 3 before) the host feeds the stage straight to a third joiner (three joiners report `via` = host; a third link at 1.9-4.0 KB/s), past the stage feed's two direct seats (STG-DIRECT). Q78's media-link check catches it; it is not reproducible on demand yet. Reproduced in Q80 (open): a late arrival that hears the host's spare before its relay takes the spare.

Before: `test/mobile/screenshots/before/*-host-beat-*`. After: `test/mobile/screenshots/after/*-host-beat-*`.

### Q78. Each late arrival added host upload: a renegotiation loop and a row band per joiner

Two causes, both per late arrival, both on the host:

1. A renegotiation loop that never stopped. Offers on a link take turns (35a979e): the polite side (the smaller peer id) asks (`rreq`), the initiator says go (`rgo`), the polite side offers. `renegotiate()` set `renegAgain` when it had to ask, and the offer it sent once the turn came never cleared it. So after every answer, `afterNeg` saw `renegAgain` and asked again: rreq → rgo → roffer → ranswer, for good, about 7 offer/answer pairs a second per polite joiner. The host answered every one and the pair traded 160-520 KB/s on the channel. Ids are random, so a run looped only when a joiner drew an id below the host's: the "2 of 4 runs" in the first sighting. Fix: an offer clears `renegAgain` when it starts, because it carries every change made up to then. A change made while the offer is in flight still sets it again.
2. Row bands nobody watches. Past one row (C = 5 seats), `reconcileMosaic` treated the room as "beyond my row" and the host built its row band (an audio fold and a composite) and shipped it over a direct link to each late arrival past the row. A broadcast never renders the row grid or the stadium (`body.broadcast #grid, #stadium { display: none }`), so this was upload to nowhere: at 6 joiners the host sent media on 5 links. Fix: in a broadcast, `beyondRow` is false; only the Stage lane runs, and it reaches late arrivals down the relay tree.

`test/mobile/late-host-upload.spec.mjs` puts the host on this machine and late joiners on two other fleet machines (`BC_VIEW_WS`), in waves of 1, then 3, then 6. To force the trigger, it re-mints peer ids so the host's id is high and every joiner's is low, so each joiner is the polite side. After each wave settles (20 s), over 10 s it asserts: at most 2 host offers and answers, at most 2 host links carrying media, and host outbound-rtp at 6 joiners within two copies (×1.25) of 1 joiner. The stage feed goes live to at most two seats (STG-DIRECT). It also asserts that every joiner's stage picture is advancing. It writes `trace.json` with the host's rtp and channel bytes once a second.

| | offers+answers / 10 s (1, 3, 6 joiners) | host media links at 6 | host rtp KB/s (1 → 6) | host channel KB/s (1, 3, 6) |
|---|---|---|---|---|
| Before (45197fe), 4 profiles, 4/4 fail | 72-95, 116-182, 90-148 | 5 | 7.0-9.1 → 18.2-21.1 | 162-208, 261-407, 333-519 |
| | (pixel-7 ran before ids were forced: 0 at 1 joiner, the first joiner drew the higher id) | | | (1.3 at 1) |
| After, 4 profiles, 4/4 pass | 0, 0, 0 | 2 | 7.1-7.3 → 14.4-15.9 | 1.0-1.4, 6.7-9.1, 20.9-26.4 |

Open part: the host's channel bytes still grow with joiners, by about 3 KB/s each. That is the status heartbeat. It floods the sender's section (`scope: 'section'`), and the host's section holds up to C² = 25 seats. So the growth stops at 25 members and stays flat after, by design, but up to there one node's upload is proportional to the room. Fixed in Q79: a broadcast viewer's beat stays on its own links.

Before: `test/mobile/screenshots/before/*-late-host-upload-{host,joiner,trace}.*`. After: `test/mobile/screenshots/after/*-late-host-upload-*`.

### Q77. A late arrival had nothing to watch, and a church had no way to replay the broadcast live

With the late-arrival pull gone (Q76), someone who opened the link after the end read only that it ended, and a church that streams the 9:00 broadcast again at 11:00, or plays a prerecorded sermon, had no way to do it. Resi and BoxCast do this with a simulated live. Now the host has Rebroadcast in More, and on the replay sheet after Leave. It plays "Last broadcast" (the copy Go live kept, Q69) or any video file the host picks into the broadcast. It is a source swap like a screen share: the playing video's own capture becomes the stage feed's picture and sound (`sentVideoTrack`, `mySelfStream`), so it rides the same stage fan-out down the relay tree as a live broadcast. The tracks are made once at start and kept until Stop, so the stage stream id does not churn. The host sees a line above the dock, "Prerecorded · Last broadcast · 0:42 / 31:05", with Pause (Resume) and Stop. The host's badge reads PRERECORDED, never LIVE. A viewer reads PRERECORDED in the banner and Prerecorded on the picture, and sees whatever is playing now, with no scrub, no seek and no save. Stop goes back to where the host was: the camera if live, or the ended screen and the replay sheet if it started there, so a late arrival reads "The broadcast has ended." again. Leave ends a rebroadcast too.

Sound and picture come from one element's capture. On Chromium the element's own capture (`captureStream`) put the sound within the measurement noise of the picture, while the same sound through Web Audio arrived about 90 ms late. Where there is no capture (Safari), a canvas draws the picture and Web Audio carries the sound. The host's phone plays it muted, so its own mic hears nothing back.

`test/mobile/rebroadcast.spec.mjs` puts the host on this machine and the viewers on two other fleet machines (`BC_VIEW_WS`, remote `npx playwright run-server`s). The clip (`fixtures/rebroadcast-clip.webm`, 120 s) flashes white and beeps together once a second. One viewer is in when the host starts it, and three more arrive mid-play. Each must see frames advancing, PRERECORDED and Prerecorded, and no controls. The last one measures beep minus flash on what it is shown (median within 150 ms). The host's outbound-rtp bytes/s with four viewers must stay within 1.5× of one viewer. A second case rebroadcasts the last broadcast from the ended screen to a late arrival, then Stop puts "The broadcast has ended." back. It failed 8/8 (4 phone profiles × 2 cases) before. After: 6/8 on the first full run (iphone-se's last joiner heard 3 beeps in 8 s; pixel-7's late arrival never got the picture), then 8/8 on pixel-7 and iphone-se twice each, once the measurement followed whatever element and track the viewer is shown. Sync medians −42 to +147 ms (sound late is positive). Host upload with 1 vs 4 viewers: 8.9 vs 8.1, 6.2 vs 6.0, 9.1 vs 8.8 KB/s. The fan-out was host → first viewer → the other three. A last 4-profile run on bbd63bb: the main case 4/4 (sync medians −30 to +91 ms; upload 8.5/8.2, 7.9/7.8, 8.1/6.1, 11.9/8.1 KB/s), the last-broadcast case 3/4: pixel-7's kept copy was 0:16 after 30 s live, because Go live's keep starts late (Q69), and the test had assumed at least 0:20. The check now reads position and length only, and passes there. Neighbouring broadcast specs 123/124 (Q67 known).

Before: `test/mobile/screenshots/before/iphone-se-rebroadcast-late-viewer.png`, `iphone-se-rebroadcast-host-more.png`, `iphone-se-rebroadcast-host-ended.png`. After: `test/mobile/screenshots/after/iphone-se-rebroadcast-*.png`.

Design: there is no on-demand catch-up and no mid-broadcast replay pulled from anyone's phone, because anyone can open the link and every one of them would download the whole file from one phone. The host rebroadcasts instead, through the live stage fan-out, so the host's upload does not grow with the audience. A viewer cannot pause, seek or download a rebroadcast; they see what is playing now. A file the host picks is played as is: its name shows on the host's line only, never to viewers.

### Q76. Anyone with the link could pull the whole broadcast off a phone

Q71 and Q72 let someone who opened the link after the end tap Watch and pull the whole recording from a phone still in the room, the host's or a viewer's. That is the same upload problem as a mid-broadcast catch-up: anyone can open the link, and every one of them downloads the whole file from one phone, so that phone's upload grows with the people who missed it. It breaks the design rule at the top of this file. Watch is gone from "The broadcast has ended." screen, with every piece of the pull (the `rpl`, `rplw`, `rplx`, and `rplc` frames, the offer on a new channel, the 8 s next-holder retry) and the viewer-side recording that only fed it (Q62). A late arrival reads "The broadcast has ended." on the quiet line and on the chip, OFF AIR, and nothing else. The host still keeps every broadcast (Q69), and Leave still hands the host the replay with Share, Save, and Close (Q68), so the host can send it or rebroadcast it. That sheet says "The broadcast has ended." and no longer promises it to whoever opens the link. While it stays open the host's seat stays (Q72) and says on its status pulse that the broadcast ended (`bcend`), which is how the late arrival knows it ended rather than never started. `test/mobile/no-late-replay.spec.mjs` puts the host on one machine and the late arrival on a second fleet machine (`BC_LATE_WS`, a remote `npx playwright run-server`). The late arrival must read that it ended, with no Watch, no replay sheet, and no `rpl` frame in `rxStats().dcKinds`, while the host's kept copy is still whole. It failed 4/4 phone profiles before, and passes 4/4 after. `late-replay.spec.mjs`, `host-seed.spec.mjs`, and `viewer-replay.spec.mjs` are retired, along with the viewer case in `replay-share.spec.mjs`.

Before: `test/mobile/screenshots/before/*-no-late-replay-late.png`, `*-no-late-replay-host.png`. After: `test/mobile/screenshots/after/*-no-late-replay-late.png`, `*-no-late-replay-host.png`.

Design: there is no on-demand catch-up, mid-broadcast or after. The host's rebroadcast replaces it. The host plays the last broadcast, or a file, into the live broadcast, and it goes out through the same stage fan-out as a live broadcast, so the host's upload does not grow with the audience. A late arrival sees whatever is playing then. The `bcend` mark is any member's word, not an admin-signed order, the same trust the `rpl` offer had, and it only changes the sentence when nothing is on the stage.

### Q75. A town hall had no way to take questions from the people watching

A town hall, a church's Q&A night, and a streamer's AMA all end in questions. A hundred people watching can't all raise a hand, and in chat the question everybody wants asked scrolls away under "amen" and "hi from Ohio". Teams town halls and Zoom webinars have a Q&A with votes, and StreamYard puts a comment on the picture. Our viewer had Hand and Chat. Now More has Questions (a town hall and a broadcast, never a meeting). Anyone asks there. Everyone sees the questions with the most votes on top and votes with one tap (a second tap takes the vote back). The host gets Show on each question, which puts it on every viewer's picture as "Guest 9265 asks" with the question, under the chip, and Hide takes it down. The host can also remove a question for everyone. Show is a signed admin order, so only the host can put words on the picture. Questions and votes ride the chat's carrier, so someone who joins late gets them and the question on the picture too, but the chat log never shows them, and a host who turns chat off still takes questions. The band wraps around Fit. At a 32px root on a 320×568 phone it steps down to 18px, and if it is still cut short the words fade and a tap opens the whole question. `test/mobile/questions.spec.mjs` uses a real host phone going live and a second phone on the shared link. It covers asking, the vote order on both phones, a viewer having no Show, the chat staying clean, the band clearing Fit, chip, Visit, captions and dock (also at large type), and Hide.

Before: `test/mobile/screenshots/before/iphone-se-viewer-more.png`. After: `test/mobile/screenshots/after/iphone-se-viewer-more.png`, `iphone-se-viewer-ask.png`, `iphone-se-host-questions.png`, `iphone-se-viewer-shown.png`, `iphone-se-viewer-shown-large.png`.

Design: Questions sits in More, not on the dock, because a 320px dock at a 32px root has no fifth slot. A question has no moderation queue yet (Teams has one), and nobody can ask anonymously.

### Q73. A viewer had no way to reach the host's own site; it is a plain Visit link

A church, a town hall, or a streamer has its own site, and the people watching want to get there: the bulletin, the sign-up, the streamer's page. Our viewer had Hand, React, More, and Leave, and no way out to it. Now the host pastes one https link once in More ("Visit link", with "Link for viewers (opens in a new window)" under it; "Visit link · example.com" once set). It stays on the host's phone for that room, and every viewer link from Invite carries it as `visit=<https url>`. A viewer reads Visit, with a box-and-arrow icon, on the picture, right side, above the dock. The tap opens that page in a new window and the broadcast keeps playing. On the screen that says the broadcast has not started or has ended, Visit sits in the middle under the sentence. Only an https page with no user name or password in it is offered (512 characters at most), and the label names the site ("Visit example.com (opens in a new window)") because anyone can hand someone a link. A meeting never shows it. At a 32px root Visit grows to 56px and stops, and where it would meet Fit it moves to the left.

This first shipped as Give (Tip on a stream) with a heart, pointing at a giving page. We can't control where the host's link goes, so to keep our liability down it is now just a link: the word is always Visit, the icon is a neutral external link, never a heart or a $, and no giving, tip, or offering wording is left in the page. Links shared before the rename carry `give=`; they still work and read Visit.

`test/mobile/visit.spec.mjs` (replaces `give.spec.mjs`). It is a real host phone going live and setting the link, and a second phone opening the shared link (on another fleet machine with `BC_VIEW_WS`). It checks the label, the icon, no heart, $ or money words in any state, the new window at the host's URL, large type, landscape, the ended screen, a stream, the old `give=`, bad links, and a meeting. Before (8f1d4d4): 16 failed across 4 phone profiles. After: 24/24 with the viewer on a second machine.

Before: `test/mobile/screenshots/before/iphone-se-visit-live.png`, `iphone-se-visit-ended.png`, `iphone-se-visit-host-more.png`, `visit-spec-run.log`. After: `test/mobile/screenshots/after/iphone-se-visit-live.png`, `iphone-se-visit-live-large.png`, `iphone-se-visit-live-landscape.png`, `iphone-se-visit-ended.png`, `iphone-se-visit-host-more.png`, `visit-spec-run.log`.

Design: the link rides the viewer link, so a viewer already in the room when the host changes it keeps the old one until they reopen the link. The pill sits on the picture, not the dock, because a 320px dock at a 32px root has no fifth slot. It is a link and nothing more, so it costs no bandwidth.

### Q72. Nobody watched, the host ended, and a late arrival read "has not started"

A church went live, nobody joined in time, and the host tapped Leave. Someone who opened the link ten minutes later read "The broadcast has not started." and had nothing to play. The host's phone had kept the whole broadcast (Q69), but Leave took it out of the room. Resi and BoxCast put the replay behind the same link. Now Leave on a kept broadcast ends it and keeps the seat: the stage, mic, and camera are off and nothing is sent, but the page still answers anyone who opens the link. The replay fills the host's phone, and it says "The broadcast has ended. Anyone who opens the link while this stays open can watch it." The screen stays awake. The late arrival reads "The broadcast has ended." on the quiet line and on the chip (not "2 in the broadcast"), OFF AIR, and Watch pulled the host's kept file over the room (Q71's pieces), byte for byte. Close on the host's sheet is the real leave.

Superseded by Q76: the pull and the "Anyone who opens the link…" line are removed for upload reasons, and `host-seed.spec.mjs` is retired. The seat-keeping stays, so a late arrival still reads that the broadcast ended, and the host rebroadcast will play through it.

Before: `test/mobile/screenshots/before/iphone-se-host-seed-host.png`, `iphone-se-host-seed-late.png`. After: `test/mobile/screenshots/after/iphone-se-host-seed-host.png`, `iphone-se-host-seed-late.png`, `iphone-se-host-seed-playing.png`.

Design: the host's own copy is offered for as long as the host leaves that sheet open. Church stays at 4. Once that sheet is closed and every viewer who holds it has gone, the link cannot play it; Resi's still can.

### Q70. A shared link never said when, and an old link said "has not started"

A church shares Sunday's link midweek. A viewer who opened it on Wednesday read "The broadcast has not started." and nothing about when to come back. Someone who opened it on Monday read the same thing. Resi, BoxCast, and YouTube Live all show the start time on the watch page. The host now sets a start time in More, in the phone's own date and time picker, and More reads "Starts Sunday at 10:00 AM". The viewer link carries it as `at=<unix seconds>`, and Invite's text says "Live Sunday at 10:00 AM." On Wednesday the viewer reads "The broadcast starts Sunday at 10:00 AM." in their own time zone, with Add to calendar under it, 48px tall and above the dock. That opens an .ics with the link and a 15-minute alarm. The same day reads "today at 6:30 PM", and the next day reads "tomorrow". From 15 minutes before the time until 3 hours after, it reads "The broadcast is about to start.", in case the host is late. After that, someone who opens the link reads "The broadcast has ended." A link without a time is unchanged. The host's phone keeps the time for that room. `test/mobile/service-time.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-service-time.png`. After: `test/mobile/screenshots/after/iphone-se-service-time.png`.

Design: the link says when to come, and an old link says that it is over. Church stays at 4: this matches a church desk's watch page, and does not beat it. Someone who arrives after it ended still cannot watch it unless someone sends them the file (Q68).

### Q69. A broadcast was kept only if the host remembered Record

Go live put the host on the stage, and nothing was kept. On Leave, an iPhone SE read “You left the meeting”, and there was nothing to send to whoever missed it. Resi and BoxCast keep every broadcast without a tap. Go live now keeps the stage the same way. It starts once the host is on the stage, with the recording chip everyone already sees, and Record reads Stop 0:00. The file goes to the phone's own storage, so no save picker opens. On Leave the replay fills the phone, with Share, Save, and Close in one row, and Share hands the file to the share sheet. A stream is kept the same way. A viewer's page records nothing. Stop still stops, and it does not start again. The strip on the stage carries no sound, so the host's own voice is mixed in. `test/mobile/host-keep.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-host-keep.png`. After: `test/mobile/screenshots/after/iphone-se-host-keep.png`.

Design: every broadcast is kept, so there is always a replay to send. Church and personal stay at 4. Someone who opens the link after it ended still reads that it has not started, and the live screen does not yet say the broadcast is being kept.

### Q68. Someone who missed the broadcast could not be sent it

The phone replay had Save and Close. Save put a file in Downloads, and getting that file to the church group meant leaving the app to find it. The replay now leads with Share. It hands the video file to the phone's share sheet, so the host, or a viewer who watched, sends the broadcast to whoever missed it in one tap. The file is ready before the tap, because a share sheet only opens inside it. On an iPhone SE, Share, Save, and Close are 89×48, 91×48, and 91×48 in one row. At a 32px root they wrap to two rows, Close 288×48 under the other two, ending at y=552 of 568. After a send, Close does not download a second copy, and Save still saves. A phone that cannot share a file keeps Save and Close. A wide screen still downloads. `test/mobile/replay-share.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-replay-share.png`. After: `test/mobile/screenshots/after/iphone-se-replay-share.png`.

Design: the replay goes where the people who missed it already are. Church and personal stay at 4. Someone who opens the link after the broadcast ended still reads that it has not started, and the host only has a file to send if they tapped Record.

### Q67. A large text size hid the quiet sentence under the dock

At a 32px root on an iPhone SE, “The broadcast has not started.” was 56px type in four lines. Two of those lines started at y=343 and y=413, under a dock that starts at y=350. The sentence now fits in two lines at 36.8px, ending at y=335, above the dock. The chip still carries the same words. A meeting is unchanged. `test/mobile/broadcast-ended.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-quiet-type.png`. After: `test/mobile/screenshots/after/iphone-se-quiet-type.png`.

Design: the sentence stays readable when the type grows. Large type stays at 4. Someone who arrives after a broadcast has ended still cannot watch it.

### Q66. A viewer had to hunt for Hand

The join line says a viewer is seen only if they raise a hand. On an iPhone SE the dock was React, More, and Leave, and Hand was a 0×0 control inside More. Hand now sits on the dock, 44×44, before React, with Leave still inside the screen at x=214. A tap raises the hand and the button reads Lower. A town hall watcher gets the same dock. A meeting, a host, and a person called on stage keep Hand in More. `test/mobile/hand-dock.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-hand-dock.png`. After: `test/mobile/screenshots/after/iphone-se-hand-dock.png`.

Design: the action the screen asked for is on the dock. Church and corporate stay at 4. Someone who arrives after a broadcast has ended still cannot watch it.

### Q65. A raised hand was hidden under OFF AIR

The hand line sat at the top of an iPhone SE, 24px tall, in 12.8px type. A name was 31×18. The OFF AIR banner is 44px and covered it, so the tap landed on the banner. The line now sits under the chip. The name is 117×44, and that name is the tap. The friend-link card moves below the line, starting at y=204. A town hall host still reaches Invite. A meeting keeps the line in the page. Who can be called up is unchanged. `test/mobile/hand-queue.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-hands.png`. After: `test/mobile/screenshots/after/iphone-se-hands.png`.

Design: a raised hand is a tap on the phone. Church stays at 4. Someone who arrives after a broadcast has ended still cannot watch it.

### Q64. An empty town hall was the invite sentence on a dark stage

A town hall host alone on an iPhone SE read “Just you — send the invite; the link has no expiry” in the chip. The stage was dark, and Invite was not there. The stage now says “The town hall has not started.” The chip names the room and offers a blue Invite, 75×44. The shared link carries `th=1` and leaves the password out. A wide screen keeps the invite sentence and hides the button. A watcher does not get Invite. A meeting still asks its host to send the invite. The camera stays on the dock. A speaker still fills the stage, and the sentence steps aside. `test/mobile/town-hall-join.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-town-hall-empty.png`. After: `test/mobile/screenshots/after/iphone-se-town-hall-empty.png`.

Design: the empty hall says what it is, and Invite is the next tap. Corporate stays at 4. Someone who arrives after a broadcast or stream has ended still cannot watch it.

### Q63. A town hall host saw a meeting gallery

The host’s own tile filled an iPhone SE, 316×504, named “Guest … (you).” The gallery is gone. The host’s room is the stage. A speaker fills that screen. The invite line stays while they are alone, and the camera stays on the dock. A watcher is unchanged. A meeting still shows the gallery. `test/mobile/town-hall-join.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-town-hall-host.png`. After: `test/mobile/screenshots/after/iphone-se-town-hall-host.png`.

Design: the host looks at the stage. Corporate stays at 4. The empty hall is still the invite sentence on a dark stage.

### Q62. An ended broadcast had nothing to watch

The stage said “The broadcast has ended.” and stopped there. A viewer who watched the stage now gets Watch on that screen. It plays the picture they just saw, filling the phone, and Close leaves the file where it is. A stream says the same thing. A broadcast that has not started has no Watch. The host still uses Record.

Superseded by Q76: the viewer's recording only fed Watch and the late-arrival pull, and both are removed. `viewer-replay.spec.mjs` is retired.

Before: `test/mobile/screenshots/before/iphone-se-viewer-replay.png`. After: `test/mobile/screenshots/after/iphone-se-viewer-replay.png`.

Design: what you watched is still there. Church and personal stay at 4. Someone who arrives after it ended still has nothing to watch. The town hall host still sees the room as a gallery.

### Q61. A broadcast speaker was a small card

The program was a rounded card, 304×171, parked at the top of an iPhone SE. It now fills the phone, 320×568, with square corners. The frame stays whole. “On stage” sits above the dock. The “has not started” line stays off while someone is up, and it stays when the stage is empty. A meeting speaker stays a tile. `test/mobile/broadcast-stage.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-broadcast-stage.png`. After: `test/mobile/screenshots/after/iphone-se-broadcast-stage.png`.

Design: the program is the phone. Church and personal stay at 4. A viewer still cannot watch the ended broadcast.

### Q60. A finished recording never played

Stopping a recording on the phone downloaded a file and left the call where it was. The picture that was just captured never came back. On a phone that recording now plays. The picture fills the screen, a slider moves through it, and a tap pauses it. Save keeps the file. Close keeps it too, unless it was already saved. A wide screen still downloads. A viewer whose broadcast has ended still has nothing to watch. `test/mobile/replay.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-replay.png`. After: `test/mobile/screenshots/after/iphone-se-replay.png`.

Design: the recording is something you can watch. Church and personal stay at 4. A viewer still cannot watch the ended broadcast.

### Q59. Go live was a white sheet under the picture

The camera filled 320×504 of an iPhone SE, and a white bar sat under it with Go live. The picture now fills the phone, 320×568. Go live is a button on that picture, and a tap on the picture is that same button. Sunday morning and Friday night stay on the picture. More still opens Watch and the host key. The host key is still minted. A short landscape keeps the strip so Go live stays on the screen. `test/mobile/action-buttons.spec.mjs`, `test/mobile/create-one-password.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-go-live.png`. After: `test/mobile/screenshots/after/iphone-se-go-live.png`, `test/mobile/screenshots/after/iphone-se-stream-go-live.png`.

Design: the picture is the tap. Church and personal stay at 4. There is still no replay.

### Q58. A town hall speaker was a meeting tile

The stage strip was a 16:9 card, 320×180, parked at the top of the phone. A speaker now fills the watcher’s screen. The picture is cover, the corners are square, and the short side stays at least 120px. “On stage” sits above the dock. The “has not started” line stays off while a speaker is up. A meeting speaker stays a tile. The host still has the gallery. `test/mobile/town-hall-join.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-town-hall-speaker.png`. After: `test/mobile/screenshots/after/iphone-se-town-hall-speaker.png`.

Design: the speaker is the stage. Corporate stays at 4. FaceTime is still one tap, and that tap is the whole screen.

### Q57. A town hall watcher filled the phone with their own tile

The gallery gave a watcher a meeting tile of themselves, 316×504 on an iPhone SE, while the stage sat off screen. The watcher’s room is now the stage. Their tile is gone. The stage says “The town hall has not started.” The host still has the gallery, and still keeps the camera. A meeting still shows the gallery. `test/mobile/town-hall-join.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-town-hall-gallery.png`. After: `test/mobile/screenshots/after/iphone-se-town-hall-gallery.png`.

Design: a watcher looks at the stage. Corporate stays at 4. A speaker on that stage is still a meeting tile.

### Q56. A town hall viewer got a meeting’s camera and mic

Opening a town hall put Camera, Flip, and Unmute on the dock, then Blur, Run app, Share screen, Password, and Record in More. A watcher now gets React, More, and Leave. Hand, Chat, and Admin sign-in stay. The host, who holds the room key, keeps the camera and the mic. A stage grant puts the watcher’s camera and mic back. A meeting is unchanged. `test/mobile/town-hall-join.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-town-hall-dock.png`. After: `test/mobile/screenshots/after/iphone-se-town-hall-dock.png`.

Design: a town hall watcher is here to watch. Corporate stays at 4. The room can still show a meeting’s gallery.

### Q55. The phone dock had no words

Camera, Flip, the mic, React, More, and Leave were icons. A tall phone now prints the word on each one: Camera, Flip, Unmute, React, More, Leave. The mic is the only Unmute. When the mic is on, that same word becomes Mute. A broadcast viewer’s mic stays hidden, so they do not get an Unmute. A short landscape keeps the thin strip of marks and hides the words. `test/mobile/dock-labels.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-dock-labels.png`. After: `test/mobile/screenshots/after/iphone-se-dock-labels.png`.

Design: one word on the control, and one Unmute. Church, corporate, and personal stay at 4.

### Q54. A viewer alone was told to send the invite

A church viewer who opened a quiet broadcast, and a friend who opened a quiet stream, read “Just you — send the invite; the link has no expiry.” That line is the host’s. The stage now says “The broadcast has not started.” or “The stream has not started.” The chip says the same thing, and the banner stays OFF AIR. Once this tab has seen someone else in the room and the room is empty again, the stage says “The broadcast has ended.” or “The stream has ended.” A host who is alone still gets Invite. A town hall viewer still reads that the hall has not started. A meeting still gets the invite line. `test/mobile/broadcast-ended.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-viewer-ended.png`. After: `test/mobile/screenshots/after/iphone-se-viewer-ended.png`, `test/mobile/screenshots/after/iphone-se-service-ended.png`.

Design: the empty stage is the sentence, the way a player says the broadcast has not started or has ended. Church and personal stay at 4. There is still no replay.

### Q53. A host alone was told to send the invite

The chip said “Just you — send the invite; the link has no expiry.” On a phone that sentence is a blue Invite button. It opens the share sheet, or copies the viewer link when the phone has no share sheet. The viewer password is not in the link or the words. The button goes away once someone joins. A viewer does not get it. Wide screens keep the sentence: `.topchip[data-invite="1"]` and `__gifosVideo.shareInvite` are there for the desktop Broadcast agent. `test/mobile/header-invite.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-host-alone.png`. After: `test/mobile/screenshots/after/iphone-se-host-invite.png`.

Design: the same blue Invite Meet uses when you are alone. Church stays at 4.

### Q52. The join sheet said “This is how you’ll appear” twice

The title and the line under it were the same sentence. The title stays. The repeat is gone on a meeting and on a town hall host. A broadcast viewer keeps that line, and it now says “Only seen if you raise your hand and are promoted to the stage.” A broadcast host still skips the sheet. A town hall viewer still skips it. `test/mobile/appear-preview.spec.mjs`, `test/mobile/viewer-join.spec.mjs`, `test/mobile/town-hall-join.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-join-double.png`. After: `test/mobile/screenshots/after/iphone-se-join-sheet.png`, `test/mobile/screenshots/after/iphone-se-broadcast-viewer-join.png`.

Design: one title, and a second line only when it says something the title does not. Church stays at 4.

### Q51. A town hall viewer was told to send the invite

Opening a town hall link skipped the appearance step and then said “Just you — send the invite; the link has no expiry.” That line is the host’s. A viewer now reads “The town hall has not started.” A host who holds the room key still gets the invite line. A meeting still gets it. `test/mobile/town-hall-join.spec.mjs`.

Design: a viewer waits for the town hall. Corporate stays at 4. The room still wears a meeting’s controls.

### Q50. A town hall viewer stopped on the appearance step

A person opening a town hall link saw “This is how you’ll appear in the town hall” before they could watch. They watch off camera, the way a church viewer does, so that step is gone. The title stays Town hall, and Leave the town hall stays the leave control. The camera control stays on the dock. A host who already holds the room key still gets the appearance step. A meeting still gets it. `test/mobile/town-hall-join.spec.mjs`.

Design: a viewer lands in the town hall. Corporate stays at 4. The room still wears a meeting’s controls.

### Q49. Watch and the host key sat on the go-live sheet

The sheet under the picture held Go live, then Watch, then Change host key. The sheet is now Go live. More sits on the picture and opens Watch and the host key, including Generate. The key is still minted. On an iPhone SE the name is y=422 to y=470 and Go live is y=508, the full width of the sheet. A stream uses the same sheet. `test/mobile/create-one-password.spec.mjs`, `test/mobile/action-buttons.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-service-desk.png`, `test/mobile/screenshots/after/iphone-se-stream-name.png`.

Design: the picture, the filled name, then the blue Go live. Church and personal stay at 4. FaceTime is one tap, and that tap is the whole screen.

### Q48. Go live on a broadcast sat under the broadcast name

Sunday morning was a field in the sheet, above Go live. It now sits on the picture, and Go live is the first control in the sheet. On an iPhone SE the name is y=294 to y=342 and Go live is y=380. Watch a broadcast stays under it. The host key is still minted. A blank name still goes live as Sunday morning. `test/mobile/create-one-password.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-service-desk.png`.

Design: the picture, the filled broadcast name, then the blue Go live. Church stays at 4. Watch and the host key still share the sheet.

### Q47. The stream sheet asked for a name before Go live

A stream opened with an empty-looking name field above Go live, so the sheet was the first thing in the way. The name now opens as Friday night and sits on the picture, 12px above the sheet. On an iPhone SE the field is y=294 to y=342 and Go live is y=380, the first control in the sheet. Watch a stream stays under it. The host key is still minted. From the meeting lobby, Stream sits beside Open meeting and opens this desk. A blank name still goes live as Friday night. `test/mobile/create-one-password.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-stream-name.png`.

Design: the picture, the filled name, then the blue Go live. Personal stays at 4. Watch and the host key still share the sheet. FaceTime is one tap.

### Q46. A church desk opened as a stream named Friday night

`#bc=1` said Stream, “Friends watch with the link.”, and Friday night. It now says Broadcast, “People watch with the link.”, Broadcast name, and Sunday morning. Go live stays the blue button. Watch a broadcast is the outline under it. A blank name uses Sunday morning. The host key is still minted. The link on the stage says “People watch with this link.” `test/mobile/create-one-password.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-service-desk.png`.

Design: the picture, the broadcast name, the blue Go live. Church stays at 4. Go live still sits in a sheet under the picture.

### Q45. A quiet broadcast read RECONNECTING

A viewer opening a broadcast that had not started, or that this phone had not reached, saw an amber RECONNECTING banner. Nothing had dropped. The banner now says OFF AIR, the same word a host sees before the picture is up. RECONNECTING stays for a link that dropped, a door they are knocking on again, or a network that cannot get through. A host who is already sending a picture still reads RECONNECTING while the room is out. `test/mobile/live-badge.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-viewer-offair.png`.

Design: one grey banner, OFF AIR, until the broadcast is there. Church stays at 4. The desk opens as a broadcast.

### Q44. A stream on a phone was a form with a strip of camera

The camera sat in a 72px strip and the white sheet was the screen. On a phone the picture is now the top of the screen, 292px tall on an iPhone SE. Stream and “Friends watch with the link.” sit on the picture. The sheet under it is the name, Go live, and Watch. Change host key and Add a viewer password share the row under Watch. The host key is still minted. Opening it brings Generate onto the screen. A short landscape keeps the strip so Go live stays on the screen. `test/mobile/create-one-password.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-stream-preview.png`.

Design: the picture, then the name, the blue Go live, the outline Watch. Personal stays at 4. The sheet still asks for a name. FaceTime is one tap.

### Q43. A town hall joiner landed in a meeting

The link from Start a town hall opened as a meeting: “in the meeting,” and a meeting title. The link now carries `th=1` (`?th=1` on a pretty `/meet` path, `&th=1` in the hash). A joiner lands in the town hall. The title is Town hall. The first sentence is “This is how you’ll appear in the town hall.” Leave says Leave the town hall. The shared link keeps the flag. A meeting without the flag still says meeting. The camera, the stage, and the host key are unchanged. `test/mobile/town-hall-join.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-town-hall-join.png`.

Design: the same room, named for what they joined. Corporate stays at 4. They still pass an appearance step.

### Q42. A church viewer still stopped to give a name

Opening a broadcast showed Watching the broadcast, a name, and Save. The name is already seeded for the knock, and Settings still holds it, so that step is gone. A viewer lands on the broadcast. Stop watching stays the leave control. The camera stays off. A meeting still gets the appearance step. `test/mobile/viewer-join.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-viewer-straight.png`.

Design: the broadcast is the screen. Church stays at 4. A quiet broadcast reads OFF AIR. The desk they start from is a stream named Friday night.

### Q41. Go live left the camera off

A stream host landed off air and had to tap the camera. Go live now turns the camera on. The mic stays quiet. A reload that already chose keeps that choice. A meeting still joins with the camera off. The friend link becomes a row above the dock, y=422 to y=486 on an iPhone SE, so the picture stays the stage. Blur stays on the video. There is no separate picture laid over it. `test/mobile/viewer-join.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-stream-live.png`.

Design: the stage is the camera, Copy sits on the dock. Personal stays at 4. The first screen is still a form. FaceTime is the preview.

### Q40. The friend link was a later hunt

Go live opened off air, and the link lived behind More. The off-air stage now says “Friends watch with this link.” with the link and Copy. On an iPhone SE the card runs y=118 to y=285, under the title chip, and Copy is 48px, above the dock. A short landscape keeps the card between the chip and the dock. The camera still puts the picture on, and then the card leaves. A viewer does not see it. A meeting does not see it. `test/mobile/viewer-join.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-stream-link.png`.

Design: one white card, one sentence, the link, one blue Copy. Personal stays at 4. The picture is still a separate camera tap. FaceTime is still that camera.

### Q39. A stream asked for a name, then another sheet

Go live did nothing until a name was typed, and the next screen was “This is how you’ll appear in the meeting.” The name now opens as Friday night. A blank name uses that too, so Go live is one tap. A host who holds the room key lands on the stream. A viewer still gets Watching the broadcast. A meeting still gets the appearance step. The host key is still minted. `test/mobile/create-one-password.spec.mjs`, `test/mobile/viewer-join.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-stream-friends.png`.

Design: the name is ready, then the blue Go live. Personal stays at 4. The stream opens off air, and the friend link is still another step. FaceTime is still one tap.

### Q38. A stream to friends opened as a church broadcast

`#bc=1` said Broadcast, Broadcast name, Sunday morning, and Watch a broadcast. It now says Stream, “Friends watch with the link.”, Name, and Friday night. Go live stays the blue button. Watch a stream is the outline under it. An empty name says “Name it first.” Change host key and Add a viewer password stay under Watch, and the key is still minted. A short landscape hides the sentence with the title so Go live stays on the screen. `test/mobile/create-one-password.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-stream-friends.png`.

Design: Stream, one sentence, the name, the blue Go live, then the outline Watch. Personal stays at 4. FaceTime is still one tap, and this still mints a host key.

### Q37. A meeting lobby led with an open room

The filled button was Start a meeting, an open room with no host. Start a room you run talked about a password and banning someone. The filled button is now Start a town hall. It opens the host form: Town hall, Your host key, Generate, and Create & enter. Start an open meeting stays underneath, unfilled. `test/mobile/create-one-password.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-town-hall.png`.

Design: one blue town hall, then an outline open meeting, then Join a link. The host key stays on the form, the way a meeting room you run is built. Corporate stays at 4. A town hall still asks the host for a key, and people who join still land in a meeting.

### Q36. A church viewer was asked to appear in the meeting

Opening a broadcast link showed “This is how you’ll appear in the meeting” and Preview camera. A viewer stays off camera. The step now says “Watching the broadcast” and “You stay off camera. A name shows only if you chat.” Preview camera is gone. Clear and Save stay. Stop watching replaces Hang up. A host who holds the room’s key still gets the appearance step and Preview camera. `test/mobile/viewer-join.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-viewer-watch.png`.

Design: one sentence, the name, Clear and Save. No camera. Church stays at 4. They still pass a name step before the broadcast is the whole screen.

### Q35. Change host key sat above Go live

A broadcast opened on the broadcast name, then Change host key, then Go live. The key was in the path. Go live now sits under the name, Watch under that, and Change host key under Watch. On an iPhone SE the name is y=130 to y=178, Go live y=198 to y=246, Watch y=258 to y=307, and Change host key y=321. Opening it shows Your host key, the readable three-word key, and Generate, from y=317. The key is still minted and stored. A meeting still shows the host key above Create & enter. `test/mobile/create-one-password.spec.mjs`.

Before: `test/mobile/screenshots/after/iphone-se-service-first.png`.
After: `test/mobile/screenshots/after/iphone-se-service-desk.png` and `test/mobile/screenshots/after/iphone-se-host-key-open.png`.

Design: the name, the blue Go live, then the outline Watch. The host key is a text link under that, and opening it is the same readable key the meeting uses. Warm copy stays at 4. A church desk still does not list a host key.

### Q34. A rotated strip was still a tall band

The frosted pill was 48px with 22px marks. It is now 36px, and the marks are 18px. The targets stay 44px, so a thumb still lands, and they sit a little proud of the strip. Hang up stays the solid red control. On an iPhone SE landscape the pill is y=270 to y=306 and the face is y=59 to y=320, 560×261. A 32px root grows the strip to 48px and the marks to 24px. `test/mobile/landscape-stage.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-landscape-thin.png`.

Design: a thin frosted line, small marks, and one red Hang up. Landscape stays at 4. Meet’s strip is still a little thinner. The face stays a stage.

### Q33. A short landscape dock ignored a larger text size

At a 32px root the portrait dock grows to 88px, and the rotated dock stayed 44px inside a 48px pill. It now follows the root size up to 56px controls and a 64px pill. On an iPhone SE landscape the controls are 56px, the glyphs are 28px, and the pill runs y=242 to y=306. The face stays y=87 to y=320, 560×233. The pill covers 78px of that tile, under half. A 16px root still paints the 44px glyphs in a 48px pill. `test/mobile/dock-scale.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-landscape-type.png`.

Design: the rotated controls get larger with the text, and Hang up stays the only red. The picture stays a stage under the chip. Large type stays at 4. The rotated dock stops at 56px so the face is not a strip. FaceTime still wins that dimension.

### Q32. A rotated dock painted solid discs on the picture

The frosted pill still carried grey circles, so each control hid a 44px patch of the face. On a short landscape those circles are gone. Camera, flip, mic, reactions, and More are 22px glyphs on the translucent pill, with the 44px target kept. Hang up stays the solid red control. The face is still y=59 to y=320 on an iPhone SE landscape. `test/mobile/landscape-stage.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-landscape-glyphs.png`.

Design: the picture reads through the strip, and the only filled control is Hang up. Landscape stays at 4. The glyphs still sit in a 48px pill. Meet’s marks are smaller and its strip is thinner, so more of the face stays clear.

### Q31. Not now and Continue did not say how you join

The join step is the same screen for a meeting and a broadcast. The outline button said Not now and the blue button said Continue. They now say Clear and Save. Clear empties the name field and the picture in the form and leaves the step open. Save closes it and keeps whatever the form is showing. Clearing and then saving joins with no stored name and no picture. Saving without clearing keeps Ada Lovelace and the picture. Save stays the only filled button (`#0064c8`). Clear stays the outline, 12px away, both at least 44px. `test/mobile/action-buttons.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-join-not-now.png`.
After: `test/mobile/screenshots/after/iphone-se-join-save.png` and `test/mobile/screenshots/after/iphone-se-join-clear.png`.

Design: the preview, the field, then Clear and Save. Save is the blue button. After Clear the face is an empty circle and the field shows its placeholder, so the blank is what you would be saving. Warm copy stays at 4. A church desk still goes on with no host key.

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

### Q25. Starting a broadcast took a tap before the broadcast had a name

The lobby opened on Start broadcasting, and the name was a second screen. A broadcast now opens on Broadcast name and Go live. Watch a broadcast is the outline button under it. The host key is still minted and stored, and Change host key reveals it. A meeting still starts from its own buttons and still shows the host key. `test/mobile/create-one-password.spec.mjs`.

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

### Q22. A broadcast still asked for a host key before the broadcast had a name

The create form opened on “Your host key” and Generate, then Create & enter. A broadcast now asks for a broadcast name and Go live. The host key is still minted and stored, and Change host key reveals it. A viewer password stays behind its own step. A meeting still shows the host key on the form. Go live sits 12px under the last text link, and on a short landscape the extra title is hidden so those links stay above the buttons. `test/mobile/create-one-password.spec.mjs`.

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

The host step said “Host password” over a masked field, so a volunteer had to invent a secret before the broadcast existed. It now says “Your host key,” the key is readable, and the form opens with one already filled. Generate replaces it with another three-word key. Create stays the only filled button. A viewer password stays behind its own step. `test/mobile/create-one-password.spec.mjs`.

Before: `test/mobile/screenshots/after/iphone-se-one-password.png`.
After: `test/mobile/screenshots/after/iphone-se-host-key.png`.

Design: one label, one short sentence, the whole key on its own line, then an outline Generate and the blue Create. On a phone the key sits above Generate so it is not cut off. Warm copy for church is still not a 5. A church desk names the broadcast and goes on. This path still keeps a host key.

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
