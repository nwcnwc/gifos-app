# Desktop Meet UI quirks

Role-play pass on the desktop meeting (`run.html`) at 1280×720, 1920×1080, a 2560×1440 display at 1.5×, and a 900px window, including a live shrink. Same room, four simulated participants (canvas video on Chromium and Firefox; initials on WebKit, which kills the tab if a tile plays `captureStream`). Browsers: Chromium, Firefox, WebKit.

Personas in progress: consultant with a screen share, keyboard-only power user, host of a large room, someone tabbing away on a slow laptop, a non-English locale.

## Fixed

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

- **Who hits it:** someone who joined muted, which is the default, looking for how to speak. Nathan flagged a header Unmute pill on the phone that copies the dock mic.
- **What you saw:** the dock word was Mic. Desktop had no header pill, so the only control still named the object, not the action.
- **Repro:** `test/desktop/dock-labels.spec.js` expected Unmute and got Mic. The same test refuses `#unmute` and `#showcam`.
- **Fix:** while you are muted the dock says Unmute. While you are live it says Mute. German: Ton an / Stumm. Spanish: Activar / Silenciar. The icon stays on the button. There is no header Unmute and no header Camera.
- **Proof:** the dock and locale tests pass on Chromium, Firefox, and WebKit. At 900px Camera, Unmute, Share screen, CC, Chat, More, and Leave all stay on screen. Screenshots: `test/desktop/shots/unmute-dock-before-1280.png`, `test/desktop/shots/unmute-after-1280-dock.png`, `test/desktop/shots/unmute-live-1280-dock.png`, `test/desktop/shots/unmute-after-900.png`.

### The gallery view needed the pointer

- **Who hits it:** someone switching between fitting every face and scrolling larger faces, without reaching for the corner button.
- **What you saw:** Fit sat at the top right with no shortcut. The list had Alt+H and not this.
- **Repro:** `test/desktop/shortcuts.spec.js` requires `aria-keyshortcuts="Alt+F"` on `#fitbtn`. Before the chord, that attribute was empty.
- **Fix:** Alt+F switches Fit and Scroll. The same button still does it with the pointer. The list says so, including “Alle zeigen oder scrollen” and “Ver a todos o desplazar”. The gallery geometry is unchanged.
- **Proof:** the shortcut tests pass on Chromium, Firefox, and WebKit. Screenshots: `test/desktop/shots/view-key-before-1280.png`, `test/desktop/shots/view-key-after-1280.png`, `test/desktop/shots/view-key-scroll-1280.png`.

### Raising a hand needed the pointer

- **Who hits it:** a keyboard user who wants a hand up without opening More.
- **What you saw:** Alt+A, Alt+V, Alt+S, Alt+C, and Alt+Q were on the list. Hand was only the button under More.
- **Repro:** `test/desktop/shortcuts.spec.js` now requires `aria-keyshortcuts="Alt+H"` on `#hand` and a raised hand from that chord while the bar is collapsed.
- **Fix:** Alt+H raises or lowers your hand. The shortcut list says so, including “Hand heben oder senken” and “Levantar o bajar la mano”. A control inside More still answers its key while the sheet is folded. A button hidden on its own, such as Share for a broadcast viewer, stays quiet.
- **Proof:** the shortcut tests pass on Chromium, Firefox, and WebKit. Screenshots: `test/desktop/shots/hand-key-before-1280.png`, `test/desktop/shots/hand-key-after-1280.png`, `test/desktop/shots/hand-key-raised-1280.png`.

### Chat took two clicks

- **Who hits it:** anyone who wants the conversation, on a mouse, the way Zoom, Meet, and Teams put Chat on the main bar.
- **What you saw:** Chat lived under More. The dock had no Chat button, so the panel took two clicks. Alt+C already opened it.
- **Repro:** `test/desktop/chat-dock.spec.js` — “chat opens from the dock in one click” failed before the move (`#chatbtn` was inside More and had no size while the bar was collapsed).
- **Fix:** Chat sits on the dock, with the word on the button. One click opens the panel and turns the button blue. Closing it clears that blue. A new message while the panel is shut shows the count on the word, not by replacing the icon. More no longer has a second Chat button.
- **Proof:** the chat and dock tests pass on Chromium, Firefox, and WebKit, including a 900px window where Camera, Chat, and Leave all stay on screen. Screenshots: `test/desktop/shots/chat-one-before-1280.png`, `test/desktop/shots/chat-one-after-1280.png`, `test/desktop/shots/chat-one-open-1280.png`.

### CC started transcription and hid who was writing it on the tile

- **Who hits it:** anyone who wanted the words of the meeting, and anyone looking at a face that said “transcribing”.
- **What you saw:** CC was a grey button in More. Turning it on turned the letters pale green, and that person’s tile grew a “transcribing” chip. The transcript stayed hidden until someone did that. Turning CC off stopped the writing.
- **Repro:** `test/desktop/captions.spec.js` failed before the fix (no `#ccdock`). `node test/unit/whisper-stall.js` still passes, and it now refuses a tile that says “transcribing”.
- **Fix:** every browser writes down its own voice while it is unmuted. Chat always has Transcript, and Download transcript saves the file. CC, on the dock and in More, only shows or hides the lines on this screen. On, it is a blue button (`#0064c8`) with white letters and `aria-pressed`. A tile does not say who is transcribing. German More says Untertitel. Spanish says Subtítulos.
- **Proof:** the desktop test passes on Chromium, Firefox, and WebKit. The whisper stall gate passes (32). Screenshots: `test/desktop/shots/cc-before-1280.png`, `test/desktop/shots/cc-chip-before-1280.png`, `test/desktop/shots/cc-dock-on-1280.png`, `test/desktop/shots/cc-chip-after-1280.png`, `test/desktop/shots/cc-transcript-after-1280.png`.

