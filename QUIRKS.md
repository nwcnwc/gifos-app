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

## Open

There is still no waiting-room admit list for a host.

## Personas (what was actually tried)

- Grandparent, iPhone SE, text link `#v=qa-mobile-sunday`, no saved name. Name dialog appears, typing works, Continue enters the call. More opens. Keyboard coverage of that dialog was only simulated with `--kb`, which the page ignores.
- Exec, Pixel 7, portrait then a landscape resize. Mic and camera toggled. More opened. Dock fits on this phone; landscape More was not the SE failure but the sheet is the same unscrollable panel.
- Teen, iPhone 15, eight fast taps across mic, camera, reactions, and More. No crash. Reactions icon was not changed.
- Low vision, 360px, root font 32px. Dock and More captured.
- Host, iPhone SE landscape. More opened, Password tapped with `force: true` because the button is off screen. Password sheet shot saved.
- Chat, iPhone SE. Opened from More. Composer tap blocked by the dock.

Four faces were painted with canvas `captureStream` through the existing `GifOS.meetViews.apply` packer so the call was not a solo tile. That packer was not edited.
