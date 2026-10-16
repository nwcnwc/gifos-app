# Broadcast and Meet role controls

Broadcast is the Meet call page (`run.html`) with `#bc=1` on an admin room. It must not keep Meet controls that a Broadcast role does not have. The same rules apply in the dock, the More cluster (the bar chevron; `.barmore` is hidden while the bar is collapsed), the roster, keyboard and system shortcuts, Settings, and the compact phone layouts (narrow portrait and short landscape). Those layouts only tighten padding. They do not reveal a control another layout hides.

Meet roles are the open-room participant, the guest in a room an admin runs, and that admin. Broadcast roles are the viewer, the stage guest a host has promoted, and the host.

| Control | Where it lives | Meet participant | Meet guest | Meet admin | Broadcast viewer | Broadcast stage guest | Broadcast host |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Microphone | Dock | Yes | Yes | Yes | No. A WATCHING viewer on `cursor/qa-broadcast-desktop` still sees Unmute | Yes | Yes |
| Camera | Dock | Yes | Yes | Yes | No. A WATCHING viewer on `cursor/qa-broadcast-desktop` still sees Video | Yes | Yes |
| Switch camera | Dock, when the device has two cameras | Yes | Yes | Yes | No | Yes | Yes |
| Blur of your own camera | Dock | Yes | Yes | Yes | No | Yes | Yes |
| Float the meeting (picture in picture) | Dock, when the browser offers it | Yes | Yes | Yes | Yes | Yes | Yes |
| Leave | Dock | Yes | Yes | Yes | Yes | Yes | Yes |
| Status line | Dock | Yes | Yes | Yes | Yes | Yes | Yes |
| Who | More | Yes | Yes | Yes | Yes | Yes | Yes, with stage moderation on each person |
| Invite | More | Yes | Yes | Yes | Yes | Yes | Yes |
| Run app | More | Yes | Only after an admin allows apps | Yes | No | No | Yes |
| Share screen | More | Yes | Only after an admin allows it | Yes | No | No | Yes |
| Blur every guest | More | No | No | Yes | No | No | No |
| Turn every guest's video off | More | No | No | Yes | No | No | No |
| Allow screen share for the room | More | No | No | Yes | No | No | No |
| Password | More | Yes | No | Yes | No | No | Yes |
| Vote onto or off the stage, or out of the room | More | Yes | No | No | No | No | No |
| Admin sign-in | More | No | Yes | Yes | Yes | Yes | Yes |
| Hand / ask for the stage | More | Hand | Hand | Hand | Ask to join | Hand | Hand |
| Chat, including files | More, chat panel | Yes | Yes | Yes, and can turn chat off or delete a line | Yes | Yes | Yes, and can turn chat off or delete a line |
| Record | More | Yes | Yes | Yes | No | No | Yes |
| Captions (CC) | More | Yes | Yes | Yes | No | No | Yes |
| Stage / Step down | More | Yes | Only after a promotion, or to step down | Yes | No | Yes | Yes |
| Settings | More | Yes | Yes | Yes | Name only | Name and video quality | Name, video quality, and captions |
| Transcript | More, once captions exist | Yes | Yes | Yes | No | No | Yes |
| Help | More | Yes | Yes | Yes | Yes | Yes | Yes |
| Mute one person for everyone | Roster tile, and Who in a broadcast | Yes | No | Yes | No | No | Yes |
| Blur one person for everyone | Roster tile, and Who in a broadcast | Yes | No | Yes | No | No | Yes |
| Promote / demote (stage grant) | Hand queue promotes; roster tile; Who demotes and promotes | Vote, not a grant | No | Yes | No | No | Yes |
| Allow one person to share a screen | Roster tile | Not needed | No | Yes | No | No | No |
| Ban a device | Roster tile, and Who in a broadcast | No | No | Yes | No | No | Yes |
| Full-screen a tile | Tile | Yes | Yes | Yes | Yes, the stage | Yes | Yes |
| Video quality | Settings | Yes | Yes | Yes | No | Yes | Yes |
| Captions language, engine, scribe, captions for everyone | Settings | Yes | Language and engine | Yes, including captions for everyone | No | No | Yes, on the host's device only |
| Sound mix and timing (Conversation, Unison, Song) | Settings | Yes | Yes | Yes | No | No | No |
| Toggle microphone | System media keys, headset, lock screen | Yes | Yes | Yes | No | Yes | Yes |
| Toggle camera | System media keys, headset, lock screen | Yes | Yes | Yes | No | Yes | Yes |
| Hang up | System media session | Yes | Yes | Yes | Yes | Yes | Yes |
| Enter picture in picture | System media session | Yes | Yes | Yes | Yes | Yes | Yes |
| Escape | Keyboard | Closes the top dialog, or leaves vote mode | Same | Same | Same | Same | Same |
| Tab | Keyboard | Cycles inside the open dialog | Same | Same | Same | Same | Same |
| Enter or Space | Keyboard | Activates the focused tile control (full-screen thumb, stop-sharing chip) | Same | Same | Same, and cannot start a share | Same, and cannot start a share | Same |

