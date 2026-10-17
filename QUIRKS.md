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

- **Who hits it:** the volunteer running a church service, and everyone watching it.
- **What you saw:** during Song the booth read the line on its own screen. The room saw only the camera, with no words to sing.
- **Repro:** `test/desktop/lyrics.spec.js` (“during Song the current line is on the picture the room sees”, blurred and clear) failed before the fix: no words on the outgoing frame (894a848). A first fix painted the line across the full width at the bottom. A real two-browser broadcast, booth and viewer on different machines, showed that the room sees this camera as a centered square with the name strip over its bottom 17%, so the viewer read “…ing g… how sweet the s…” under the name. The repro now checks for that too (8b2b1a3).
- **Fix:** while the order of service is on Song, the booth paints the current line onto the picture it sends: white on a dark band, wrapped to two lines, inside the centered square, and above the name strip. A clear camera goes through the same canvas only while Song is up. The next line stays on the booth.
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

### Q18. An open room did not say whether it was a service or a small group

The full-width bar now names the room. A service says **Service · You are live** (red `#b61622`) or **Service · You are watching** (gray `#e8ecf1`). A small group says **Small group** on green `#143024`. Chat, leave, invite, Help, and the tab title use the same words. The lobby still says Start a call or Go live. The two bars do not share a background, and both clear the chip, the Fit button, and the dock at 1280, 1920, and 900. Before: the Q16 bars, which only said “You are live” / “You are watching”, and a meeting that hid the bar. After: `test/e2e/artifacts/service-bar-live-after.png`, `service-bar-watch-after.png`, `small-group-bar-after.png`.

### Q19. Recording and who is here were inside More

The room bar now says **Not recording** or **Recording**, and a headcount (**1 here**) that opens the name list. More can stay closed. Recording is a white pill with red text. Not recording is an outline on the same bar. Both fit inside the bar at 1280, 1920, and 900, clear of the dock. Tapping Not recording opens the record sheet. Tapping the count shows the names, including your own. A service keeps “Service · You are live” beside those controls. After: `test/e2e/artifacts/trust-group-after.png`, `trust-group-recording-after.png`, `trust-service-after.png`.

### Q20. Leave was an unlabeled phone icon, and coming back said “meeting”

The dock button says **Leave**. The question is Stay (outline) and Leave (red), with a gap between them. After you leave, a white card says **You left the small group** or **You left the service**. Rejoin is blue `#0064c8`. Close is a white outline button. Rejoin reloads the same link and the room bar is back. The label fits inside the button at 1280, 1920, and 900. After: `test/e2e/artifacts/leave-dock-after.png`, `leave-ask-after.png`, `leave-rejoin-after.png`.

### Q21. Mute and camera were only a dock color

A full-width line under the room bar says **Microphone off** and **Camera off** while those are off. White on `#3a1014`. It sits under the room bar, clears the dock, and fits 1280, 1920, and 900. It hides when the microphone and camera are on. Someone only watching a service does not see it. After: `test/e2e/artifacts/av-off-after.png`, `av-on-after.png`.
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

Starting a recording, or seeing someone else start one, opens a white card. The title is **You are recording this small group**, **You are recording this service**, **Jordan Lee is recording this small group**, or **This small group is being recorded** when the name is missing. The body says it is saved on a device in this room and that the bar keeps saying Recording. OK is blue `#0064c8`. The card fits 1280, 1920, and 900. OK dismisses the card and leaves the bar on Recording. The record sheet says the same thing: Cancel is an outline, Start recording is blue. After: `test/e2e/artifacts/rec-notice-after.png`.

### Q23. Invite opened onto a governance essay

Invite is a dock button. The sheet is now a white card. A small group says **Share this small group** and **Send this link. Anyone who opens it joins you.** Copy is blue `#0064c8`. Close is an outline. The gap between the link and Copy is 12px. **A room you run** is a text link; the host password stays hidden until that tap. A service says **Share this service** and that people who open the link are watching. A host also sees that the host password stays with them. The card fits 1280, 1920, and 900, including after a live resize to 900, and the password step still fits. Before: `test/e2e/artifacts/invite-sheet-before.png`. After: `test/e2e/artifacts/invite-sheet-after.png`.

