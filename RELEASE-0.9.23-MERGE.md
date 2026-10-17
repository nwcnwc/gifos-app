# release/0.9.23 and release/0.9.24 — stray-branch merge log

Written by the merge agent on 2026-10-16/17 (PDT). Everything below was done in a
fresh clone with origin = GitHub (nwcnwc/gifos-app). No PRs, no CI dispatch, no
pushes to main, no force pushes. Tests ran locally (unit scripts, the two desktop
Playwright suites, the f3b0 browser gates, the phone node scripts).

## Rulings kept (checked by hand and by the suites)

- Meetings are always transcribed. CC only shows or hides captions on this
  screen (`gifos_cc_view`). No "transcribing" tile tag, no room-wide switch.
- The LIVE pill is Broadcast only. A regular meeting never shows it.
- Dock labels stay (Video, Unmute/Mute, React, Invite, Chat, CC, Share, More,
  Leave). The header has no second Unmute.
- The header is an Invite button when you are alone (phone and desktop).
- A bot is a full-size gallery tile with a bot badge, not a corner stamp.
- The bot's voice comes from app/host-injected providers (081f design); the
  host-voice/mbv2 path was not revived.
- Broadcast lamp: Watching for a viewer, Live only while the camera/mic sends,
  Off air otherwise (docs/broadcast-vs-meet-intent.md).

When branches disagreed, the newer commit's behaviour won and both sets of
fixes were kept.

## Round 1 — merged into release/0.9.23 (in order)

| branch | tip merged | result |
|---|---|---|
| cursor/meet-capability-081f | b26d57e | already an ancestor (no-op merge recorded) |
| cursor/meetbot-081f-merged | bba52be | merged (52273d7) |
| cursor/meetbot-host-ops | 7914474 | superseded by meetbot-081f-merged; `-s ours` with the unique bits checked (be51f8b) |
| cursor/mbv2-live-caption | 44a833e | superseded by meetbot-081f-merged; `-s ours` (59efd56) |
| cursor/reactions-smiley-pin-header | 7ae8c49 | merged (5d0e045) |
| cursor/meet-selfview-stage | 1b9da0c | merged (f064f06) |
| cursor/meet-gallery-fit-scroll | efd6e5b | merged (41740d2) |
| cursor/broadcast-confirmed-design-f3b0 | c43afbc | merged (0079f4e); contains broadcast-role-controls-f3b0 90ce95c and avatar-rides-video-f3b0 e22efc5 |
| cursor/qa-broadcast-desktop | 40309fd | merged (1c46585) |
| cursor/desktop-watching-gaps-f3b0 | 3c2e94c | merged (36af039) |
| cursor/watching-viewer-no-av-f3b0 | ce9ff24 | merged (b6c84fe) |
| cursor/qa-meet-desktop | 9c58075 | merged (884f5c0) |
| cursor/qa-meet-mobile | 88a3f3c | merged (see round 1 commit below) |

Watchdog branches: none exist on origin. Join-sheet / header-invite / subtitle
branches: none exist as branches; that work is in cursor/qa-meet-mobile commits
(1fc429b, 65735a5, 1b6cc97) and is included.

### Conflicts and how they were resolved

- **run.html** (hundreds of hunks across the merges). Base = the merged
  Broadcast chrome (qa-broadcast-desktop + f3b0 roles). Duplicates produced by
  the auto-merge were unified: one `paintOnAir`, one `ensureName`
  (`#appear-modal`), one set of dock buttons, one More sheet, one caption
  switch (`ccShow`), `paintCcButtons()` delegating to `paintCcView()`.
- **Captions**: the phone branch's "always transcribe, CC is local" ruling
  replaced the room-wide `ccByOrder` switch; `syncSpeech` hears the room when
  `myStatus.cc || myStatus.scribe`.
