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

### Chrome was English only

- **Who hits it:** anyone whose device is set to German or Spanish.
- **What you saw:** the join card, the dock, More, the people count, and chat all stayed in English.
- **Repro:** `test/desktop/locale.spec.js` failed before the fix (a `de-DE` browser still said “This is how you'll appear” and “Join”).
- **Fix:** German and Spanish cover the join card, the dock (including Weniger / Menos while More is open), the More rows and their actions, the people count, the password note on that line, and the chat title, privacy line, composer, and files note. `html lang` follows the device. English stays in the markup as the fallback. Help essays, the settings body, the lobby, and the shortcut list stay English.
- **Proof:** the test passes on Chromium, Firefox, and WebKit. Screenshots: `test/desktop/shots/locale-before-join-1280.png`, `test/desktop/shots/locale-after-join-de-1280.png`, `test/desktop/shots/locale-after-more-de-1280.png`, `test/desktop/shots/locale-after-join-es-1280.png`, `test/desktop/shots/locale-after-chat-de-1280.png`.

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

With no saved confirmation for this session, joining shows how you will appear: your GifOS name and picture, editable, then Join. Not now keeps the prefilled name. A session that already confirmed skips the card.

### More sheet is a dense grid of mixed labels

Who, Invite, Hand, and Chat sit under People. Vote, Password, Stage, Record, CC, and Settings sit under Room. Run app is under Share. Keys and Help are under Help. Host tools stay hidden until there is a host. “Turn video off” matches the other labels. The list is still long.

### Settings were still English

The lobby, the meeting help, the broadcast help, the shortcut list, and Settings follow a German or Spanish device. Who, Share, and Vote do not. Captions already followed the device language.

### Status line is easy to lose

“5 in the meeting” used to be one ellipsized sentence, and four faces whose calls had not connected yet still read “Just you”. The count is now its own uncut phrase, it includes every face on the wall, and it opens the roster. The quality and password notes may still trail off.

### Not yet walked end to end

Screen-share for the consultant and tab-hide/return. Gallery packing, self-view placement, and the reactions icon are not in this pass. A broadcast says off air and on air, and the booth has an order of service. There are still no lyrics and no program versus preview. The roster can mute someone for everyone. Waiting room, rename, and spotlight are still missing. Who, Share, and Vote stay English.
