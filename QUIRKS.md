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

## Open

The build name is a faint line under the header. A green round "A" in Nathan's shot did not appear in the Playwright capture.

## Personas (what was actually tried)

- Grandparent, iPhone SE, text link `#v=qa-mobile-sunday`, no saved name. Name dialog appears, typing works, Continue enters the call. More opens. Keyboard coverage of that dialog was only simulated with `--kb`, which the page ignores.
- Exec, Pixel 7, portrait then a landscape resize. Mic and camera toggled. More opened. Dock fits on this phone; landscape More was not the SE failure but the sheet is the same unscrollable panel.
- Teen, iPhone 15, eight fast taps across mic, camera, reactions, and More. No crash. Reactions icon was not changed.
- Low vision, 360px, root font 32px. Dock and More captured.
- Host, iPhone SE landscape. More opened, Password tapped with `force: true` because the button is off screen. Password sheet shot saved.
- Chat, iPhone SE. Opened from More. Composer tap blocked by the dock.

Four faces are real peer records (`__gifosVideo.presentPeers`), not cloned tiles. The gallery packer was not edited.
