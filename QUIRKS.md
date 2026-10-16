# Desktop Meet UI quirks

Role-play pass on the desktop meeting (`run.html`) at 1280×720, 1920×1080, a 2560×1440 display at 1.5×, and a 900px window, including a live shrink. Same room, four simulated participants (canvas video on Chromium and Firefox; initials on WebKit, which kills the tab if a tile plays `captureStream`). Browsers: Chromium, Firefox, WebKit.

Personas in progress: consultant with a screen share, keyboard-only power user, host of a large room, someone tabbing away on a slow laptop, a non-English locale.

## Fixed

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

## Open

### WebKit crashes if a gallery tile plays a canvas captureStream

Opening four fake videos and then clicking More closed the WebKit tab. Chromium and Firefox play the streams. The test hook skips `captureStream` when `navigator.vendor` contains Apple and shows initials instead. Not a product bug for real cameras; it blocks this suite’s fake media on WebKit.

### First visit covers the call with the name dialog

With no saved name, a modal asks for a screen name while the meeting is already up. It sits over the dock (`z-index` 40) and swallows clicks until Not now or Continue. The knock does not wait on it, which is right; the dialog still hides the controls.

### More sheet is a dense grid of mixed labels

Who, Invite, Run app, Share screen, Password, Vote, Hand, Chat, Record, CC, Stage, Settings, Keys, Help, plus blur. “Turn Video off” is the odd capitalization. The sheet now folds when a vote starts and scrolls inside a short window; the list itself is still a wall.

### Chrome is English only

Captions already follow the device language. The lobby, dock, and chat do not. A German or Spanish locale still reads English, and longer translations are untested because there are no translations.

### Status line is easy to lose

“5 in the meeting” used to be one ellipsized sentence, and four faces whose calls had not connected yet still read “Just you”. The count is now its own uncut phrase and includes every face on the wall. The quality and password notes may still trail off. There is still no roster list.

### Not yet walked end to end

Screen-share sheet for the consultant, a 20-person roster, tab-hide/return on a throttled page, and a non-English locale overflow pass. Those are next. Gallery packing, self-view placement, and the reactions icon are not in this pass.