### Q24. The full-screen control said Full

The dock button now says **Full screen**. The word fits inside the button at 1280, 1920, and 900, and after a live resize from 1920 to 900. The dock stays inside the window. Before: `test/e2e/artifacts/dock-full-before.png`. After: `test/e2e/artifacts/dock-full-after.png`.

### Q25. Send was a short white button under an empty files strip

Send is blue `#0064c8`, 44px tall, white text. The message field is white with a gray border, also 44px. The files strip stays hidden until a file is pinned. Prayer still posts its own line. The composer clears the dock at 1280, 1920, and 900, and after a live resize to 900. Before: `test/e2e/artifacts/chat-send-before.png`. After: `test/e2e/artifacts/chat-send-after.png`.

### Q26. The lobby said Meeting or Broadcast

A cold open now says **Small group**. Go live says **Service**. The blue button is still Start a call or Go live, and the quiet line still says you come in muted, or that people watch with the link. The card fits 1280, 1920, and 900. After: `test/e2e/artifacts/lobby-words-after.png`, `lobby-service-after.png`.

### Q27. A small group asked before you could leave

Leave on a small group goes straight to **You left the small group**. Rejoin is still blue. Close is still the outline. The confirm stays on a service, because you are live: Stay is the outline and Leave is red. After: `test/e2e/artifacts/leave-onetap-after.png`.

### Q28. The status line was cut off

Alone in a room, the chip said “Just you — send the invite; the link has no expiry” and then clipped the rest, including at 1920. It now says **Just you. Send the invite.** The chip can use the width beside Fit. The whole line fits at 1280, 1920, and 900, and after a resize from 1920 to 900, and it does not cover Fit. After: `test/e2e/artifacts/status-fit-after.png`.

### Q29. The dock stayed up on a quiet small group

On a small group the dock slides off the bottom after the call sits quiet, and a pointer, a key, or focus brings it back. It stays put while More is open, reactions are open, a text field is focused, or a card is up. A service does not tuck. Before: `test/e2e/artifacts/dock-tuck-before.png`. After: `test/e2e/artifacts/dock-tuck-after.png`.

### Q30. A small group opened with three doors

Start a call is the button. Host this call and Join a link are text links in `#0064c8`, and each still opens its fields in place. A service still leads with Go live, and Watch stays the outline button, because a volunteer and a viewer both need a door. The card fits 1280, 1920, and 900. Before: `test/e2e/artifacts/lobby-doors-before.png`. After: `test/e2e/artifacts/lobby-doors-after.png`, `lobby-doors-service.png`.

### Q31. Captions turned pale green when they were on

The More button says **Captions**. On is blue `#0064c8` with white text, and Record uses that same on state. The word fits at 1280, 1920, and 900, and after a resize from 1920 to 900. Before: `test/e2e/artifacts/captions-before.png`, `captions-on-before.png`. After: `test/e2e/artifacts/captions-after.png`.

### Q32. Broadcast is the stage. A small group is the call.

Nathan’s Broadcast design: only the stage shows. No row, no stadium, no other tiles. The host steps on when the host key is adopted, and can step off. Raised hands are an admin list the host promotes from. A viewer’s name and picture are seen only if they raise a hand and are promoted. The host key stays.

What this desktop branch already matches: a service hides `#grid` and `#stadium`. Comfy layout does not run on a broadcast. A small group keeps the grid. That grid is the many-to-many call, and it is not the Broadcast product. The service lobby still asks for the host password, and adopting that key calls `tryBroadcastStage`.

A Watching viewer keeps Hand. Unmute, Video, and Stage leave, keyed off the watching seat (`body.bc-watching`), so the session frame does not have to join or grow `notadmin`. Clicks on those controls do not ask for a camera or microphone and do not step onto the stage. Service help no longer says ban lives on each tile: mute, blur, and ban are on each stage seat and on the raised-hands list, Promote calls someone up, and Demote on the stage seat sends them back. `#stagemod` stays the on-stage cards. `#handraise` is the host’s raised-hands list. A viewer’s join step says they stay off camera unless they raise a hand and the host promotes them. A small group still says “This is how you'll appear.” Before: `test/e2e/artifacts/role-gaps/before/`. After: `test/e2e/artifacts/role-gaps/after/`. The stage-versus-grid shots stay at `test/e2e/artifacts/broadcast-stage-flag.png` and `small-group-grid-flag.png`.

