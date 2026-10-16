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

## Open

### WebKit crashes if a gallery tile plays a canvas captureStream

Opening four fake videos and then clicking More closed the WebKit tab. Chromium and Firefox play the streams. The test hook skips `captureStream` when `navigator.vendor` contains Apple and shows initials instead. Not a product bug for real cameras; it blocks this suite’s fake media on WebKit.

### Dock controls are icon-only

Mic, camera, reactions, More, and Leave have no visible words. Titles exist, so a pointer user can hover. A keyboard user and an older volunteer cannot tell Mute from Camera without guessing. Reactions icon is left to the other owner.

### No keyboard shortcuts

Alt-style mute, camera, chat, and leave are not implemented. A power user cannot run the call without the pointer. Focus rings exist on buttons.

### First visit covers the call with the name dialog

With no saved name, a modal asks for a screen name while the meeting is already up. It sits over the dock (`z-index` 40) and swallows clicks until Not now or Continue. The knock does not wait on it, which is right; the dialog still hides the controls.

### Tile moderation is hover-only

`.tile .modbar` is `display: none` until hover, `.menu`, or `:focus-within`. The tile itself is not in the tab order, so the buttons inside never become reachable from the keyboard.

### More sheet is a dense grid of mixed labels

Who, Invite, Run app, Share screen, Password, Vote, Hand, Chat, Record, CC, Stage, Settings, Help, plus blur. “Turn Video off” is the odd capitalization. At 900×720 the grid fit; it has not been proven to clip at short heights with every admin button visible.

### Chrome is English only

Captions already follow the device language. The lobby, dock, and chat do not. A German or Spanish locale still reads English, and longer translations are untested because there are no translations.

### Status line is easy to lose

“Just you — send the invite…” and “5 in the meeting · 360p · a password unlocks clear video” live in a pill that ellipsizes. A host scanning a large room does not get a dedicated people count that stays put.

### Not yet walked end to end

Screen-share sheet for the consultant, a 20-person roster, tab-hide/return on a throttled page, and a non-English locale overflow pass. Those are next. Gallery packing, self-view placement, and the reactions icon are not in this pass.
