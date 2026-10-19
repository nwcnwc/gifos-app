# Broadcast and Meet role controls

Broadcast is the Meet call page (`run.html`) with `#bc=1` on an admin room. It must not keep Meet controls that a Broadcast role does not have. The same rules apply in the dock, the More cluster (the bar chevron; `.barmore` is hidden while the bar is collapsed), the roster, keyboard and system shortcuts, Settings, and the compact phone layouts (narrow portrait and short landscape). Those layouts only tighten padding. They do not reveal a control another layout hides.

Meet roles are the open-room participant, the guest in a room an admin runs, and that admin. Broadcast roles are the viewer, the stage guest a host has promoted, and the host.

| Control | Where it lives | Meet participant | Meet guest | Meet admin | Broadcast viewer | Broadcast stage guest | Broadcast host |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Microphone | Dock | Yes | Yes | Yes | No. On `cursor/watching-viewer-no-av-f3b0` a WATCHING viewer is `bc-watching` and Unmute stays off the dock | Yes | Yes |
| Camera | Dock | Yes | Yes | Yes | No. On `cursor/watching-viewer-no-av-f3b0` a WATCHING viewer is `bc-watching` and Video stays off the dock | Yes | Yes |
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
| Hand / ask for the stage | More | Hand | Hand | Hand | Ask to join, and Lower hand. Raising it does not publish | Hand | Hand |
| Chat, including files | More, chat panel | Yes | Yes | Yes, and can turn chat off or delete a line | Yes | Yes | Yes, and can turn chat off or delete a line |
| Record | More | Yes | Yes | Yes | No | No | Yes |
| Captions (CC) | More | Yes | Yes | Yes | No | No | Yes |
| Stage / Step down | More | Yes | Only after a promotion, or to step down | Yes | No | Yes | Yes |
| Settings | More | Yes | Yes | Yes | Name only | Name and video quality | Name, video quality, and captions |
| Transcript | More, once captions exist | Yes | Yes | Yes | No | No | Yes |
| Help | More | Yes | Yes | Yes | Yes | Yes | Yes |
| Mute one person for everyone | Stage seat, raised-hands list, and Who | Yes | No | Yes | No | No | Yes |
| Blur one person for everyone | Stage seat, raised-hands list, and Who | Yes | No | Yes | No | No | Yes |
| Promote / demote (stage grant) | Raised-hands list promotes; stage seat demotes; Who does both | Vote, not a grant | No | Yes | No | No | Yes |
| Allow one person to share a screen | Roster tile | Not needed | No | Yes | No | No | No |
| Ban a device | Stage seat, raised-hands list, and Who | No | No | Yes | No | No | Yes |
| On-air lamp | Bar, next to the word | No | No | No | Watching | Off air until sending, then Live | Off air until sending, then Live. Stepping on does not send |
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

A viewer may raise a hand, and lower it, which asks the host to promote them. Chat stays available. Nothing from a viewer is published: no camera, microphone, screen, app, recording, or captions, including when the button is clicked, the system shortcut fires, or a Meet share grant is present. The viewer's join step says they are watching the service and staying off camera, and that their name and picture are seen only if they raise a hand and the host promotes them. Promoting a viewer makes them a stage guest: camera and microphone work as they do for a Meet participant, and their own blur and video quality come back. Demoting them stops every track they are sending and removes those controls. The host goes on stage when the admin key is adopted, can step off and back on, and does not publish until a camera or microphone tap. The lamp beside that state reads Watching, Off air, or Live. The host keeps Meet's publish controls that belong on a stage (camera, microphone, screen, app, recording, captions, password) plus promote, demote, mute, blur, and ban. Those actions sit on each other person's stage seat, on each raised hand, and on Who (On stage, Raised hands, Watching). Meet's row tools stay off the broadcast: votes, the stadium sound mix, blurring or cutting every guest at once, and letting guests share a screen.

The audience grid and the stadium stay off in a broadcast. The stage is the only picture.

The gate is `test/browser/e2e-broadcast-roles.js`. It checks the dock, the More cluster, Settings, and the phone and landscape layouts, and it checks that a click does not publish. The same command then runs `test/browser/e2e-avatar-feed.js`: with the camera off, the avatar is a frame of the video, and blur for all and a per-person blur cover that frame. It then runs `test/browser/e2e-broadcast-design.js`: stage only, the host stepping on and off without publishing, the raised-hands Promote list, stage-seat and viewer-list actions, the viewer join line, and the on-air words. That design check failed before those controls existed and passes after. Shots for each role are in `docs/screenshots/broadcast-design/`.

## Evidence from the desktop QA branch

On `cursor/qa-broadcast-desktop` at `a5b2611`, a viewer in the WATCHING state still saw the Meet-style Video and Unmute buttons on the dock. That leak is fixed on `cursor/watching-viewer-no-av-f3b0` (`ce9ff24`). The five chat-versus-repo conflicts are unchanged.

The viewer session is `/run.html?desk=chat#mb=1&v=sunday&av=0123456789abcdef&bc=1` with a display name and no host key. Before the fix, that session had no `notadmin` class, `#onair` said Watching, and a click on `#mic` and `#cam` called `getUserMedia` twice. The hide waited for `body.broadcast.notadmin`.

The fix keys off the watching seat. `bcWatchingViewer` is true when the broadcast is not the host and not a stage grant. `paintWatchingSeat` sets `body.bc-watching` from that, in the same paint as the Watching chip. Camera, microphone, flip, and blur hide on `body.broadcast.bc-watching`. `lateMedia` and the two dock clicks return before they publish. A stage grant still requires `av`, because `canStage` is true until the room exists. The host keeps Video and Unmute.

The gate test is `test/e2e/broadcast-desktop.spec.js`, “a Watching viewer has no camera or mic on the dock and does not publish”. It failed before the fix (dock buttons visible, two `getUserMedia` calls) and passed after, with the rest of that spec on Chrome (25 passed).

## What was wrong

- Viewer microphone, camera, blur, screen share, captions, and recording were only hidden with CSS, and only after the page learned it was not the admin. A click, a system media key, or a scripted call still called `getUserMedia` or `getDisplayMedia` and attached the tracks.
- A Meet screen-share grant (`share-granted`) put Share screen back on a viewer, and a stage guest could be given it too.
- Stepping off the stage, including after a host revoked the grant, turned the row camera back on. That is correct in Meet and wrong in a broadcast: a demoted guest must stop publishing.
- The same stage grant also allowed Run app, so a stage guest could publish an app.
- Captions for everyone would start a viewer's transcriber.
- Blur guests, Turn video off, and Allow screen share are Meet admin hammers. Allow screen share was still shown to a broadcast host and would have let viewers publish a screen. Per-person mute, blur, promote, demote, and ban lived on the grid tiles, which a broadcast does not draw, so a host could not use them.

## What changed

A viewer is `bc-viewer` from the first paint. Camera, microphone, blur, screen share, Run app, record, captions, password, and Stage stay off in every layout, including when a Meet share grant is present. Clicks and the system media keys do not call `getUserMedia` or `getDisplayMedia`, and a beat parks any sender a bypass attached. A stage guest gets camera and microphone; demoting them stops the tracks and removes those controls. They do not get screen share, Run app, record, or captions. The host keeps those. Promote, demote, mute, blur, and ban are on the stage seats, the raised-hands list, and Who. Allow screen share, Blur guests, Turn video off, vote, and the sound mix stay off for every broadcast role. The bar lamp reads Watching, Off air, or Live. The viewer join step says the name and picture stay unseen until a hand is promoted.
