# Broadcast desktop UI quirks

Desktop pass on the Broadcast app, which is `run.html` wearing `#bc=1` (the Meeting page’s broadcast skin). Branch `cursor/qa-broadcast-desktop` off `release/0.9.23`.

Driven locally with Playwright in Chromium, Firefox, and WebKit. Viewports: 1280×720, 1920×1080, a 900×720 window, and live resizes between them. Personas: webinar producer, keyboard-only user, full-screen viewer, busy-chat moderator, someone who joins and leaves.

Geometry below is from `getBoundingClientRect` in Chromium unless a browser is named. Screenshot descriptions from a vision pass were checked against pixels; where they disagreed, the pixels won.

## Fixed

None yet.

## Open

### Q1. Chat composer slides under the control dock at 900px — worst

Moderator persona. Broadcast session (`#mb=1&v=…&av=…&bc=1`), More → Chat, viewport 900×720.

The floating dock (`.bar`, 104px tall, 14px off the bottom) overlaps `#chatform` by **122×37px**. `#cattach` is covered **41×28px**. `#chat-in` is covered **65×28px**. Send is clear of the dock horizontally.

Same overlap after a live resize from 1920×1080 down to 900×720. The panel is `bottom: 0` while the dock was moved to the bottom and `--barh` is hardcoded to `0px`, so nothing lifts the composer.

Reproduced in the layout probe on Chromium. Firefox and WebKit share the same CSS. Screenshot: `test/e2e/artifacts/chat-900-before.png`.

### Q2. A broadcast still talks like a meeting

On a page with `body.broadcast`, `#paneltitle` reads **“Meeting chat”**. The leave button title is “Leave the meeting…”. The More toggle’s open label is “Hide meeting controls”. Help still titles itself “How this meeting works”.

The lobby is renamed Broadcast. The room is not. A church volunteer and a corporate producer both get the wrong product name mid-show.

### Q3. No Live / Watching state

StreamYard, YouTube Live, and church streaming tools put a persistent on-air mark in the chrome. Broadcast’s only status is the top chip (`#status`), which is `nowrap` + ellipsis. There is no Live pill for the host and no Watching pill for a viewer.

### Q4. More sheet can leave the viewport

`#barmore` is `overflow: visible` and anchored `bottom: 122px` with no `max-height`. At 1280×500 the sheet’s top is **−2px** (chrome clipped, buttons still inside). Shorter live-resizes clip controls with no way to scroll to them. Escape does close the sheet (handled). Not the worst item at 720px tall, but it fails the resize pass.

### Q5. Primary dock controls are icon-only

Mic, camera, reactions, and More are circles with an accessible name and no visible word. Zoom, Meet, and Teams label Mute and Video on desktop. A volunteer or an older member has to hover (the `title`) to learn the control. The off state is a dark-red glyph on a light-gray circle, not the filled red mute button those apps use, so “you are muted” is easy to miss.

### Q6. No mute / camera keyboard shortcuts

The key handler covers Escape and modal Tab. There is no M / V (or any other) shortcut for mic and camera. Meet and Zoom both have one. A keyboard-only producer cannot mute without tabbing to the dock.

### Q7. Reactions and More occupy the same slot

`#reacttray` and `#barmore` are both `left: 50%; bottom: 122px`. Opening one does not close the other, so the trays stack.

### Q8. Guest tile tools are hover-first

`.tile .modbar` is `display: none` until `:hover`, `.menu`, or `:focus-within`. The tile root is not focusable; the full-screen button on the tile is. A keyboard user can reach moderation only by landing on that button. Fine pointer users never see ban / blur / allow-share until they hover.

### Q9. Lobby copy is one voice for three audiences

Broadcast lobby (1280 and 1920, card on screen; pixels confirm a white card on the right at 1920): “Start broadcasting” is clear. The second step is still “Host password — yours alone — do not share it” plus an optional viewer password. That is correct for a locked corporate webinar and heavy for a family hangout or a volunteer starting a Sunday stream. Screenshots: `test/e2e/artifacts/lobby-broadcast-1280.png`, `test/e2e/artifacts/lobby-broadcast-1920.png`.

Password-label contrast on the white card measured **16.8:1** (head) and **5.1:1** (note). Not a contrast bug.

### Q10. Full-screen control is a bare glyph

Stage and gallery tiles expose full screen as `⛶` (`title` / `aria-label` “Full screen”). It is always painted, not hover-only. A big-monitor viewer can tab to it. The glyph is easy to miss next to the name plate, and a broadcast viewer has no separate “watch full screen” control in the dock.

## How a session was opened without a relay

`run.html#mb=1&v=<room>&av=<16+ hex>&bc=1` adds `body.meet-session` and `body.broadcast` without knocking the network. Hash-only navigations do not re-run boot; tests must load that URL as a full navigation.