### Q33. A live service said Just you

Alone on a service, the chip used the small-group sentence. A host now reads **You are live. Send the link.** A viewer reads **You are watching this service.** A small group still reads **Just you. Send the invite.** The line fits beside Fit at 1280, 1920, and 900, and after a resize from 1920 to 900. Before: `test/e2e/artifacts/service-alone-before.png`. After: `test/e2e/artifacts/service-alone-after.png`.

### Q34. Share screen was inside More

On a small group, Share is a dock button. The label is **Share**, and the accessible name is Share screen. The word fits, and the dock stays inside the window at 1280, 1920, and 900, including after a resize to 900. A service puts Share back in More, so the stage dock does not gain a meeting button. Before: `test/e2e/artifacts/dock-share-before.png`. After: `test/e2e/artifacts/dock-share-after.png`.

### Q35. Fit stayed after the dock tucked

On a quiet small group, Fit slides off with the dock and comes back with it. A service keeps Fit. The room bar, the mute line, and the status chip stay. Before: `test/e2e/artifacts/fit-idle-before.png`. After: `test/e2e/artifacts/fit-idle-after.png`.

### Q36. The host stepped on from inside More

On a service the host’s dock says **Step on**. It turns red and says **Step off** once they are on, and the next tap steps off. The word fits, and the dock stays inside the window at 1280, 1920, and 900. A viewer does not get that button. A small group still says Stage, inside More. Before: `test/e2e/artifacts/host-step-before.png`. After: `test/e2e/artifacts/host-step-after.png`.

### Q37. A watcher’s stage was a blank page

An empty service now says **The stage is clear.** A host who has stepped on with the camera off reads **You are on stage. Your camera is off.** A picture fills the space between the room bar and the dock at 1280, 1920, and 900, and after a resize to 900. A small group does not show the line. Before: `test/e2e/artifacts/stage-picture-before.png`. After: `test/e2e/artifacts/stage-picture-after.png`. Filled: `test/e2e/artifacts/stage-picture-fill.png`.

### Q38. The join sheet told a viewer they would appear in the meeting

The sheet’s title stays **This is how you'll appear.** There is no “in the meeting” line. A broadcast viewer also reads **Only seen if you raise your hand and are promoted to the stage.** A host and a small group get the title only. The line fits inside the card at 1280, 1920, and 900. Before: `test/e2e/artifacts/appear-note-before.png`. After: `test/e2e/artifacts/appear-note-after.png`.

### Q39. A viewer raised a hand from inside More

On a service the viewer’s dock says **Raise hand**. It turns blue and says **Lower hand** once the hand is up. The word fits, and the dock stays inside the window at 1280, 1920, and 900, including Lower hand at 900. A host and a small group still say Hand, inside More. Before: `test/e2e/artifacts/viewer-hand-before.png`. After: `test/e2e/artifacts/viewer-hand-after.png`. Raised: `test/e2e/artifacts/viewer-hand-raised.png`.

A desktop walk of both journeys is in `test/e2e/artifacts/journey/`. The viewer joins, watches a clear stage, raises a hand, and steps off from More after a test promotion. The host opens the lobby, joins with the title only, goes live, steps on, steps off, and gets the leave question.

### Q40. A promoted viewer stepped off from inside More

Once a viewer is on the stage, the dock shows a red **Step off**, the same control as the host. The word fits, and the dock stays inside the window at 1280, 1920, and 900. Stepping off puts Stage back in More. A watcher who is not on stage does not get the button. Before: `test/e2e/artifacts/viewer-stepoff-before.png`. After: `test/e2e/artifacts/viewer-stepoff-after.png`.

### Q41. A viewer on stage was told the stage was clear

Anyone on the stage with no picture now reads **You are on stage. Your camera is off.** Stepping off brings back **The stage is clear.** A host already had the camera-off line. Before: `test/e2e/artifacts/viewer-onstage-before.png`. After: `test/e2e/artifacts/viewer-onstage-after.png`.

