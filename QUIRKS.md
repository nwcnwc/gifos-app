# Meet mobile quirks

Branch `cursor/qa-meet-mobile`, measured against `run.html` on release/0.9.23.
Playwright Chromium, touch, fake camera/mic. Devices: iPhone SE (320×568 and landscape), iPhone 15, Pixel 7, a 360×740 Android phone, portrait and landscape.

Shots from the first pass live in `qa/mobile/shots/before-*.png`. The probe that produced the numbers is re-runnable with `NODE_PATH=/tmp/qa-pw/node_modules node qa/mobile/audit.js` while `python3 -m http.server 8765` serves the repo. `qa/mobile/audit.js` is the persona walk; the geometry numbers below were confirmed with a second pass over the same page.

Gallery packing, the self-view/stage placement, and the reactions icon are left alone. Other people own those.

## Fixed

None yet. This commit is the baseline log.

## Open

### 1. Hang up is off the screen on a narrow phone

iPhone SE portrait and the 360px Android phone. The dock is `flex-wrap: nowrap` with a max width, and the buttons refuse to shrink (`min-width: 56px`, leave `64px`). The bar's scroll width is 366px. On the SE the bar is only 304px wide, so Hang up starts at x=310 and ends at x=374, past the 320px edge. On the 360px phone it ends at x=374, past the edge. iPhone 15 (393px) and Pixel 7 fit.

A grandparent, an exec, and a teen all lose the control that ends the call. The drag grip is 22×48, under a 44px target, on every phone measured. Fit is 59×32, also under 44px tall.

Shot: `qa/mobile/shots/before-grandparent-call.png`.

### 2. Landscape More sheet hangs off the top and does not scroll

iPhone SE landscape (568×320). The sheet is `bottom: 102px`, about 398px tall, `overflow-y: visible`. Its top is at y=-194. Blur, Who, Float, Invite, Run app, Share screen, and Password are entirely above the screen. Vote and below are visible. A host turning the phone sideways cannot set a password or invite. There is no scroll.

Shot: `qa/mobile/shots/before-host-more-land.png`.

### 3. Chat composer sits under the dock

iPhone SE portrait. Chat is a full-width panel (`z-index: 30`) pinned to `bottom: 0`. The dock is `z-index: 32` and covers y=466–554. The message field occupies y=526–560, so the dock eats it. Playwright's tap on `#chat-in` times out: "div.bar intercepts pointer events". Send is 34px tall. Close is 23px tall. Setting `--kb` does nothing today; the page never reads the visual viewport, so a soft keyboard covers the field a second time on iOS (Chrome's `interactive-widget=resizes-content` is not what Safari does).

Shot: `qa/mobile/shots/before-chat-dock.png`.

### 4. Lobby hides Join on a small phone

Cold open, no room in the link. The preview takes `minmax(140px, 1.15fr)`.

- iPhone SE portrait: preview 304px, Join a link sits at y=579–661, below the 568px screen. Rename is further down.
- iPhone SE landscape: Start, the admin button, and Join are all below y=320. The first action is already clipped.
- 360×740 portrait: the three actions fit; "change" name is at y=851, off screen.

A first-time grandparent who opens the app instead of a room link cannot see Join without knowing the card scrolls.

### 5. 200% text size does not enlarge the controls

`gifos_ui_scale=2` sets the root to 32px. More-sheet labels stay `font-size: 16px` (`#ccbtn` measured 16px). The sheet does not grow and does not scroll. A low-vision member gets bigger body type and the same small CC / Record / Password labels.

Shot: `qa/mobile/shots/before-lowvision-more.png`.

### 6. No safe-area insets

The viewport meta is `width=device-width, initial-scale=1.0, interactive-widget=resizes-content`. It has no `viewport-fit=cover`. The dock uses `bottom: 14px` and the top chip uses `top: 14px`, with no `env(safe-area-inset-*)`. On a notched phone in Safari those insets stay 0 until `viewport-fit=cover` is set, and even then the dock is not padded. Not yet proven with a live inset (the CDP probe did not finish this pass).

### 7. Words a volunteer will not know

The captions control says "CC". The people list says "Who". Both are real controls; the labels are the gap versus Meet, Teams, and a church stream tool, where the same jobs say Captions and People.

## Personas (what was actually tried)

- Grandparent, iPhone SE, text link `#v=qa-mobile-sunday`, no saved name. Name dialog appears, typing works, Continue enters the call. More opens. Keyboard coverage of that dialog was only simulated with `--kb`, which the page ignores.
- Exec, Pixel 7, portrait then a landscape resize. Mic and camera toggled. More opened. Dock fits on this phone; landscape More was not the SE failure but the sheet is the same unscrollable panel.
- Teen, iPhone 15, eight fast taps across mic, camera, reactions, and More. No crash. Reactions icon was not changed.
- Low vision, 360px, root font 32px. Dock and More captured.
- Host, iPhone SE landscape. More opened, Password tapped with `force: true` because the button is off screen. Password sheet shot saved.
- Chat, iPhone SE. Opened from More. Composer tap blocked by the dock.

Four faces were painted with canvas `captureStream` through the existing `GifOS.meetViews.apply` packer so the call was not a solo tile. That packer was not edited.