### Chat composer sits under the dock, and the privacy line is crushed

- **Who hits it:** anyone opening Chat from a window about 1140px wide or narrower. The consultant’s laptop at a 900px window, and a live resize from 1400 down through 1100.
- **What you saw:** the message field and the paperclip ran underneath the white control dock, so the start of the field could not be clicked. “private to this meeting…” was squeezed into a ~110px column beside Transcript and Close. The More sheet stayed open on top of the conversation, because the sheet stacks with the dock, above the chat.
- **Repro:** `test/desktop/chat-dock.spec.js` failed on Chromium before the fix (`smallWide` false at 900; composer overlapped the dock at 1100 while shrinking).
- **Fix:** the chat panel’s bottom clears the dock only where they share horizontal space (`--dock-clear`, remeasured on resize and when chat opens). The privacy line takes its own row. Opening chat folds the More sheet without changing the saved “keep More open” preference. Close has an accessible name.
- **Proof:** the same test passes on Chromium, Firefox, and WebKit. Screenshots: `test/desktop/shots/chat-dock-before-900.png`, `test/desktop/shots/chat-dock-after-900.png`.

### Dock controls are icon-only

- **Who hits it:** a keyboard user, and an older volunteer, looking at Mic, Camera, More, and Leave.
- **What you saw:** four circles and a red hang-up. The names lived in `title`, so they appeared only on hover. Reactions stays an icon; that control belongs to another owner.
- **Repro:** `test/desktop/dock-labels.spec.js` failed on Chromium before the fix (`dockword` missing on `#mic`).
- **Fix:** Mic, Camera, More, and Leave each show a word inside the button. Opening More changes that word to Hide, including when chat folds the sheet. The buttons grow just enough to hold the word (dock about 482px, still inside a 900px window). The reactions SVG is unchanged.
- **Proof:** the same test passes on Chromium, Firefox, and WebKit, and the chat-dock tests still pass. Screenshots: `test/desktop/shots/dock-labels-before-1280.png`, `test/desktop/shots/dock-labels-after-1280.png`, `test/desktop/shots/dock-labels-after-900.png`.

### No keyboard shortcuts for mute, camera, chat, and leave

- **Who hits it:** a keyboard-only power user running mute, camera, chat, and leave.
- **What you saw:** those actions were pointer-only. Titles did not list a chord, and there was no shortcut list.
- **Repro:** `test/desktop/shortcuts.spec.js` failed before the fix (no `aria-keyshortcuts` on `#mic`).
- **Fix:** Alt+A mic, Alt+V camera, Alt+C chat, Alt+Q the leave confirm. The physical key is used, so a non-US layout still hits them. They do nothing while the caret is in a field, and nothing while a dialog is open. `?` opens a white list at 18px. More also has a Keys button. The dock’s accessible name mentions `?`.
- **Proof:** the test passes on Chromium, Firefox, and WebKit. Screenshot: `test/desktop/shots/shortcuts-after-1280.png`. Share, hand, and the gallery view still have no chord.

### More sheet covers the vote and runs off a short window

- **Who hits it:** someone voting a person onto the stage, and anyone opening More on a short laptop window (480px tall).
- **What you saw:** after picking “Vote onto stage” the white grid stayed open and covered every face. Clicks passed through, so the targets were invisible. At 480px the sheet started 22px above the window.
- **Repro:** `test/desktop/more-sheet.spec.js` failed before the fix (remote tiles overlapped the sheet; at 480px the sheet top was negative).
- **Fix:** entering a vote folds the sheet without changing the saved “keep More open” preference. The sheet’s height is capped to the space above the dock and scrolls inside that cap.
- **Proof:** the test passes on Chromium, Firefox, and WebKit. Screenshots: `test/desktop/shots/more-vote-before-1280.png`, `test/desktop/shots/more-vote-after-1280.png`, `test/desktop/shots/more-short-before-480.png`, `test/desktop/shots/more-short-after-480.png`.

### Tile moderation is hover-only

- **Who hits it:** a keyboard host who needs Mute for everyone on someone else’s tile.
- **What you saw:** `.modbar` was `display: none` until hover. The tile was not a tab stop. On a camera-off tile the full-screen button is hidden too, so there was no way in.
- **Repro:** `test/desktop/tile-keys.spec.js` failed before the fix (no `tabindex` on a remote tile).
- **Fix:** a remote tile is a tab stop. Focusing it shows the same moderation bar hover already showed, including Mute, and Tab reaches that button. The gallery geometry is unchanged.
- **Proof:** the test passes on Chromium, Firefox, and WebKit. Screenshots: `test/desktop/shots/tile-keys-before-1280.png` (bar hidden), `test/desktop/shots/tile-keys-after-1280.png` (bar open from the keyboard).