- **Status chip**: desktop keeps `countText`/`restText` ("Just you", "N in this
  small group", Broadcast sentences); phones override to "room · N in call" and
  the Invite button when alone. `setStatus` writes into the children instead
  of wiping them.
- **Dock**: phone dock = Video, Mic, React, More, Leave; Invite/Chat/Share/
  Room password/Record/Waiting room move into a first More row
  (`placeDockForWidth`). Desktop keeps the full dock. CC dock button and Full
  screen are hidden on phones.
- **Who/People**: phones get the names list with state; desktop keeps the
  grouped address list and the trust paragraph from 884f5c0.
- **Waiting room**: the button shows for the admin or in any room without an
  admin (`mayHold`), sits in the Room row on desktop.
- **Chat**: the phone branch's reply/react/time/find/mentions/emoji kept, plus
  the Prayer flag from qa-broadcast-desktop. On phones Prayer and Attach are
  44px icon buttons so the field keeps its width at 200% text; the landscape
  chat header stays on one line while the keyboard is up.
- **Lobby**: on phones the lobby scrolls, the links keep 8px between them, and
  at a large text size the title shrinks and the Start subtitle hides so Start,
  Join and the admin link stay on screen (iPhone SE at 200%).
- **Record sheet**: at a large text size on a phone the device note hides so
  Start recording and Cancel stay on screen.
- **js/meet-layout.js**: viewBox takes `top`/`bottom`/`dock` from opts (phone
  defaults kept), bots are full tiles (`withBots` identity).
- **js/meet-pack.js**: skinny + phone aspect cap (1.05), `stripFloor`/`splitBoxes`
  with phone args, `placeStage(…, phone)`, `phoneFit` for short landscape,
  `MIN_SIDE.phone = 96`, exports widened.
- **js/meet-views.js**: toggles both `can-scroll` and `comfy-scroll`; passes
  top/bottom to viewBox.
- **QUIRKS.md / BENCHMARK.md**: add/add conflicts, sections concatenated with
  HTML comment separators (nothing dropped).
- **Unclosed CSS media block** found in the merged run.html and closed; a
  duplicate phone CSS block (second `#still`, on-air card, rundown, lyrics)
  removed.
- **WebKit freeze at a dozen tiles** (found by the desktop roster test on
  WebKit, bisected with CSS and API stubs): the phone branch's "Blur for all"
  square carried `backdrop-filter: blur(12px)` on every tile. WebKit stops its
  rendering updates for good (no requestAnimationFrame ever fires again) once
  about twelve exist. The frost is now a plain translucent fill. While
  bisecting, the per-seat avatar canvas streams from avatar-rides-video-f3b0
  were made shared (one stream per letter, refcounted) and capped at six, with
  the letter overlay standing in past the cap. Both changes are in run.html.
- **Firefox status line**: on a wide window the status span is a flex row
  again (as on the qa-meet-desktop tip) so `#statusrest` is a block with a
  real client width; as an inline element Firefox reported scrollWidth with
  clientWidth 0 and the locale test's overflow check could not pass there.
  Phones keep the plain chip, which truncates as the phone header test
  expects.
- **Phone name cap**: `body.comfy .tile .name` from the desktop branch
  outranked the phone cap that keeps the name clear of the 44px Full screen
  button; the phone rule now carries the higher specificity.
- **Tests adapted to the merged chrome** (not loosened): appear modal id,
  Video/Share/Unmute labels, "in this small group", on-air lamp class/words,
  Raise hand / Step on stage wording, `#left-modal` after Leave, waitbtn →
  recbtn in More rows, lob-rename → lob-face, meet-icons accepts the emoji face.

### Test results, round 1 (merged tree, Chromium 1248, Playwright 1.64.1)

FILL_ROUND1

`~/.local/bin/rules-check` (non-strict): every WARN is on lines the merged
branches added (new phone test scripts and qa/mobile/audit.js with their own
timeouts and `process.exit`, a 6 s status-bar hide, a 0 ms socket kick) plus one
renamed selector in test/mobile/appear-preview.js with the same 15 s timeout. No
test was skipped and no existing time bound was loosened.

## Round 2 — the active branches moved while round 1 ran

Round 1 was committed as 2743bd1 and pushed. Nathan paused the job at 22:09
PDT on 16 Oct until the QA loops finished their queued items, and lifted the
pause at 01:23 PDT on 17 Oct with a steering note (no Co-Authored-By lines,
keep cursor/stale-peer-ui, fold turn-video-anywhere into 0.9.24, leave
relay-lockdown and workers-turnstile alone).

| branch | tip merged | commit | notes |
|---|---|---|---|
| cursor/meetbot-081f-merged | c483f78 | 09dd77d | bot voice on every main audio sender, speaking outline, bot as a gallery tile. Layout hunks kept this tree's viewBox/self-view packer; the speaking-frame CSS joined the float self-view rules. test/unit/meet-bot-voice.js got BROADCAST/bcRole and TURN-mix stubs in its lifted world. |
| cursor/stale-peer-ui | 1966f9b | FILL_SPU | frozen-peer fixes on top of the 0.9.24 TURN commits (so release/0.9.23 now carries js/meet-turn.js and the free-audio pool, as the steering asked). js/mesh.js: s1told map kept with bindOcc; the s1keys loop gained `!this.s1Told(k)`. run.html: Reconnecting chip + this tree's paintAwayMark; `reconnecting` tile class; displayCount floors at 1 + shownPeerCount and headerCount still takes the faces on the wall; updateStatus keeps the phone/Broadcast chrome and gains the inline `heard-not-seen` note and `turn-unavailable`; kickMain skips `p.turnAudio`. A private test path was dropped from a mesh.js comment (public repo). |

FILL_ROUND2B

### gifos test repo (nwcnwc/gifos, private)

Fresh clone under the job folder with `../gifos-app` linked to this checkout.
- release/0.9.23: merged cursor/stale-peer-ui (0cb3b12e) and adapted its two
  lifted-world repros to the merged page (43abdcf1: banned-seat set, link
  params, chip children `#statuscount`, headerCount/facesOnScreen lifted).
  Pushed.
- release/0.9.24: merged cursor/stale-peer-ui (1176f393; test/sim/mesh.cpp
  kept the NETSEAT greeter pick and added the s1Told guard), carried the same
  test adaptation (afd19af2), merged origin/turn-video-anywhere 233fcc31
  (0eb14619, clean). Pushed.
- Repro results against this app tree: meet-ghost-tomb 12/12,
  meet-stale-peer-count 22/22, test/mesh frozen-roster-echo 11/11,
  frozen-roster-heal-echo 13/13, frozen-roster-owner-echo 9/9,
  head-bye-dark-heir 17/17, rollback-live-stamp 13/13. The sim builds; the
  quick ladder (N=20, 300) prints the same numbers on the branch tip alone,
  including its "still grows at the top" line, which the full N=20000 ladder
  decides and was not run here.
- cursor/stale-peer-ui is kept in both repos (clawbox loops still push to it).

## release/0.9.24

FILL_24

## Branches

Deleted on origin after both release branches held them:

FILL_DELETED

Kept (still active, merged at the tips listed above):
cursor/qa-meet-mobile, cursor/qa-meet-desktop, cursor/qa-broadcast-mobile,
cursor/qa-broadcast-desktop, cursor/meetbot-081f-merged.

## Left out

- The host-voice path from cursor/meetbot-host-ops and the mbv2 caption path:
  superseded by meetbot-081f-merged (bot voice from app/host-injected
  providers). Their unique test files were checked; nothing unique lost.
- Non-cursor branches (cc-*, fix-*, int2-*, gb-*, wip-*, turn-*, ui-redesign-*,
  v23-whisper-app, …) were not part of the ask and were not touched.
- Lobby localization: the phone lobby strings are English-only where the
  branches disagreed on wording; uiText keys are kept where both sides had them.
- Duplicated host panels (stage/hand) are hidden by CSS when their modal is
  open rather than removed, so both branches' panels still exist in the DOM.
- Device-specific wording (People / Room password / Step on stage on phones vs
  the desktop uiText) is set in `placeDockForWidth`; a resize repaints it.
- FILL_LEFTOUT