### Q42. The room bar still said You are watching

A person on the stage now reads **Service · You are on stage**, on the red bar. The words fit beside Not recording at 1280, 1920, and 900. A host stays **Service · You are live**. Stepping off returns the bar to **Service · You are watching**. Before: `test/e2e/artifacts/viewer-air-before.png`. After: `test/e2e/artifacts/viewer-air-after.png`.

### Q43. The top line still said You are watching

A person on the stage now reads **You are on stage.** The badge says **On stage**. Neither overlaps Fit at 1280, 1920, or 900. Stepping off brings back **You are watching this service.** and **Watching**. A host still reads **You are live. Send the link.** Before: `test/e2e/artifacts/viewer-chip-before.png`. After: `test/e2e/artifacts/viewer-chip-after.png`.

### Q44. Fit did nothing on a service

Fit and Scroll lay out a gallery of faces. A service is one stage, and the gallery layout does not run there, so the button only renamed itself. A service now hides Fit, for the host and for a viewer, at 1280, 1920, and 900. A small group still shows Fit, and a tap still switches it to Scroll. Before: `test/e2e/artifacts/fit-service-before.png`. After: `test/e2e/artifacts/fit-service-after.png`.

### Q45. Service chat crushed its own title

Opening chat put **Service chat** in a narrow column beside the privacy line, so the title wrapped and the line stacked in a 120px strip. The title now stays on one line. The privacy line sits under it, across the panel, and it does not cover the title or Close. The same layout holds a small group’s **Small group chat**. Checked at 1280, 1920, and 900, and after a resize to 900. Before: `test/e2e/artifacts/chat-head-before.png`. After: `test/e2e/artifacts/chat-head-after.png`.

### Q46. Service help named a button that is not there

Help told a viewer to tap **Hand** and to step down. The dock says **Raise hand**, and leaving the stage says **Step off**. The service help now uses those words. A small group still has its own help, and it still explains the stadium. The card stays inside the window at 1280, 1920, and 900. Before: `test/e2e/artifacts/help-hand-before.png`. After: `test/e2e/artifacts/help-hand-after.png`.

### Q47. Full screen on a service followed a speaker

The dock’s **Full screen** opened a black view whose only control was **Follow speaker**. A service is one stage, so that view now shows the stage. A clear stage reads **The stage is clear.** A person on stage with the camera off reads **You are on stage. Your camera is off.** Close stays inside the window at 1280, 1920, and 900. A small group still has Follow speaker. Before: `test/e2e/artifacts/fs-stage-before.png`. After: `test/e2e/artifacts/fs-stage-after.png`.

### Q48. The service password was called a room lock

Password on a service opened **Room password** and said anyone in the meeting can change it, and that new joiners must enter it. The lobby already calls this **Viewer password**, optional, and not part of the link (`run.html`, the service lobby). `js/gifos-net.js` cites `docs/meet-security.md` §LOCK: the password is mixed into the room key, so without it you cannot read the room, and the link’s sid and token stay password-free, so people still route in. The stage rule in `run.html` (Nathan, 2026-08-03) is the same: the password is the read capability, and a clear stage with only the link is not allowed. The sheet now uses the lobby’s name and note, and says people can still watch while the stage stays blurred until it is set. The card stays inside the window at 1280, 1920, and 900. A small group still says Room password. Before: `test/e2e/artifacts/viewer-pw-before.png`. After: `test/e2e/artifacts/viewer-pw-after.png`.

### Q49. Who is watching still described a meeting

The title already said **Who is watching**. The paragraph under it still said a server was not storing this meeting. It now says this service. A small group still says Who is here, and its paragraph still says meeting. The card stays inside the window at 1280, 1920, and 900. After: `test/e2e/artifacts/who-service-after.png`.

### Q50. A host alone had no Invite in the chip