### Header said Just you while four people were on screen

- **Who hits it:** anyone in a room whose faces are up before each call has connected, and anyone reading the header on a laptop.
- **What you saw:** five tiles, and the pill said “Just you — send the invite…”. When the count was right, “5 in the meeting” shared one line with the quality and the password note, and the line ended in an ellipsis.
- **Repro:** `test/desktop/people-count.spec.js` failed before the fix (no `#statuscount`; the line was “Just you” with five tiles).
- **Fix:** the label counts every face on the wall, and it will not go below the mesh count. “5 in the meeting” is its own phrase and does not shrink. The quality and password notes follow it and may ellipsize.
- **Proof:** the test passes on Chromium, Firefox, and WebKit. Screenshots: `test/desktop/shots/people-count-before-1280.png`, `test/desktop/shots/people-count-after-1280.png`.

### Screen-name step was a blank field and two identical buttons

- **Who hits it:** anyone joining before this session has confirmed how they look.
- **What you saw:** an empty name field, no picture, and Not now and Continue in the same blue, touching each other. A GifOS name and avatar already on the computer were ignored.
- **Repro:** `test/desktop/appear.spec.js` failed before the fix (no `#appear`, the field was empty).
- **Fix:** the card says “This is how you'll appear”, prefills the GifOS name, shows the avatar (or an initial), and updates the preview as you type. Join is the blue primary. Not now is a white secondary, with space between them. Change picture is a separate text button. The knock waits until you choose. A session that already confirmed does not ask again.
- **Proof:** the test passes on Chromium, Firefox, and WebKit. Screenshots: `test/desktop/shots/appear-before-1280.png`, `test/desktop/shots/appear-after-1280.png`.

### The lobby, help, and shortcut list were English

- **Who hits it:** a German or Spanish device, before the call and inside Help or `?`.
- **What you saw:** “Meeting”, “How this meeting works”, and “Keyboard shortcuts”, after the dock had already been translated.
- **Repro:** `test/desktop/locale-long.spec.js` is the lock. A `de-DE` lobby now says “Besprechung”, help says “kein Größenlimit”, and the shortcut list says “Tastatur”.
- **Fix:** German and Spanish cover the lobby card, the meeting help, the broadcast and app help, and the shortcut list. English stays in the markup as the fallback. Settings stay English.
- **Proof:** the test passes on Chromium, Firefox, and WebKit. Screenshots: `test/desktop/shots/locale-lobby-before-1280.png`, `test/desktop/shots/locale-lobby-de-1280.png`, `test/desktop/shots/locale-lobby-es-1280.png`, `test/desktop/shots/locale-help-de-1280.png`, `test/desktop/shots/locale-keys-de-1280.png`.

### A large room had no roster

- **Who hits it:** a host with twenty people on the wall, trying to find who has a hand up.
- **What you saw:** the header said “21 in the meeting” and the tiles were the only list. Who still opens addresses, which is not a roll call.
- **Repro:** `test/desktop/roster.spec.js` failed before the fix (no `#roster`).
- **Fix:** the count is a button. It opens a white list of every face the header counts, with search, Hand, and Muted. Names wrap. The list scrolls and stops above the dock. Close puts it away.
- **Proof:** the test passes on Chromium, Firefox, and WebKit. Screenshots: `test/desktop/shots/roster-before-1280.png`, `test/desktop/shots/roster-after-1280.png`, `test/desktop/shots/roster-after-900.png`.

### The roster could not mute anyone

- **Who hits it:** a host in a large room who needs to mute one person for everyone.
- **What you saw:** Avery Chen’s row said “Muted” for their own mic, and there was no button. Mute for everyone lived on the tile, which is easy to miss once twenty faces are up.
- **Repro:** `test/desktop/roster-mute.spec.js` failed before the fix (Avery’s row had no `.mutebtn`).
- **Fix:** every other person has Mute on their row. It is the same room-wide mute as the tile. Mute is white. Unmute is the blue one, and the row says “For everyone” instead of their own “Muted”. Your own row has no button. In an admin room a guest sees no buttons. An open room can still mute, which is the rule the tiles already used.
- **Proof:** the test passes on Chromium, Firefox, and WebKit, and the twenty-person roster still passes. Screenshots: `test/desktop/shots/roster-mute-before-1280.png`, `test/desktop/shots/roster-mute-after-1280.png`, `test/desktop/shots/roster-mute-after-on-1280.png`.

### A broadcast never said whether you were on air

- **Who hits it:** the person running a church service, standing at the booth.
- **What you saw:** a dark page, “Joining the broadcast…”, and the same dock as a meeting. Nothing said the room could not see you, and nothing turned red when the camera went live.
- **Repro:** `test/desktop/on-air.spec.js` failed before the fix (no `#onair`).
- **Fix:** a broadcast shows a white Off air card until a picture is live. The host’s card names them and says to turn the camera on. On air is a red pill with their name, and it does not cover the dock. Watching someone else says Live, not On air. A normal meeting does not wear the lamp.
- **Proof:** the test passes on Chromium, Firefox, and WebKit. Screenshots: `test/desktop/shots/on-air-before-1280.png`, `test/desktop/shots/on-air-after-off-1280.png`, `test/desktop/shots/on-air-after-host-1280.png`, `test/desktop/shots/on-air-after-on-1280.png`.