There is no letter shortcut for mute, camera, or share. The system media session is the shortcut, and it calls the same dock buttons.

A viewer may raise a hand, which asks the host to promote them. Chat stays available. Nothing from a viewer is published: no camera, microphone, screen, app, recording, or captions, including when the button is clicked, the system shortcut fires, or a Meet share grant is present. Promoting a viewer makes them a stage guest: camera and microphone work as they do for a Meet participant, and their own blur and video quality come back. Demoting them stops every track they are sending and removes those controls. The host keeps Meet's publish controls that belong on a stage (camera, microphone, screen, app, recording, captions, password) plus promote, demote, mute, blur, and ban. Meet's row tools stay off the broadcast: votes, the stadium sound mix, blurring or cutting every guest at once, and letting guests share a screen.

The audience grid stays off in a broadcast, because viewers have no camera. Host moderation is on Who, and the hand queue still promotes the person who asked.

The gate is `test/browser/e2e-broadcast-roles.js`. It checks the dock, the More cluster, Settings, and the phone and landscape layouts, and it checks that a click does not publish.

## Evidence from the desktop QA branch

On `cursor/qa-broadcast-desktop` at `a5b2611`, a viewer in the WATCHING state still sees the Meet-style Video and Unmute buttons on the dock. No control has been changed for this finding.

The viewer session is `/run.html?desk=chat#mb=1&v=sunday&av=0123456789abcdef&bc=1` with a display name and no host key. `test/e2e/broadcast-desktop.spec.js` (“a broadcast viewer is Watching, including at 900px”) expects `#onair` to say Watching and `#airkind` to say “Service · You are watching”. The same URL, through `bootSession`, is what “mute and camera are labeled and the off state is filled red” measures: `#mic .docklab` is Unmute, `#cam .docklab` is Video, and both buttons have a layout box at 1280, 1920, and 900. The shots show the same pair under the Watching pill and under the “Service · You are watching” bar: `test/e2e/artifacts/onair-watching-900.png`, `test/e2e/artifacts/service-bar-watch-after.png`, and `test/e2e/artifacts/dock-labels-900.png`.

The hide rule on that branch is still `body.broadcast.notadmin:not(.stage-granted)` for `#mic` and `#cam`. Watching is painted earlier, from the absence of a stored host key, inside `paintBroadcastChrome`. That paint does not add `notadmin`. The session frame (`#mb=1`) stops in `bootMeetSession` and never reaches `applyAdminUi`, which is the only place `notadmin` is set. So the WATCHING viewer in this pass keeps the labeled dock buttons.

## What was wrong

- Viewer microphone, camera, blur, screen share, captions, and recording were only hidden with CSS, and only after the page learned it was not the admin. A click, a system media key, or a scripted call still called `getUserMedia` or `getDisplayMedia` and attached the tracks.
- A Meet screen-share grant (`share-granted`) put Share screen back on a viewer, and a stage guest could be given it too.
- Stepping off the stage, including after a host revoked the grant, turned the row camera back on. That is correct in Meet and wrong in a broadcast: a demoted guest must stop publishing.
- The same stage grant also allowed Run app, so a stage guest could publish an app.
- Captions for everyone would start a viewer's transcriber.
- Blur guests, Turn video off, and Allow screen share are Meet admin hammers. Allow screen share was still shown to a broadcast host and would have let viewers publish a screen. Per-person mute, blur, promote, demote, and ban lived on the grid tiles, which a broadcast does not draw, so a host could not use them.

## What changed

A viewer is `bc-viewer` from the first paint. Camera, microphone, blur, screen share, Run app, record, captions, password, and Stage stay off in every layout, including when a Meet share grant is present. Clicks and the system media keys do not call `getUserMedia` or `getDisplayMedia`, and a beat parks any sender a bypass attached. A stage guest gets camera and microphone; demoting them stops the tracks and removes those controls. They do not get screen share, Run app, record, or captions. The host keeps those, and Who carries promote, demote, mute, blur, and ban. Allow screen share, Blur guests, Turn video off, vote, and the sound mix stay off for every broadcast role.
