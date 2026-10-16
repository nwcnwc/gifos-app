# Broadcast desktop UI quirks

Desktop pass on the Broadcast app, which is `run.html` wearing `#bc=1` (the Meeting page’s broadcast skin). Branch `cursor/qa-broadcast-desktop` off `release/0.9.23`.

Driven locally with Playwright in Chromium, Firefox, and WebKit. Viewports: 1280×720, 1920×1080, a 900×720 window, and live resizes between them. Personas: webinar producer, keyboard-only user, full-screen viewer, busy-chat moderator, someone who joins and leaves.

Geometry below is from `getBoundingClientRect` in Chromium unless a browser is named. Screenshot descriptions from a vision pass were checked against pixels; where they disagreed, the pixels won.

## Fixed

### Q1. Chat composer slides under the control dock at 900px

The chat panel now keeps a band clear of the dock (`padding-bottom: 128px`, `112px` when the dock is the shorter phone size). At 900×720 the composer ends at y=592 and the dock starts at y=602, so attach, the message field, and send are all clear. The same holds after a live resize from 1920×1080 to 900×720.

Permanent repro: `test/e2e/broadcast-desktop.spec.js` (“chat composer stays clear…”). Passed on Chromium, Firefox, and WebKit. Before: `test/e2e/artifacts/chat-900-before.png`. After: `test/e2e/artifacts/chat-900-after.png`.

### Q2. A broadcast still talks like a meeting

`paintBroadcastChrome()` rewrites the in-room words when `body.broadcast` is set: chat title, privacy line, leave button, leave dialog, Help, Who, record, invite, and pinned files. A plain meeting stays “Meeting chat” / “Leave the meeting?”. Switching the chat panel to the transcript and back restores “Broadcast chat”, not “Meeting chat”.

### Q3. No Live / Watching state

The top chip now carries `#onair`. A host (stored admin key, or signed-in admin) sees a filled red **Live** pill. Everyone else in the broadcast sees **Watching**. Meetings hide the pill. It stays inside the viewport at 1280 and at 900. Screenshots: `test/e2e/artifacts/onair-live-1280.png`, `test/e2e/artifacts/onair-watching-900.png`.

Both are in `test/e2e/broadcast-desktop.spec.js` and passed on Chromium, Firefox, and WebKit.

## Open

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