### A broadcast had no order of service

- **Who hits it:** the volunteer running a church service from the booth.
- **What you saw:** Off air and On air, and nothing that said Welcome, then Song, then the message. The order lived on a paper.
- **Repro:** `test/desktop/rundown.spec.js` failed before the fix (no `#rundown`).
- **Fix:** the host sees Order of service: Welcome, Song, Prayer, Scripture, Message, Closing. Now is the large line. Next walks it. On the last step the button says Done, then the card says Ended and Start over. The place stays for this tab. A viewer does not see the card. It sits above the dock and does not cover the off-air card. A normal meeting does not show it.
- **Proof:** the test passes on Chromium, Firefox, and WebKit, and the on-air test still passes. Screenshots: `test/desktop/shots/rundown-before-1280.png`, `test/desktop/shots/rundown-after-1280.png`, `test/desktop/shots/rundown-after-song-1280.png`, `test/desktop/shots/rundown-after-900.png`.

### Settings stayed English

- **Who hits it:** a German or Spanish device, opening Settings from More.
- **What you saw:** the dock and the help were already translated, and the dialog still said “Settings”, “Video quality”, “Your name”, “Sound mix”, and “Conversation”.
- **Repro:** `test/desktop/settings-locale.spec.js` failed before the fix (a `de-DE` dialog said “Settings”).
- **Fix:** German and Spanish cover the settings title, video quality, name and picture, captions, sound mix, timing, and Close. English stays in the markup. Who, Share, and Vote are still English.
- **Proof:** the test passes on Chromium, Firefox, and WebKit, and the earlier locale test still passes. An English device still says “Settings”. Screenshots: `test/desktop/shots/settings-before-1280.png`, `test/desktop/shots/settings-after-de-1280.png`, `test/desktop/shots/settings-after-es-1280.png`.

### Stepping away was a tiny chip

- **Who hits it:** someone on a personal call who flips to another tab, and the friend who stays.
- **What you saw:** the only signal was an 11px “stepped away” chip on the tile, easy to miss, and coming back said nothing. The call was still there. It did not feel like it.
- **Repro:** `test/desktop/staying.spec.js` failed before the fix (no `.awaymark`, no `#still`).
- **Fix:** a friend who steps away gets a white Away on their tile, large enough to read, clear of their name and the dock. Coming back shows Still in the call. Tap it and it goes. It does not cover the dock. A hidden tab does not show that line until you return.
- **Proof:** the test passes on Chromium, Firefox, and WebKit. Screenshots: `test/desktop/shots/staying-before-1280.png`, `test/desktop/shots/staying-after-away-1280.png`, `test/desktop/shots/staying-after-back-1280.png`. A phone that kills the camera, and picture-in-picture, were not walked here.

### Chrome was English only