The sentence said **You are live. Send the link.** The only Invite was the dock button, which opens a sheet. On a phone that same moment is a blue **Invite** in the chip (3f703a7). Desktop now shows that button beside the sentence. It is 44px, blue, and it copies or shares the viewer link. A viewer password in the link or in storage is left out. The button goes away when someone else is here. A viewer and a small group do not get it. The sentence stays, and it still fits at 1280, 1920, and 900. Before: `test/e2e/artifacts/host-invite-before.png`. After: `test/e2e/artifacts/host-invite-after.png`.

### Q51. A host had to open More to put slides on the stage

Share sat in More on a service. A small group already had it on the dock. StreamYard, YouTube Live, and a church desk put screen share next to the camera, because the slides are the service. A host’s **Share** is now on the dock, labeled Share, and the tip says it shows the stage a window, a tab, or the desktop. The bar still fits at 1280, 1920, and 900, including after a resize to 900. A viewer still finds Share in More. A small group is unchanged. Before: `test/e2e/artifacts/host-share-before.png`. After: `test/e2e/artifacts/host-share-after.png`.

## Open

A recording card names who is recording, and the bar stays Recording (Q22). Trust stays short of Zoom and Teams: there is no waiting room, and the card does not hold the recording until the other people have answered. FaceTime is still ahead on how little chrome a personal call shows. The dock tucks on a small group, and Fit leaves with it (Q35). The room bar, the mute line, and the status chip stay. The lobby stays at 4: one button, and the other ways in are still on the first screen. Labeled controls stay at 4. Share is on a small-group dock (Q34), and Zoom’s bar is still the reference. A Watching viewer’s dock, the raised-hands list, promote and demote, and the viewer join sentence are in Q32. The session frame records a Promote locally; a signed call-up still waits until this seat is an admin.

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

Gallery packing, self-view placement, and the reactions icon are not in this pass. A shared slide fills the stage and Stop sharing sits on it. Share screen is one button on the dock, Alt+S does the same thing, and one click opens the picker. The stage says whose screen it is, at 16px, and that line follows German and Spanish. A broadcast says off air and on air, and the booth has an order of service. During Song the booth has Program and Preview. On a short window that card stays under Off air. Those words stay on this computer. They are not on the outgoing picture. The roster can mute someone for everyone, hold a new arrival until Admit, rename them, and spotlight them. The waiting room is not a sealed lobby. Who, Share, Vote, Password, and Invite follow German and Spanish, including the tips and the line after you share or vote. Run app stays English. The Who download for the police stays English. Stepping away shows Away, and coming back says you are still in the call. A phone that ends the camera says so on your tile and brings it back, including when the page never goes to the background. A camera that stays live and sends no frames says so on the first quiet sample. A camera that is still painting black frames waits on the watchdog.

---

<!-- release/0.9.23: the phone Meet quirks from cursor/qa-meet-mobile follows. -->

Four faces are real peer records (`__gifosVideo.presentPeers`), not cloned tiles. On a phone the packer now refuses a wide squash, including when the phone is sideways; desktop packing is unchanged. On a phone the dock and the Live row tuck when the call is quiet, and a tap brings them back.
Self-view placement is not in this pass. Reactions says the word. The gallery packs equal tiles and stops above the dock. A shared slide fills the stage and Stop sharing sits on it. Share screen is one button on the dock, Alt+S does the same thing, and one click opens the picker. The stage says whose screen it is, at 16px, and that line follows German and Spanish. A broadcast says off air and on air, and the booth has an order of service. During Song the booth has Program and Preview. On a short window that card stays under Off air. Those words stay on this computer. They are not on the outgoing picture. The roster can mute someone for everyone, hold a new arrival until Admit, rename them, and spotlight them. The waiting room is a sealed lobby: until Admit the person waiting sees and hears no one, and no one hears them. Who, Share, Vote, Password, Invite, the Run app sheet, the Who download, signing in as admin, Stop app, Turn chat off, and Save, Steal, Hide, and Talk follow German and Spanish, including the tips and the line after you share or vote. Invite, Leading, and Full screen on the app bar stay English. Stepping away shows Away, and coming back says you are still in the call. A phone that ends the camera says so on your tile and brings it back, including when the page never goes to the background. A camera that stays live and sends no frames says so on the first quiet sample. A camera that paints pure black says so on the first sample. A dim room that is still sending frames is never restarted.