- **Who hits it:** anyone whose device is set to German or Spanish.
- **What you saw:** the join card, the dock, More, the people count, and chat all stayed in English.
- **Repro:** `test/desktop/locale.spec.js` failed before the fix (a `de-DE` browser still said “This is how you'll appear” and “Join”).
- **Fix:** German and Spanish cover the join card, the dock (including Weniger / Menos while More is open), the More rows and their actions, the people count, the password note on that line, and the chat title, privacy line, composer, and files note. `html lang` follows the device. English stays in the markup as the fallback. Help essays, the settings body, the lobby, and the shortcut list stay English.
- **Proof:** the test passes on Chromium, Firefox, and WebKit. Screenshots: `test/desktop/shots/locale-before-join-1280.png`, `test/desktop/shots/locale-after-join-de-1280.png`, `test/desktop/shots/locale-after-more-de-1280.png`, `test/desktop/shots/locale-after-join-es-1280.png`, `test/desktop/shots/locale-after-chat-de-1280.png`.

### A shared slide had no Stop, and the stage could stay blank

- **Who hits it:** a consultant putting a slide in front of a client.
- **What you saw:** Share screen sits in More, then a sheet that leads with “use Run app instead.” After the picker, the stage could stay empty until the mesh had a seat (a fast look saw no slide at all). The only stop on the picture was a 15px chip on the thumbnail: “you are sharing your screen — tap to stop.”
- **Repro:** `test/desktop/share-demo.spec.js` failed before the fix (`#stagefeed .stagestop` was missing, so the stop text was empty). WebKit is skipped; a canvas capture closes that tab.
- **Fix:** the slide is painted as soon as the capture starts, without waiting for a mesh seat. Stop sharing is a red button on the slide (16px, 40px tall). Tapping it clears the slide and the More row says Share screen again. The sheet and the More path are unchanged.
- **Proof:** the test passes on Chromium and Firefox. The slide was on screen in about 60ms, 1262×458, object-fit contain, above the dock. Screenshots: `test/desktop/shots/share-before-sheet-1280.png`, `test/desktop/shots/share-after-live-1280.png`.

### A client could not read whose screen was on stage

- **Who hits it:** someone presenting a deck, and everyone looking at that stage.
- **What you saw:** the line on the slide said “Your screen — on stage” at 10px. The share step’s title was 19px and Choose what to share was 13px, under a 13px note about Run app.
- **Repro:** `test/desktop/share-demo.spec.js` requires the stage line and the Choose button at 16px, and the title at 22px or more.
- **Fix:** the stage line is 16px. The share step title is 24px, the app note is 16px, and Choose what to share is 16px on the blue button. Stop sharing is unchanged. The path is still More, then the sheet, then the picker.
- **Proof:** the test passes on Chromium and Firefox. WebKit skips the canvas capture. Screenshots: `test/desktop/shots/share-sheet-before-1280.png`, `test/desktop/shots/share-sheet-after-1280.png`, `test/desktop/shots/share-label-before-1280.png`, `test/desktop/shots/share-label-after-1280.png`.

### Share screen was More, then a sheet, then the picker

- **Who hits it:** a consultant who wants the deck up in front of a client.
- **What you saw:** Share screen sat inside More. The next step was a sheet about Run app, and only then the browser’s picker.
- **Repro:** `test/desktop/share-demo.spec.js` failed before the fix (`#sharebtn` was inside `#barmore`). WebKit skips the canvas capture.
- **Fix:** Share screen is a labeled button on the dock, next to More. One click opens the picker. A second click, the red button on the slide, or the thumbnail stops it. Run app stays in More. The dock stayed on screen down to a 900px window (the button is 97px wide; the dock is 591px at 1280).
- **Proof:** the test passes on Chromium and Firefox, and the dock-word test passes on all three browsers. Screenshots: `test/desktop/shots/dock-share-before-1280.png`, `test/desktop/shots/dock-share-after-1280.png`.

### Starting a share left the menu on top of the slide

- **Who hits it:** a consultant who just put a deck on the stage for a client.
- **What you saw:** More stayed open over the faces and the bottom of the slide. On your own thumbnail the yellow line was clipped to a fragment (“on stage” took the row) and a click did not land, because that row ignores clicks.
- **Repro:** `test/desktop/share-demo.spec.js` failed before the fix (the bar was still open after the slide had pixels). WebKit is skipped; a canvas capture closes that tab.
- **Fix:** once the capture is actually showing, More folds. The saved “keep More open” choice is not rewritten. The thumbnail says Stop sharing, the same words as the button on the slide, and that chip takes the click. The path to start is still More, then the sheet, then the picker.
- **Proof:** the test passes on Chromium and Firefox. The chip measured 118px inside a 171px row. Screenshots: `test/desktop/shots/share-menu-before-1280.png`, `test/desktop/shots/share-menu-after-1280.png`.

### The host roster could mute, and nothing else

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

- **Who hits it:** a German or Spanish device, opening Who, Share, or Vote.
- **What you saw:** the dock and Settings were already in that language. These three sheets still said “Who is on this meeting”, “Share your screen”, and “Place a vote”.
- **Repro:** `test/desktop/sheets-locale.spec.js` failed before the fix (a `de-DE` Who sheet said “Who is on this meeting”).
- **Fix:** German and Spanish cover the Who title, the explanation, the group headings, the address lines, and Download. They cover the Share title, the app note, the two explanations, Choose, and Cancel. They cover Vote’s three choices and the line that appears while you are tapping faces. English stays in the markup. The file you download for the police stays English. Password, Invite, and Run app are still English.
- **Proof:** the test passes on Chromium, Firefox, and WebKit, and the earlier locale test and the English share demo still pass. Screenshots: `test/desktop/shots/sheets-before-who-1280.png`, `test/desktop/shots/sheets-before-share-1280.png`, `test/desktop/shots/sheets-before-vote-1280.png`, `test/desktop/shots/sheets-after-who-de-1280.png`, `test/desktop/shots/sheets-after-share-de-1280.png`, `test/desktop/shots/sheets-after-vote-de-1280.png`.

### Who, Share, and Vote still spoke English after you used them

- **Who hits it:** a German or Spanish device, hovering Who, Share, or Vote, or reading the line after a share starts or a vote lands.
- **What you saw:** the sheets were already in that language. The button tips still said “Who is on this meeting”, “Show the whole room”, and “Vote someone onto the stage”. The line after sharing or voting was English.
- **Repro:** `test/desktop/sheets-locale.spec.js` now requires the German and Spanish tips.
- **Fix:** those tips follow the device. So do “you are sharing”, “screen share stopped”, “vote recorded”, and “vote withdrawn”. The file you download for the police stays English. The Password and Invite sheets stay English.
- **Proof:** the test passes on Chromium, Firefox, and WebKit, and the English share demo still passes. Screenshot: `test/desktop/shots/sheets-tips-de-1280.png`.

### The slide still said “Your screen” on a German device

- **Who hits it:** a German or Spanish device, once a screen is on the stage, and anyone whose share died when they came back to the tab.
- **What you saw:** the sheets and the tips were already in that language. The line on the slide still said “Your screen — on stage”. The thumbnail still said “on stage”. Coming back showed “Your screen share stopped when you came back” and “Share again”.
- **Repro:** `test/desktop/share-demo.spec.js` failed before the fix (a `de-DE` stage line was “Your screen — on stage”). `test/desktop/sheets-locale.spec.js` failed on the return card. WebKit skips the canvas capture.
- **Fix:** the stage line, the “on stage” chip, and “sharing their screen” follow the device. So does the card that offers to share again, and the status line that uses the same sentence. English stays in the markup. The Password and Invite sheets stay English. The Who download for the police stays English.
- **Proof:** the stage-line test passes on Chromium and Firefox. The sheet test passes on all three. Screenshots: `test/desktop/shots/share-de-before-1280.png` (the English line), `test/desktop/shots/share-de-after-1280.png`, `test/desktop/shots/reshare-de-1280.png`.

### A phone that kills the camera said nothing

- **Who hits it:** someone on a phone whose system takes the camera while the call is in the background, then comes back.
- **What you saw:** the track had ended and the page did start the camera again, but the tile stayed blank and the line still read as if the camera were fine. Nothing on the picture said it had stopped.
- **Repro:** `test/desktop/phone-cam.spec.js` failed before the fix (no `.cambackmark`). WebKit skips the canvas capture. The walk is a 390×844 phone.
- **Fix:** while the camera is being brought back, the self tile says “Camera stopped — bringing it back”, large enough to read, inside the tile, clear of the name and the dock. When the new camera is live, the line goes. If the grab fails, the line says to tap Camera.
- **Proof:** the test passes on Chromium and Firefox, and the staying test still passes. Screenshots: `test/desktop/shots/phone-before-390.png`, `test/desktop/shots/phone-after-stopped-390.png`, `test/desktop/shots/phone-after-back-390.png`. A camera that stays “live” but sends black still waits on the existing watchdog before this line appears.

### A live camera that sends nothing stayed quiet

- **Who hits it:** a phone whose camera stays “live” but delivers no frames, the usual way a system takes the camera without ending the track.
- **What you saw:** the tile stayed blank for about nine seconds, until the restart. Nothing said the camera had stopped.
- **Repro:** `test/desktop/phone-cam.spec.js` (“a live camera that sends nothing”). The line is up while the camera has not been asked for again. WebKit skips the canvas capture.
- **Fix:** the first quiet sample says “Camera stopped — bringing it back” on the self tile. The restart still waits for three samples, so a dark room that is actually painting does not flash the line or restart the camera. German and Spanish cover the restart line.
- **Proof:** the test passes on Chromium and Firefox. Screenshots: `test/desktop/shots/phone-black-before-390.png`, `test/desktop/shots/phone-black-after-390.png`.

### A camera that dies while you are looking stayed dead

- **Who hits it:** a phone that takes the camera for a call or another app while the meeting stays on screen. The tab never goes to the background, so coming back never runs.
- **What you saw:** the track had ended. Four seconds later the picture was still frozen, the line never appeared, and the camera was not asked for again.
- **Repro:** `test/desktop/phone-cam.spec.js` (“while you are still looking”) failed before the fix (no `.cambackmark` after 7s, and the page was not hidden). WebKit skips the canvas capture. The walk is 390×844.
- **Fix:** the same watch that notices a silent camera now notices an ended one, on the next sample, while the page is open. It says “Camera stopped — bringing it back” and grabs again. A grab already in flight is not started twice. Three tries, then it stops. A dark room that is still painting is unchanged.
- **Proof:** the test passes on Chromium and Firefox, and the earlier phone tests still pass. The line was 20px and 193px wide, inside the tile, with the page still visible. Screenshots: `test/desktop/shots/phone-visible-before-390.png`, `test/desktop/shots/phone-visible-after-390.png`.

### A church song had no words, and no next line

- **Who hits it:** a volunteer running a service, on the Song step, who needs the line they are on and the line that comes after it.
- **What you saw:** the order of service said Song. There was no lyric, no Program, and no Preview.
- **Repro:** `test/desktop/lyrics.spec.js` failed before the fix (no `#lyrics`). A normal meeting and a broadcast viewer are covered too.
- **Fix:** while the order of service is on Song, the booth shows Program (the line to read now, 32px) and Preview (the next line, 18px). Next line walks the verse. The last line has an empty preview and Start over. Program, Preview, and Next line follow German and Spanish. The verse itself stays as written. A viewer does not see the card. The words are not drawn on the outgoing picture, and they are not sent to the other booth.
- **Proof:** the test passes on Chromium, Firefox, and WebKit, and the order-of-service test still passes. Screenshots: `test/desktop/shots/lyrics-before-song-1280.png`, `test/desktop/shots/lyrics-after-song-1280.png`, `test/desktop/shots/lyrics-after-last-1280.png`, `test/desktop/shots/lyrics-after-de-1280.png`.

### Program and Preview were labeled too small to trust

- **Who hits it:** a volunteer at the booth, during Song, choosing which line to read.
- **What you saw:** the lines were large, but the words Program and Preview were 13px. Easy to sing the next line.
- **Repro:** `test/desktop/lyrics.spec.js` requires both labels at 16px, the current line at 28px or more, and the next line smaller.
- **Fix:** Program and Preview are 16px. The current line stays 32px and the next line stays smaller. A viewer still does not see the card. The words are still not drawn on the outgoing picture.
- **Proof:** the test passes on Chromium, Firefox, and WebKit. Screenshots: `test/desktop/shots/lyrics-labels-before-1280.png`, `test/desktop/shots/lyrics-labels-after-1280.png`.

### On a short window the lyric card covered Off air

- **Who hits it:** a volunteer on a short laptop window, about 600px tall, during Song, still off air.
- **What you saw:** the lyric card climbed up from the dock and covered the bottom of Off air. The line to read and the on-air state were one stack.
- **Repro:** `test/desktop/lyrics.spec.js` failed before the fix at 1100×600 (`coversAir` was true). The program line stayed 32px.
- **Fix:** the card stops under Off air and scrolls. Program stays 32px and Preview stays smaller. At 1280×720 the card is still the full height, with no scroll. The words are still not on the outgoing picture.
- **Proof:** the test passes on Chromium, Firefox, and WebKit. At 1100×600 the card top was 328 and Off air ended at 300. Screenshots: `test/desktop/shots/lyrics-short-before-1100.png`, `test/desktop/shots/lyrics-short-after-1100.png`.

- **Who hits it:** anyone who taps a face and catches the blur control by mistake.
- **What you saw:** “Blur for all” was an 83×32 tab flush with the top-right corner of the tile.
- **Repro:** `test/desktop/blur-tile.spec.js` failed before the fix (the button was 83×32 and flush with the corner).
- **Fix:** it is a 64px square, 12px in from that corner, floating over the video. The name, full screen, and the tile menu stay at least 12px away. The words are still “Blur for all”. The same sizes are on the phone build.
- **Proof:** the test passes on Chromium, Firefox, and WebKit. Screenshots: `test/desktop/shots/blur-before-1280.png`, `test/desktop/shots/blur-after-1280.png`.

### The join step said Not now and Join

- **Who hits it:** someone opening a meeting link, looking at the name and picture they will show.
- **What you saw:** Not now kept the prefilled name. Join was the word for keeping it. Neither said what happened to the picture.
- **Repro:** `test/desktop/appear.spec.js`. Clear removes the stored name and picture. Save leaves both.
- **Fix:** Clear is the outline and blanks the name and the picture, then closes. Save is the solid blue button and keeps what is on the screen. German says Leeren and Speichern. Spanish says Limpiar and Guardar. The lobby’s own Join button is unchanged.
- **Proof:** the test passes on Chromium, Firefox, and WebKit, and the locale tests still pass. Screenshots: `test/desktop/shots/join-before-1280.png`, `test/desktop/shots/join-after-1280.png`.

### Alone, the header only told you to send the invite

- **Who hits it:** someone who just opened a room and is the only person in it.
- **What you saw:** the header said “Just you — send the invite; the link has no expiry”. Nothing there copied the link. Invite was still inside More.
- **Repro:** `test/desktop/alone-invite.spec.js` failed before the fix (no `#statusinvite`).
- **Fix:** while you are alone, Invite sits in the header. One click copies the link and, where the browser can share, opens share. The button says Copied. It does not open the longer Invite sheet, and it does not open the roster. When someone else is here, the button goes away. German says Einladen. The join card’s heading stays “This is how you’ll appear”. That card does not carry a second line, “This is how you’ll appear in the meeting.”
- **Proof:** the test passes on Chromium, Firefox, and WebKit, and the people-count test still passes. The button was 75×40 and blue. Screenshots: `test/desktop/shots/alone-invite-before-1280.png`, `test/desktop/shots/alone-invite-after-1280.png`.

### The in-call line talked like a product

- **Who hits it:** someone on a personal call, reading the line next to the people count.
- **What you saw:** with other people here it said “a password unlocks clear video”. German said “Passwort für klares Video”. Spanish said “contraseña para video nítido”.
- **Repro:** `test/desktop/locale.spec.js` failed before the fix (the line was “a password unlocks clear video”).
- **Fix:** the line says “faces stay soft until a password”. German: “Gesichter weich bis zum Passwort”. Spanish: “caras suaves hasta una contraseña”. At 900px the settled line is fully on screen. The dock is still a product.
- **Proof:** the test passes on Chromium, Firefox, and WebKit. Screenshots: `test/desktop/shots/warm-before-1280.png`, `test/desktop/shots/warm-after-1280.png`.

### The chat privacy line was 12px

- **Who hits it:** an older volunteer opening chat, trying to read why the messages disappear.
- **What you saw:** the line under Meeting chat was 12px: “· private to this meeting, gone when everyone leaves”. At 16px that sentence wrapped onto two lines.
- **Repro:** `test/desktop/chat-dock.spec.js` failed before the fix (the line was 12px).
- **Fix:** the line is 16px and one line: “Private. Gone when everyone leaves.” German: “Nur hier. Weg, wenn alle gehen.” Spanish: “Solo aquí. Se borra cuando salen.” It stays inside the panel at 900px and does not cover Close. Reactions is still an icon.
- **Proof:** the test passes on Chromium, Firefox, and WebKit. Screenshots: `test/desktop/shots/chat-priv-before-1280.png`, `test/desktop/shots/chat-priv-after-1280.png`.

### Share still needed the pointer

- **Who hits it:** someone presenting in a corporate call, who already uses Alt+A and Alt+V and expects the same for the screen.
- **What you saw:** Share screen was one dock button. The shortcut list had mic, camera, chat, and leave. Nothing started a share from the keyboard.
- **Repro:** `test/desktop/shortcuts.spec.js` failed before the fix (`#sharebtn` had no `aria-keyshortcuts`).
- **Fix:** Alt+S clicks Share screen. The same key stops a share that is already up. The shortcut list names it, in German and Spanish too. It stays quiet while you are typing, and it does nothing when the button is hidden. Hand and view still need the pointer.
- **Proof:** the test passes on Chromium, Firefox, and WebKit. Screenshots: `test/desktop/shots/share-key-before-1280.png`, `test/desktop/shots/share-key-after-1280.png`.

### Password and Invite stayed English

- **Who hits it:** a German or Spanish device, opening Password or Invite.
- **What you saw:** the button already said Passwort or Contraseña. The sheet still said “Room password” and “Share this meeting”. The tip still said “Lock this room with a password”. The form that makes a room you run still said “Room name”.
- **Repro:** `test/desktop/pw-inv-locale.spec.js` failed before the fix (a `de-DE` Password tip was “Lock this room with a password”).
- **Fix:** the password sheet, the locked-door words, the eye, and the invite sheet follow the device, including Copy, the warning, and the room-name form. The button tips follow too. English stays in the markup. Joining, leaving, and creating a room behave as before. Run app stays English. The Who download for the police stays English.
- **Proof:** the test passes on Chromium, Firefox, and WebKit. Screenshots: `test/desktop/shots/pw-inv-before-pw-de-1280.png`, `test/desktop/shots/pw-inv-before-inv-de-1280.png`, `test/desktop/shots/pw-inv-after-pw-de-1280.png`, `test/desktop/shots/pw-inv-after-inv-de-1280.png`.

### More was one unlabeled wall

- **Who hits it:** a volunteer opening More and hunting for Chat or Vote.
- **What you saw:** one grid of equal buttons, with no groups.
- **Repro:** `test/desktop/more-groups.spec.js` failed before the fix (no People / Room / Help headings).
- **Fix:** People, Share, Room, and Help are labeled rows. Host stays hidden until a host control is actually shown. “Turn video off” uses the same capitalization as the other labels.
- **Proof:** the test passes on Chromium, Firefox, and WebKit, and the vote and short-window tests still pass. Screenshots: `test/desktop/shots/more-groups-before-1280.png`, `test/desktop/shots/more-groups-after-1280.png`.

## Open

### WebKit crashes if a gallery tile plays a canvas captureStream

Opening four fake videos and then clicking More closed the WebKit tab. Chromium and Firefox play the streams. The test hook skips `captureStream` when `navigator.vendor` contains Apple and shows initials instead. Not a product bug for real cameras; it blocks this suite’s fake media on WebKit.

### First visit covers the call with the name dialog

With no saved confirmation for this session, joining shows how you will appear: your GifOS name and picture, editable. Save keeps them. Clear blanks both. A session that already confirmed skips the card.

### More sheet is a dense grid of mixed labels

More opens to Hand, Invite, and Help. All tools shows Who, Run app, Vote, Password, Stage, Record, Captions, Settings, Keys, and Transcript. Captions is also on the dock. Each of those has a key, including while All tools is folded. Host tools stay hidden until there is a host, and those bulk tools still have no key. The full list, once opened, is still long.

### Invite, Leading, and Full screen on the app bar stay English

Save, Steal, Hide, and Talk follow a German or Spanish device. Invite, Leading, and Full screen on that bar still appear in English.

### Status line is easy to lose

“5 in the meeting” used to be one ellipsized sentence, and four faces whose calls had not connected yet still read “Just you”. The count is now its own uncut phrase, it includes every face on the wall, and it opens the roster. The quality and password notes may still trail off.

### Not yet walked end to end

Self-view placement is not in this pass. Reactions says the word. The gallery packs equal tiles and stops above the dock. A shared slide fills the stage and Stop sharing sits on it. Share screen is one button on the dock, Alt+S does the same thing, and one click opens the picker. The stage says whose screen it is, at 16px, and that line follows German and Spanish. A broadcast says off air and on air, and the booth has an order of service. During Song the booth has Program and Preview. On a short window that card stays under Off air. Those words stay on this computer. They are not on the outgoing picture. The roster can mute someone for everyone, hold a new arrival until Admit, rename them, and spotlight them. The waiting room is a sealed lobby: until Admit the person waiting sees and hears no one, and no one hears them. Who, Share, Vote, Password, Invite, the Run app sheet, the Who download, signing in as admin, Stop app, Turn chat off, and Save, Steal, Hide, and Talk follow German and Spanish, including the tips and the line after you share or vote. Invite, Leading, and Full screen on the app bar stay English. Stepping away shows Away, and coming back says you are still in the call. A phone that ends the camera says so on your tile and brings it back, including when the page never goes to the background. A camera that stays live and sends no frames says so on the first quiet sample. A camera that paints pure black says so on the first sample. A dim room that is still sending frames is never restarted.
