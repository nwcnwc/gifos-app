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

### Q5. Primary dock controls are icon-only

Mic, camera, reactions, and More now carry a visible word inside the button (`Unmute` / `Mute` / `Video` / `React` / `More`). Off is filled red `#b61622` with white text; on is filled green. The word stays inside the 68px circle at 1280, 1920, and 900, and the dock stays inside the window after a resize from 1920 to 900. Screenshots: `test/e2e/artifacts/dock-labels-1280.png`, `test/e2e/artifacts/dock-labels-900.png`.

### Q6. No mute / camera keyboard shortcuts

`M` toggles the mic and `V` toggles the camera, except while focus is in a text field. The chat test types `m` into the composer and the mic stays on Unmute. The buttons’ titles name the shortcut.

### Q4. More sheet can leave the viewport

`#barmore` now has `max-height: calc(100dvh - 140px)` and `overflow-y: auto`. At 1280×360 the sheet used to start at y=−142 with Who, Invite, and the blur segments off screen and no scroll. It now stays inside the viewport, and Help can be scrolled into view. Screenshot: `test/e2e/artifacts/more-sheet-short-after.png`.

### Q11. Invite was a second tap inside More

`#invite` lived in `#barmore`, so with the dock collapsed (the default) its box was 0×0. It is now a labeled circle on the dock, between React and More, visible while More is closed. One tap opens “Share this broadcast”. The word Invite stays inside the 68px circle, and the dock stays inside 1280, 1920, and 900. The button is the same neutral gray as React and More (`rgb(232, 236, 241)`), so blue stays reserved for an open popover. Before: `test/e2e/artifacts/invite-dock-before.png` (and the buried control in `invite-more-before.png`). After: `test/e2e/artifacts/invite-dock-after.png`, `invite-modal-after.png`.

### Q12. Reactions were words, and the dock face was easy to misread

The reaction tray is now emoji: ✋ 👏 👍 👎 😂, with accessible names Raise hand, Clap, Yes, No, Laugh. A clap paints 👏 on your tile, not the word Clap. The dock control shows 😊 plus the word React. No sparkle glyph (✨ ✦ ✧ ⭐) is on this control; that mark stays available for AI. Before: `test/e2e/artifacts/react-tray-before.png`. After: `test/e2e/artifacts/react-tray-after.png`.

### Q7. Reactions and More occupied the same slot

Opening React while More was open put `#reacttray` on top of `#barmore` (overlap 392×88px at 1280×720). Opening one now closes the other. After the same two taps, More is `display: none` and the emoji tray is the only popover. Before: `test/e2e/artifacts/react-more-stack-before.png`. After: `test/e2e/artifacts/react-more-stack-after.png`.

### Q10. Full screen lived only on the tile

The dock now has `#fsbtn`, labeled Full, with the accessible name “Full screen”. It sits between Invite and More, visible while More is closed, and the dock stays inside 1280, 1920, and 900 (the bar measured 626px wide at 1280). One tap opens the filmstrip view (`body.fsopen`) following the speaker; the view’s close button leaves it. The tile glyph `⛶` is still there for a single feed. Before: `test/e2e/artifacts/dock-fullscreen-before.png`. After: `test/e2e/artifacts/dock-fullscreen-after.png`, `fullscreen-view-after.png`.

### Q8. Guest moderation tools were hover-first

A guest tile is now in the tab order (`tabindex="0"`, named “Jordan Lee. Guest controls.”). Focusing it shows Mute, Blur, and, for a host, Apps, Share, and Ban. Tab reaches Mute and then Ban. The words fit the buttons; the longer phrase stays on the accessible name (“Mute for everyone”). Before: `test/e2e/artifacts/modbar-keyboard-before.png`. After: `test/e2e/artifacts/modbar-keyboard-after.png`.

A broadcast hides the gallery, so this bar is the meeting surface. The same tools are painted on the broadcast stage (Q15).

### Q15. Guest tools were missing from the broadcast stage

A broadcast hides the gallery, so Mute, Blur, and Ban had nothing to sit on. The host now sees them on the stage: “On stage”, the guest’s name, and the same words. Tab reaches Mute, and Mute becomes Unmute. A viewer does not get the strip. The tools stay inside the picture area and clear of the dock at 1280 and 900. After: `test/e2e/artifacts/stage-mod-after.png`.

### Q14. The dock grip promised arrow keys and ignored them

The grip’s title says “Arrow keys nudge.” Arrow keys now move the dock 24px (48px with Shift). It stays 8px inside the window. A double click, or a double tap, puts it back in the center. Before: `test/e2e/artifacts/dock-grip-before.png`. After: `test/e2e/artifacts/dock-grip-after.png`.

### Q9. Lobby copy was one voice, and the password essay came first

A meeting lobby’s blue button is **Start a call** (“Anyone with the link can join”). **Host this call** is an outline button. The guest password stays hidden until “Add a password for guests”. A broadcast lobby’s blue button is **Go live**; the viewer password stays hidden until “Add a password for viewers”. The card stays inside 1280, 1920, and 900. The words “troublemaker”, “open room”, and “admin” are gone from the lobby. Before: `test/e2e/artifacts/lobby-simple-before.png`, `lobby-family-before.png`. After: `lobby-family-after.png`, `lobby-simple-after.png`, `lobby-golive-after.png`.

### Q13. The screen-name step skipped a saved name

Joining now shows “This is how you'll appear” with the GifOS display name filled in and the saved picture in the circle. The person can edit the name and choose another picture. Save is blue `#0064c8` and keeps the name and picture on screen. Clear is a white button with a gray outline and blanks both. The two do not touch (gap at least 8px). The lobby shows the same preview, so a call started from there does not ask twice. A direct link still asks. Before: the old lobby line “You'll join as …” in `lobby-family-after.png` from the previous round. After: `test/e2e/artifacts/appear-lobby-after.png`, `appear-dialog-after.png`.

### Q16. On air was a small pill

The top chip still says Live or Watching. A full-width bar under that chip now says **You are live** (red `#b61622`) or **You are watching** (light gray). It clears the chip, the Fit button, and the dock at 1280, 1920, and 900. A meeting hides it. After: `test/e2e/artifacts/onair-bar-live-after.png`, `onair-bar-watch-after.png`. The small pill in `onair-live-1280.png` is the earlier state.

### Q17. Chat lived in More, and a prayer looked like any other line

Chat is a labeled dock button, so it is one tap while More is closed. The dock still fits 1280, 1920, and 900. Prayer marks the composer (“Prayer request…”) and the sent line wears the word Prayer, separate from an ordinary message. The composer still clears the dock. After: `test/e2e/artifacts/chat-dock-after.png`, `chat-prayer-after.png`.

### Q18. An open room did not say whether it was a service or a small group

The full-width bar now names the room. A service says **Service · You are live** (red `#b61622`) or **Service · You are watching** (gray `#e8ecf1`). A small group says **Small group** on green `#143024`. Chat, leave, invite, Help, and the tab title use the same words. The lobby still says Start a call or Go live. The two bars do not share a background, and both clear the chip, the Fit button, and the dock at 1280, 1920, and 900. Before: the Q16 bars, which only said “You are live” / “You are watching”, and a meeting that hid the bar. After: `test/e2e/artifacts/service-bar-live-after.png`, `service-bar-watch-after.png`, `small-group-bar-after.png`.

### Q19. Recording and who is here were inside More

The room bar now says **Not recording** or **Recording**, and a headcount (**1 here**) that opens the name list. More can stay closed. Recording is a white pill with red text. Not recording is an outline on the same bar. Both fit inside the bar at 1280, 1920, and 900, clear of the dock. Tapping Not recording opens the record sheet. Tapping the count shows the names, including your own. A service keeps “Service · You are live” beside those controls. After: `test/e2e/artifacts/trust-group-after.png`, `trust-group-recording-after.png`, `trust-service-after.png`.

### Q20. Leave was an unlabeled phone icon, and coming back said “meeting”

The dock button says **Leave**. The question is Stay (outline) and Leave (red), with a gap between them. After you leave, a white card says **You left the small group** or **You left the service**. Rejoin is blue `#0064c8`. Close is a white outline button. Rejoin reloads the same link and the room bar is back. The label fits inside the button at 1280, 1920, and 900. After: `test/e2e/artifacts/leave-dock-after.png`, `leave-ask-after.png`, `leave-rejoin-after.png`.

### Q21. Mute and camera were only a dock color

A full-width line under the room bar says **Microphone off** and **Camera off** while those are off. White on `#3a1014`. It sits under the room bar, clears the dock, and fits 1280, 1920, and 900. It hides when the microphone and camera are on. Someone only watching a service does not see it. After: `test/e2e/artifacts/av-off-after.png`, `av-on-after.png`.

### Q22. A recording started without a card you had to read

Starting a recording, or seeing someone else start one, opens a white card. The title is **You are recording this small group**, **You are recording this service**, **Jordan Lee is recording this small group**, or **This small group is being recorded** when the name is missing. The body says it is saved on a device in this room and that the bar keeps saying Recording. OK is blue `#0064c8`. The card fits 1280, 1920, and 900. OK dismisses the card and leaves the bar on Recording. The record sheet says the same thing: Cancel is an outline, Start recording is blue. After: `test/e2e/artifacts/rec-notice-after.png`.

### Q23. Invite opened onto a governance essay

Invite is a dock button. The sheet is now a white card. A small group says **Share this small group** and **Send this link. Anyone who opens it joins you.** Copy is blue `#0064c8`. Close is an outline. The gap between the link and Copy is 12px. **A room you run** is a text link; the host password stays hidden until that tap. A service says **Share this service** and that people who open the link are watching. A host also sees that the host password stays with them. The card fits 1280, 1920, and 900, including after a live resize to 900, and the password step still fits. Before: `test/e2e/artifacts/invite-sheet-before.png`. After: `test/e2e/artifacts/invite-sheet-after.png`.

### Q24. The full-screen control said Full

The dock button now says **Full screen**. The word fits inside the button at 1280, 1920, and 900, and after a live resize from 1920 to 900. The dock stays inside the window. Before: `test/e2e/artifacts/dock-full-before.png`. After: `test/e2e/artifacts/dock-full-after.png`.

### Q25. Send was a short white button under an empty files strip

Send is blue `#0064c8`, 44px tall, white text. The message field is white with a gray border, also 44px. The files strip stays hidden until a file is pinned. Prayer still posts its own line. The composer clears the dock at 1280, 1920, and 900, and after a live resize to 900. Before: `test/e2e/artifacts/chat-send-before.png`. After: `test/e2e/artifacts/chat-send-after.png`.

### Q26. The lobby said Meeting or Broadcast

A cold open now says **Small group**. Go live says **Service**. The blue button is still Start a call or Go live, and the quiet line still says you come in muted, or that people watch with the link. The card fits 1280, 1920, and 900. After: `test/e2e/artifacts/lobby-words-after.png`, `lobby-service-after.png`.

### Q27. A small group asked before you could leave

Leave on a small group goes straight to **You left the small group**. Rejoin is still blue. Close is still the outline. The confirm stays on a service, because you are live: Stay is the outline and Leave is red. After: `test/e2e/artifacts/leave-onetap-after.png`.

### Q28. The status line was cut off

Alone in a room, the chip said “Just you — send the invite; the link has no expiry” and then clipped the rest, including at 1920. It now says **Just you. Send the invite.** The chip can use the width beside Fit. The whole line fits at 1280, 1920, and 900, and after a resize from 1920 to 900, and it does not cover Fit. After: `test/e2e/artifacts/status-fit-after.png`.

### Q29. The dock stayed up on a quiet small group

On a small group the dock slides off the bottom after the call sits quiet, and a pointer, a key, or focus brings it back. It stays put while More is open, reactions are open, a text field is focused, or a card is up. A service does not tuck. Before: `test/e2e/artifacts/dock-tuck-before.png`. After: `test/e2e/artifacts/dock-tuck-after.png`.

### Q30. A small group opened with three doors

Start a call is the button. Host this call and Join a link are text links in `#0064c8`, and each still opens its fields in place. A service still leads with Go live, and Watch stays the outline button, because a volunteer and a viewer both need a door. The card fits 1280, 1920, and 900. Before: `test/e2e/artifacts/lobby-doors-before.png`. After: `test/e2e/artifacts/lobby-doors-after.png`, `lobby-doors-service.png`.

### Q31. Captions turned pale green when they were on

The More button says **Captions**. On is blue `#0064c8` with white text, and Record uses that same on state. The word fits at 1280, 1920, and 900, and after a resize from 1920 to 900. Before: `test/e2e/artifacts/captions-before.png`, `captions-on-before.png`. After: `test/e2e/artifacts/captions-after.png`.

### Q32. Broadcast is the stage. A small group is the call.

Nathan’s Broadcast design: only the stage shows. No row, no stadium, no other tiles. The host steps on when the host key is adopted, and can step off. Raised hands are an admin list the host promotes from. A viewer’s name and picture are seen only if they raise a hand and are promoted. The host key stays.

What this desktop branch already matches: a service hides `#grid` and `#stadium`. Comfy layout does not run on a broadcast. A small group keeps the grid. That grid is the many-to-many call, and it is not the Broadcast product. The service lobby still asks for the host password, and adopting that key calls `tryBroadcastStage`.

What does not match, and is left alone here because the role-controls work is building it: a Watching viewer in this frame still has Unmute, Video, Hand, and Stage, because those hide only after `notadmin`, and this frame never joins. Service help still says ban lives on each tile, and a service does not draw those tiles. `#stagemod` is a host card row, not the raised-hands list. Shots: `test/e2e/artifacts/broadcast-stage-flag.png`, `small-group-grid-flag.png`.

### Q33. A live service said Just you

Alone on a service, the chip used the small-group sentence. A host now reads **You are live. Send the link.** A viewer reads **You are watching this service.** A small group still reads **Just you. Send the invite.** The line fits beside Fit at 1280, 1920, and 900, and after a resize from 1920 to 900. Before: `test/e2e/artifacts/service-alone-before.png`. After: `test/e2e/artifacts/service-alone-after.png`.

### Q34. Share screen was inside More

On a small group, Share is a dock button. The label is **Share**, and the accessible name is Share screen. The word fits, and the dock stays inside the window at 1280, 1920, and 900, including after a resize to 900. A service puts Share back in More, so the stage dock does not gain a meeting button. Before: `test/e2e/artifacts/dock-share-before.png`. After: `test/e2e/artifacts/dock-share-after.png`.

### Q35. Fit stayed after the dock tucked

On a quiet small group, Fit slides off with the dock and comes back with it. A service keeps Fit. The room bar, the mute line, and the status chip stay. Before: `test/e2e/artifacts/fit-idle-before.png`. After: `test/e2e/artifacts/fit-idle-after.png`.

### Q36. The host stepped on from inside More

On a service the host’s dock says **Step on**. It turns red and says **Step off** once they are on, and the next tap steps off. The word fits, and the dock stays inside the window at 1280, 1920, and 900. A viewer does not get that button. A small group still says Stage, inside More. Before: `test/e2e/artifacts/host-step-before.png`. After: `test/e2e/artifacts/host-step-after.png`.

### Q37. A watcher’s stage was a blank page

An empty service now says **The stage is clear.** A host who has stepped on with the camera off reads **You are on stage. Your camera is off.** A picture fills the space between the room bar and the dock at 1280, 1920, and 900, and after a resize to 900. A small group does not show the line. Before: `test/e2e/artifacts/stage-picture-before.png`. After: `test/e2e/artifacts/stage-picture-after.png`. Filled: `test/e2e/artifacts/stage-picture-fill.png`.

### Q38. The join sheet told a viewer they would appear in the meeting

The sheet’s title stays **This is how you'll appear.** There is no “in the meeting” line. A broadcast viewer also reads **Only seen if you raise your hand and are promoted to the stage.** A host and a small group get the title only. The line fits inside the card at 1280, 1920, and 900. Before: `test/e2e/artifacts/appear-note-before.png`. After: `test/e2e/artifacts/appear-note-after.png`.

### Q39. A viewer raised a hand from inside More

On a service the viewer’s dock says **Raise hand**. It turns blue and says **Lower hand** once the hand is up. The word fits, and the dock stays inside the window at 1280, 1920, and 900, including Lower hand at 900. A host and a small group still say Hand, inside More. Before: `test/e2e/artifacts/viewer-hand-before.png`. After: `test/e2e/artifacts/viewer-hand-after.png`. Raised: `test/e2e/artifacts/viewer-hand-raised.png`.

A desktop walk of both journeys is in `test/e2e/artifacts/journey/`. The viewer joins, watches a clear stage, raises a hand, and steps off from More after a test promotion. The host opens the lobby, joins with the title only, goes live, steps on, steps off, and gets the leave question.

### Q40. A promoted viewer stepped off from inside More

Once a viewer is on the stage, the dock shows a red **Step off**, the same control as the host. The word fits, and the dock stays inside the window at 1280, 1920, and 900. Stepping off puts Stage back in More. A watcher who is not on stage does not get the button. Before: `test/e2e/artifacts/viewer-stepoff-before.png`. After: `test/e2e/artifacts/viewer-stepoff-after.png`.

### Q41. A viewer on stage was told the stage was clear

Anyone on the stage with no picture now reads **You are on stage. Your camera is off.** Stepping off brings back **The stage is clear.** A host already had the camera-off line. Before: `test/e2e/artifacts/viewer-onstage-before.png`. After: `test/e2e/artifacts/viewer-onstage-after.png`.

### Q42. The room bar still said You are watching

A person on the stage now reads **Service · You are on stage**, on the red bar. The words fit beside Not recording at 1280, 1920, and 900. A host stays **Service · You are live**. Stepping off returns the bar to **Service · You are watching**. Before: `test/e2e/artifacts/viewer-air-before.png`. After: `test/e2e/artifacts/viewer-air-after.png`.

### Q43. The top line still said You are watching

A person on the stage now reads **You are on stage.** The badge says **On stage**. Neither overlaps Fit at 1280, 1920, or 900. Stepping off brings back **You are watching this service.** and **Watching**. A host still reads **You are live. Send the link.** Before: `test/e2e/artifacts/viewer-chip-before.png`. After: `test/e2e/artifacts/viewer-chip-after.png`.

### Q44. Fit did nothing on a service

Fit and Scroll lay out a gallery of faces. A service is one stage, and the gallery layout does not run there, so the button only renamed itself. A service now hides Fit, for the host and for a viewer, at 1280, 1920, and 900. A small group still shows Fit, and a tap still switches it to Scroll. Before: `test/e2e/artifacts/fit-service-before.png`. After: `test/e2e/artifacts/fit-service-after.png`.

### Q45. Service chat crushed its own title

Opening chat put **Service chat** in a narrow column beside the privacy line, so the title wrapped and the line stacked in a 120px strip. The title now stays on one line. The privacy line sits under it, across the panel, and it does not cover the title or Close. The same layout holds a small group’s **Small group chat**. Checked at 1280, 1920, and 900, and after a resize to 900. Before: `test/e2e/artifacts/chat-head-before.png`. After: `test/e2e/artifacts/chat-head-after.png`.

### Q46. Service help named a button that is not there

Help told a viewer to tap **Hand** and to step down. The dock says **Raise hand**, and leaving the stage says **Step off**. The service help now uses those words. A small group still has its own help, and it still explains the stadium. The card stays inside the window at 1280, 1920, and 900. Before: `test/e2e/artifacts/help-hand-before.png`. After: `test/e2e/artifacts/help-hand-after.png`.

### Q47. Full screen on a service followed a speaker

The dock’s **Full screen** opened a black view whose only control was **Follow speaker**. A service is one stage, so that view now shows the stage. A clear stage reads **The stage is clear.** A person on stage with the camera off reads **You are on stage. Your camera is off.** Close stays inside the window at 1280, 1920, and 900. A small group still has Follow speaker. Before: `test/e2e/artifacts/fs-stage-before.png`. After: `test/e2e/artifacts/fs-stage-after.png`.

### Q48. The service password was called a room lock

Password on a service opened **Room password** and said anyone in the meeting can change it, and that new joiners must enter it. The lobby already calls this **Viewer password**, optional, and not part of the link (`run.html`, the service lobby). `js/gifos-net.js` cites `docs/meet-security.md` §LOCK: the password is mixed into the room key, so without it you cannot read the room, and the link’s sid and token stay password-free, so people still route in. The stage rule in `run.html` (Nathan, 2026-08-03) is the same: the password is the read capability, and a clear stage with only the link is not allowed. The sheet now uses the lobby’s name and note, and says people can still watch while the stage stays blurred until it is set. The card stays inside the window at 1280, 1920, and 900. A small group still says Room password. Before: `test/e2e/artifacts/viewer-pw-before.png`. After: `test/e2e/artifacts/viewer-pw-after.png`.

### Q49. Who is watching still described a meeting

The title already said **Who is watching**. The paragraph under it still said a server was not storing this meeting. It now says this service. A small group still says Who is here, and its paragraph still says meeting. The card stays inside the window at 1280, 1920, and 900. After: `test/e2e/artifacts/who-service-after.png`.

### Q50. A host alone had no Invite in the chip

The sentence said **You are live. Send the link.** The only Invite was the dock button, which opens a sheet. On a phone that same moment is a blue **Invite** in the chip (3f703a7). Desktop now shows that button beside the sentence. It is 44px, blue, and it copies or shares the viewer link. A viewer password in the link or in storage is left out. The button goes away when someone else is here. A viewer and a small group do not get it. The sentence stays, and it still fits at 1280, 1920, and 900. Before: `test/e2e/artifacts/host-invite-before.png`. After: `test/e2e/artifacts/host-invite-after.png`.

### Q51. A host had to open More to put slides on the stage

Share sat in More on a service. A small group already had it on the dock. StreamYard, YouTube Live, and a church desk put screen share next to the camera, because the slides are the service. A host’s **Share** is now on the dock, labeled Share, and the tip says it shows the stage a window, a tab, or the desktop. The bar still fits at 1280, 1920, and 900, including after a resize to 900. A viewer still finds Share in More. A small group is unchanged. Before: `test/e2e/artifacts/host-share-before.png`. After: `test/e2e/artifacts/host-share-after.png`.

### Q52. Settings said people see you on a tile

On a service, Settings said **What everyone sees on your tile.** A service has a stage, not a tile. It now says **What everyone sees on the stage.** The line stays inside the window at 1280, 1920, and 900. A small group still says tile. Before: `test/e2e/artifacts/stage-name-before.png`. After: `test/e2e/artifacts/stage-name-after.png`.

### Q53. The Chat tip still said meeting

The Chat button’s tip said the chat stays between the people on this meeting. The label inside the button kept that sentence from being replaced. A service now says **Chat with everyone watching — stays between the people here, not on a server.** A viewer gets the same tip. A small group still says meeting. The button stays on the dock at 1280, 1920, and 900. Before: `test/e2e/artifacts/chat-tip-before.png`. After: `test/e2e/artifacts/chat-tip-after.png`.

### Q54. Settings still called itself a meeting

The Settings tip said **Meeting settings** and promised a sound mix. On a service the sound mix is hidden, and the sheet is the camera, the name, and the picture on the stage. The tip now says **Service settings — the picture you send, and the name people see on the stage.** The button stays inside More at 1280, 1920, and 900. A small group still says Meeting settings. Before: `test/e2e/artifacts/settings-tip-before.png`. After: `test/e2e/artifacts/settings-tip-after.png`.

### Q55. Chat still pinned a file to the meeting

The paperclip in service chat said **Pin a file to the meeting.** The files heading already said this service. The tip now says **Pin a file to this service.** It stays in the composer at 1280, 1920, and 900. A small group still says meeting. Before: `test/e2e/artifacts/pin-tip-before.png`. After: `test/e2e/artifacts/pin-tip-after.png`.

### Q56. Run app and Float still said meeting

Run app opened **Run an app in this meeting** and said the meeting’s audio and video wrap the app. Float’s tip said **Float the meeting.** A service now says **Run an app on this service**, and that it runs for everyone watching, around the stage. Float says **Float the stage.** The sheet stays inside the window at 1280, 1920, and 900. Where the browser can float a picture, Float stays inside More. A small group still says meeting. Before: `test/e2e/artifacts/app-modal-before.png`, `test/e2e/artifacts/app-float-before.png`. After: `test/e2e/artifacts/app-modal-after.png`, `test/e2e/artifacts/app-float-after.png`.

### Q57. A host left the same way a viewer does

The host dock said **Leave**, and the confirm said **Leave the service?** with no consequence. Ending a service is not the same act as a viewer stepping out. The host dock now says **End**. The confirm says **End the service?** and that everyone watching sees a five-minute countdown, then the room closes. That matches the admin-absence countdown: a short silent pause, then five minutes, then the room closes. Stay keeps the host there. After End, the card says **You ended the service** and Rejoin keeps it open. A viewer still says **Leave the service?** and leaves only themselves. A small group still hangs up on the red button. The dock and the card stay inside the window at 1280, 1920, and 900. Before: `test/e2e/artifacts/host-end-dock-before.png`, `test/e2e/artifacts/host-end-ask-before.png`. After: `test/e2e/artifacts/host-end-dock-after.png`, `test/e2e/artifacts/host-end-ask-after.png`.

### Q58. A service recording still offered the row and the stadium

Record this service listed **Stage + my row** and **Everything I see**, and the second one named the stadium. A service does not show a row or a stadium, so those choices would save a picture nobody is watching. The sheet now says **Only the stage.** Starting with an empty stage still stays on the sheet and says there is nothing to record. A small group still offers the row and everything on screen. The sheet stays inside the window at 1280, 1920, and 900. Before: `test/e2e/artifacts/rec-stage-before.png`. After: `test/e2e/artifacts/rec-stage-after.png`.

### Q59. A clap on a service never reached the stage

The reaction painted on your own tile. A service hides that tile, so a clap left the stage saying **The stage is clear.** The same clap now appears on the stage, above the dock and clear of the reaction tray, at 1280, 1920, and 900. A small group still paints it on the tile. Before: `test/e2e/artifacts/react-stage-before.png`. After: `test/e2e/artifacts/react-stage-after.png`.

### Q60. Float did nothing when the stage was empty

Float is in More where the browser can float a picture. On an empty stage the tap returned without a word, and the status line stayed **You are live. Send the link.** The tap now says **Nothing on the stage to float yet.** The line fits at 1280, 1920, and 900. Leaving the tab still stays quiet. A small group is unchanged. Before: `test/e2e/artifacts/float-empty-before.png`. After: `test/e2e/artifacts/float-empty-after.png`.

### Q61. A viewer’s clap never reached the stage

A clap stayed on the person who sent it. The host’s stage had no sign of the audience. A service now adds every clap into one pill on the stage: twelve viewers are **👏 12**, and a different reaction is its own pill. One person can add six in ten seconds, then further taps from that person wait. The pills sit above the dock at 1280, 1920, and 900. A small group still paints a clap on the tile only. Before: `test/e2e/artifacts/react-count-before.png`. After: `test/e2e/artifacts/react-count-after.png`.

### Q62. A service could not mute the stage

The sound mix is hidden on a service, because the stage is the only bus. That also removed the only way to silence what you hear. The room bar now says **Sound on**. Tapping it says **Muted** and silences the stage on this device. The line says everyone else still hears it. The saved mix is unchanged. A small group has no such button and still keeps the mix in Settings. The button sits inside the bar at 1280, 1920, and 900, clear of the dock. Before: `test/e2e/artifacts/stage-sound-before.png`. After: `test/e2e/artifacts/stage-sound-after.png`.

### Q63. A host alone on a service read 1 here

The room bar counted everyone, so a host alone read **1 here**: it counted the host. A service now counts the people watching. The host and everyone on the stage are left out. A host alone reads **0 watching**. Twelve viewers read **12 watching**. A viewer alone reads **1 watching**. Tapping it opens Who is watching. A small group still reads **1 here**. The button sits inside the bar at 1280, 1920, and 900, clear of the dock. Before: `test/e2e/artifacts/watch-count-before.png`. After: `test/e2e/artifacts/watch-count-after.png`.

### Q64. One viewer clap counted twice on the host stage

A clap goes out over the direct link and over the mesh. The frame had no id, so the host added both copies: two claps read **👏 4**. Each clap now carries an id, and the host counts an id once. Two claps read **👏 2**, however they arrive. A frame from an older device without an id still counts. The pills sit above the dock at 1280, 1920, and 900. Before: `test/e2e/artifacts/clap-once-before.png`. After: `test/e2e/artifacts/clap-once-after.png`.

### Q65. A clap made as the link opened never reached the host

The specs handed the host a fake frame, so nothing proved a clap crossed a real link. `test/e2e/cross-clap.js` runs two real browsers through a relay, one per machine if you give it two Playwright run-servers. It found this: a clap goes to the people on the roster, and the roster catches up on its own tick. A viewer who clapped the moment the link opened had the host on an open channel but not on the roster yet, so the clap went nowhere. The viewer read **👏 2** and the host read **👏 1**, or nothing. A clap now also goes over every open channel the roster missed, and the id from Q64 drops the copy a host gets both ways. Before: `test/e2e/artifacts/clap-early-before.png`. After: `test/e2e/artifacts/clap-early-after.png`.

### Q66. A viewer saw a black square when the host's camera was off

`test/e2e/cross-camoff.js` runs a host and a viewer in real browsers. A host goes live with the camera off, and the viewer's stage was a black square. The host's name was burned into its foot, half under the On stage label. Nothing said the camera was off. The name card came up only for someone with a profile picture, and it sat at a fixed spot that could cover the room bar. Now anyone on the stage with the camera off shows their picture or initial, their name, and **Camera off** in the middle of the stage. The black frame under it is hidden. A screen share is still a picture, so it shows with no card. The host's own card leaves out Camera off, because the line under the room bar already says it. Before: `test/e2e/artifacts/camoff-stage-before.png`. After: `test/e2e/artifacts/camoff-stage-after.png`.

### Q67. A viewer at the name card saw Video and Unmute on the dock

A viewer is marked as a watcher only when they join. Behind "This is how you'll appear" the dock still showed the red **Video** and **Unmute** buttons, and they belong to whoever is on the stage. A viewer is now marked at boot, so the dock behind the card has no camera or mic: it starts with Raise hand. The captions and recording spec had read host-only buttons through the same leak, so it now opens as a host. `test/e2e/cross-namecard.js` checks it with the host and the viewer on two machines. Before: `test/e2e/artifacts/viewer-namecard-before.png`. After: `test/e2e/artifacts/viewer-namecard-after.png`.

### Q68. A viewer at the name card read watching, reconnecting, and 1 watching

A viewer joins the room only after they save "This is how you'll appear". Behind that card they read **You are watching this service. · reconnecting to the room…** and **1 watching**. They were not watching yet, nothing had dropped, and the one counted was themselves. At the card the line now says **Joining the service…** (a host's says **Going live…**), and the count is hidden until they join. After Save a viewer with the host live reads **1 watching**. `test/e2e/cross-cardstatus.js` checks it with the host and the viewer on two machines. Before: `test/e2e/artifacts/card-status-before.png`. After: `test/e2e/artifacts/card-status-after.png`.

### Q69. A joined viewer read the video quality and a password hint

A viewer who joined read **2 in this service · 720p · a password unlocks clear video**. A viewer sends no video, so the quality and the password were talk for a host. The count counted the viewer too. The line now says **You are watching this service.** `test/e2e/cross-viewline.js` checks it with the host and the viewer on two machines. Before: `test/e2e/artifacts/viewer-line-cross-before.png`. After: `test/e2e/artifacts/viewer-line-cross-after.png`.

### Q70. A live host read the meeting count and "a password"

A host with one viewer read **2 in this service · 720p · a password unlocks clear video**, while the room bar said **1 watching**. The host had just typed a password to go live, and the line did not say which password it meant. The line now reads **You are live · 720p · blurred until you set a viewer password**, and **You are live · 720p** once a viewer password is set. `test/e2e/cross-hostline.js` checks it with the host and the viewer on two machines. Before: `test/e2e/artifacts/host-line-cross-before.png`. After: `test/e2e/artifacts/host-line-cross-after.png`.

### Q71. A live host's line cut off the viewer password

A live host with a viewer reads **You are live · 720p · blurred until you set a viewer password**. When the room link drops, **reconnecting to the room…** joins the line. At 1024 and 900 the line ran out of room and ended in **blurred until y…**, so the one thing the host could act on was cut. On a desktop a service line now takes up to two lines. The chip still clears the room bar, and a small group keeps its one line. `test/e2e/cross-hostfit.js` checks it with the host at 900 wide and the viewer on another machine: it cuts the host's relay link so the reconnect note shows. Before: `test/e2e/artifacts/host-fit-cross-before.png`. After: `test/e2e/artifacts/host-fit-cross-after.png`.

### Q72. The On stage label was near-black on the dark stage

The band at the foot of the stage is always dark, but its words used the page's text color. On the light theme that is near-black, so **On stage** read at a contrast of 1.2 and 10px, on the host and on every viewer. A shared screen's name sits in the same band. The band's words are now always light (contrast 15.4), and the stage's label is 12.8px. Stadium tiles keep their small label. `test/e2e/cross-stagelabel.js` reads the label on the host and on a viewer on another machine. Before: `test/e2e/artifacts/stage-label-cross-before.png`. After: `test/e2e/artifacts/stage-label-cross-after.png`.

### Q73. The Chat icon on the dock was a dot

The dock sizes each icon to 28px, but the rule left out Chat, so its speech bubble fell back to 1.2em of the dock's 11px label: 13px, beside 28px Invite, Full screen and More. It read as a dot on the host's dock and every viewer's, and on a small group's dock too. Chat now has the same 28px icon. `test/e2e/cross-chaticon.js` reads both icons on the host and on a viewer on another machine. Before: `test/e2e/artifacts/chat-icon-cross-before.png`. After: `test/e2e/artifacts/chat-icon-cross-after.png`.

### Q74. A clap on the stage was only a count

A host saw **👏 4** on the stage and nothing about who clapped, though the room already lists the people watching. Under the pill a dark line now names them, latest first and once each: **Dee, Jo Park +2**. A viewer's own clap reads **You**. The count is unchanged, and a screen reader hears **4 claps from Dee, Jo Park and 2 others**. `test/e2e/cross-clapwho.js` has a viewer on another machine clap: the host's stage reads **Jordan Lee**, the viewer's **You**. Before: `test/e2e/artifacts/clap-who-cross-before.png`. After: `test/e2e/artifacts/clap-who-cross-after.png`.

### Q75. A viewer's header said watching three times

A joined viewer read **WATCHING · You are watching this service.** right beside **Service · You are watching**, and nothing in the header said who was live. The badge and the room bar keep saying watching; the line beside the badge now names the host: **Pastor Kim is live.** (or the first other person on the stage). Before anyone is known, the line still says **You are watching this service.** `test/e2e/cross-wholive.js` has a viewer on another machine join: the line reads **Pastor Kim is live.** Before: `test/e2e/artifacts/who-live-cross-before.png`. After: `test/e2e/artifacts/who-live-cross-after.png`.

### Q76. The lobby preview showed your camera, but the call opened dark

The lobby shows your camera live, yet every call and service opens muted with the camera off, and nothing on the preview said so. The card said **Turn the camera on here** with no camera control there, and a service's list said **Broadcasts you start or watch**. The preview now carries **You join muted, with the camera off** at its top, clear of your name; the card says to turn the camera on from the call; a service's list says **Services you start or watch show up here.** Spec `the lobby preview says you join muted with the camera off` checks 1280, 1920 and 900 for both kinds. Before: `test/e2e/artifacts/lobby-note-group-before.png`, `lobby-note-service-before.png`. After: `lobby-note-group-after.png`, `lobby-note-service-after.png`, and over a live camera `lobby-note-camera-after.png`.

### Q77. Escape left the chat open

With Chat open, the first Escape folded More and the next did nothing, so the panel kept covering the right of the stage until you found its ✕. This happened on a service host, a viewer and a small group. Escape now closes an open chat before it folds More, as a side panel closes in Meet and Zoom, and the keyboard lands back on Chat. A sheet opened over the chat (Invite) still closes first and leaves the chat open. Chat now says whether it is open (`aria-expanded`). Spec `Escape closes the chat panel and returns to the Chat button` checks 1280, 1920 and 900. `test/e2e/cross-chatesc.js` checks the host and a viewer on another machine, each with a message typed. Before: `test/e2e/artifacts/chat-esc-open-before.png`, `chat-esc-cross-before.png`. After: `chat-esc-after.png`, `chat-esc-cross-after.png`.

### Q78. The chat's close and attach buttons were only ✕ and 📎

A screen reader heard the chat's close button as "✕" and the attach button as "📎", on a service host, a viewer and a small group. Pressing close from the keyboard also left focus on the page body, so the next Tab started from the top of the page. Close is now named Close chat and returns the keyboard to Chat, as Escape does (Q77). Attach is named for its job: Pin a file to this service, or Pin a file to the meeting on a small group. Spec `the chat close and attach buttons have names, and closing returns to Chat` checks 1280 and 900. `test/e2e/cross-chatnames.js` checks the host and a viewer on another machine. Before: `test/e2e/artifacts/chat-names-before.png`. After: `chat-names-after.png`. The change is not visible in the shots; the names and focus are in the spec and cross output.

### Q79. Tab walked through eight links you could not see

After the room bar's last button, Tab stopped on eight links meant for AI agents (llms.txt, what GifOS is, the App Store, /apps/index.json, browser support, sitemap, source on GitHub, report a problem). They are clipped to 1px so agents can read them, so each stop showed no focus at all, on a service host, a viewer and a small group. run.html now takes them out of the Tab order. They stay in the HTML and in the screen reader's list of landmarks. Spec `the Tab walk in a session stops only on controls you can see` checks each Tab stop by what is drawn at its centre. `test/e2e/cross-tabwalk.js` checks the host and a viewer on another machine. Before: `test/e2e/artifacts/tab-walk-before.png` (focus on llms.txt, nothing on screen is focused). After: `tab-walk-after.png` (focus goes from the room bar back to the GifOS title).

### Q80. Tab ran the whole dock before the room bar

The room bar (Recording, who is watching, Sound) sits above the stage and the dock sits below it. Tab still went through every dock button first and only reached the room bar after End or Leave, on a service host, a viewer and a small group. The room bar came after the dock in run.html. It now comes before the dock, and the page looks the same: every box is in the same place at 1280 on a host, a viewer and a small group. Spec `Tab reaches the room bar before the dock, top to bottom`. `test/e2e/cross-taborder.js` checks the host and a viewer on another machine. Before: `test/e2e/artifacts/tab-order-before.png`, `tab-order-cross-before.png`. After: `tab-order-after.png`, `tab-order-cross-after.png`.

### Q81. Nothing listed the keyboard shortcuts

M and V worked, but only a hover title said so. Pressing ? did nothing, and the mic and camera buttons did not tell a screen reader their keys, on a service host, a viewer and a small group. Zoom and Meet each list their shortcuts. Now ? (outside a text box, in a call, not in the lobby) opens a Keyboard shortcuts sheet that lists the keys that work for that person: M and V only when the mic and camera are on their dock, then Esc, Tab, the arrow keys on the grip, and ?. Escape closes it and focus goes back. Help links to it. `#mic` and `#cam` carry `aria-keyshortcuts`. Spec `? lists the keyboard shortcuts that work here`. `test/e2e/cross-keys.js` checks the host and a viewer on another machine. Before: `test/e2e/artifacts/keys-before.png`, `keys-cross-before.png`. After: `keys-after.png`, `keys-cross-after.png`.

### Q82. Only M and V acted; Chat, Reactions and Raise hand needed a Tab walk

On a service host, a viewer and a small group, the only keys that did anything were M and V. Chat, Reactions and a viewer's hand were reached only by walking the dock with Tab. Zoom and Meet each give chat and raise hand a key. Now C opens or closes the chat with the keyboard in the message box, R opens Reactions with the keyboard on the first one, and H raises or lowers your hand where a hand can go up (a viewer, a small group; a service host has none). Escape closes either one, as before. None of them fire while you type, in the lobby, or under a sheet. The ? list names them, and Chat, React and the hand buttons carry `aria-keyshortcuts`. Spec `C, H and R open Chat, raise a hand and open Reactions`. `test/e2e/cross-keys2.js` checks the host and a viewer on another machine, and that the host sees the viewer's H in the raised-hands line. Before: `test/e2e/artifacts/keys2-before.png`, `keys2-cross-before.png`. After: `keys2-after.png`, `keys2-cross-after.png`.

### Q83. The raised-hands line read near-black on the dark page

When a viewer raised a hand, the host's line above the stage read "✋ 1 waiting:" in near-black (1.1:1 against the page) and the first name in a dim blue (4.1:1). The session page is always dark, but the line took its colors from the light theme (`--text`, `--accent`). It is now light text with a light blue name (15.9:1 and 9.2:1), on a service host and a small group. Spec `the raised-hands line is readable on the dark page`. `test/e2e/cross-handq.js` has a viewer on another machine press H and reads the host's colors. Before: `test/e2e/artifacts/handq-before.png`, `handq-cross-before.png`. After: `handq-after.png`, `handq-cross-after.png`.

### Q84. The vote sheet's hints and Cancel were hard to read

In a small group's Place a vote sheet, the hint under Vote onto stage and Vote off stage was near-black on the dark option buttons (1:1): the hint took the light theme's `--text`, but those two buttons are always dark. Cancel was pale grey on the white sheet (1.7:1). The two hints are now light (9.7:1), and Cancel takes the sheet's own text color (16.8:1). Vote out of room was already readable. Spec `the vote sheet is readable in a small group`. `test/e2e/cross-votesheet.js` puts two people in a call on two machines and reads the first person's sheet. Before: `test/e2e/artifacts/vote-sheet-before.png`, `vote-cross-before.png`. After: `vote-sheet-after.png`, `vote-cross-after.png`.

### Q85. Full screen had no key, its close read ✕, and Escape folded More under it

On a service host, a viewer and a small group, Full screen was reached only by walking the dock with Tab. Zoom and YouTube give it a key. Its close button read only "✕" to a screen reader. When the browser kept the view out of real full screen, Escape reached the page and folded More beneath the black view instead of closing it. Closing left the keyboard on nothing, and in real full screen a refocus failed because the rest of the page stays inert until the exit lands. Now F opens Full screen with the keyboard on its close button, named Exit full screen. F again or Escape closes it, and the keyboard lands back on Full screen once the exit lands. F does not fire while you type, in the lobby, or under a sheet. The ? list names it, and the button carries `aria-keyshortcuts`. Spec `F opens Full screen, Escape closes it, and its close button is named`. `test/e2e/cross-fskey.js` checks the host and a viewer on another machine in real full screen. Before: `test/e2e/artifacts/fskey-before.png`, `fskey-cross-before.png`. After: `fskey-after.png`, `fskey-cross-after.png`.

### Q86. Full screen of a camera-off host was a black screen

With the host's camera off, the stage shows their picture or initial, their name, and **Camera off** (Q66). Full screen on the host and on every viewer showed the black frame under that card instead, with only the close button on it. Full screen now shows the same card, big: the picture or initial, the name, and Camera off (also on the host's own view, where the line under the room bar is out of sight). A screen share is still a picture, so it shows with no card. Spec `Full screen of a camera-off host shows who it is, not a black screen`. `test/e2e/cross-fscamoff.js` checks the host and a viewer on another machine. Before: `test/e2e/artifacts/fs-camoff-before.png`, `fs-camoff-cross-before.png`. After: `fs-camoff-after.png`, `fs-camoff-cross-after.png`.

### Q87. A viewer's stage stayed a bare frame when the feed came in after the host's status

With the host's camera off, a viewer's stage shows their picture or initial, their name, and **Camera off** (Q66). In real two-browser sessions, 2 joins in 4 showed a grey frame with no name instead, and it stayed that way. The viewer learned the camera was off before the stage feed arrived, and when the feed's tile went in, nothing repainted the card. It came up only if some later status change happened to arrive. The watcher on the stage feed now repaints the card as well as the plate, so the card is up on the first frame the tile is, and it leaves with the feed. Spec `a viewer sees the camera-off card when the stage feed arrives after the host status`. `test/e2e/cross-camofflate.js` puts the viewer on another machine and holds the feed's tile until the card is quiet, so the order happens every run. Before: `test/e2e/artifacts/camoff-late-before.png`, `camofflate-cross-before.png`. After: `camoff-late-after.png`, `camofflate-cross-after.png`.

### Q88. A joining viewer was told "The stage is clear." while the host was live

After Save, a viewer's stage read **The stage is clear.** until the host's feed came in, beside "Joining the service…" on the top line. In real two-browser sessions that lasted 0.2 to 12 seconds at every join, and it stayed after the host's status said they were on stage (the roster lists the host a beat later). The plate now says **Joining the service…** until the host is known, then **Connecting to Pastor Kim…** (the name of whoever is on stage) until the picture comes in. "The stage is clear." is kept for a stage that is known to be empty (a host knows their own stage), or a room nobody has answered from 20 seconds after joining. Three older specs read "clear" on a lone viewer no host had answered; they now place a host who is off the stage, which is what clear means. Local text only, no new messages. Spec `a joining viewer is not told the stage is clear while the host is live`. `test/e2e/cross-joinplate.js` puts the viewer on another machine and holds the feed's tile 2 seconds, so the window is there every run. Before: `test/e2e/artifacts/join-plate-before.png`, `joinplate-cross-before.png`. After: `join-plate-after.png`, `joinplate-cross-after.png`.

### Q89. The open chat covered the room bar's Sound on pill and the stage

At 1280 the chat panel (340 px, fixed to the right) lay over the room bar's Sound on pill for a host and a viewer, and over Fit in a small group. At 1024 and 900 it also hid the status line, Invite and the watching count, and the stage stayed centred under the panel. On a window 800 px or wider, `body.chatside` now follows the panel (the same observer that keeps Chat's aria-expanded) and the room bar, header chip and stage narrow by the panel's width, as Meet and Zoom do beside a side panel; Fit moves left with it, and closing the chat gives the width back. The dock is unchanged: it already floats above the panel's bottom band, which the panel keeps clear. A phone keeps the panel over the call. Layout only, nothing sent. Spec `the open chat sits beside the room bar and stage, not over them` (host, viewer, small group at 1280, 1920, 1024, 900). `test/e2e/cross-chatside.js` opens Chat on the host and on a viewer on another machine. Before: `test/e2e/artifacts/chat-side-before.png`, `chat-side-cross-before.png`, `chat-side-cross-viewer-before.png`. After: `chat-side-after.png`, `chat-side-cross-after.png`, `chat-side-cross-viewer-after.png`.

### Q90. The host's chat head wrapped the close ✕ alone onto a second row

Every button in the chat head pushed itself right (`margin-left: auto`), so at 1280 a host's Service chat head fit the title, Transcript and Turn chat off on one row and dropped the ✕ alone under them (Firefox draws the buttons a little wider, so it wrapped there first). The privacy line under the title still began with the "·" it had when it sat beside the title. Only Transcript pushes right now, the head buttons are a size smaller (.78rem, tighter padding) and never wrap their own text, and the line reads "Private to this service, gone when everyone leaves" (and small group, meeting). Layout and wording only, nothing sent. Spec `the chat head keeps its buttons on one row beside the title` (host, viewer, small group at 1280, 1920, 1024, 900). `test/e2e/cross-chathead.js` opens Chat on the host and on a viewer on another machine. Before: `test/e2e/artifacts/chat-headrow-before.png`, `chat-headrow-cross-before.png`. After: `chat-headrow-after.png`, `chat-headrow-cross-after.png`, `chat-headrow-cross-viewer-after.png`.

### Q91. The chat box cut its placeholder to "Message ever"

The chat box sat in one row between Prayer, 📎 and Send in the 340 px panel, which left it about 100 px of text room, so at every desktop width the host and each viewer read **Message ever** (and **Prayer request** lost its end with Prayer on). On a window 800 px or wider, Prayer and 📎 now take a small row above the box (36 px tall), and the box and Send share the full width, about 220 px of text room. The Tab order is unchanged: Prayer, 📎, the box, Send. A phone keeps the old row. Layout only, nothing sent. Spec `the chat box shows its whole placeholder beside Send` (host, viewer, small group at 1280, 1920, 1024, 900, plain and Prayer). `test/e2e/cross-chatbox.js` opens Chat on the host and on a viewer on another machine. Before: `test/e2e/artifacts/chat-box-before.png`, `chat-box-cross-before.png`, `chat-box-cross-viewer-before.png`. After: `chat-box-after.png`, `chat-box-cross-after.png`, `chat-box-cross-viewer-after.png`.

### Q92. With chat off, the chat box cut its line to "Chat is off for guests — you c"

When the host pressed Turn chat off, the host's box read **Chat is off for guests — you c** (310 px of text in about 220 px) and each viewer's locked box read **Chat is off — only the host c** (291 px), on the host and a viewer on another machine at 1280 and at every desktop width. The placeholders are now **Chat is off for guests** (host, 156 px) and **Chat is off for now** (viewer, 147 px); the whole sentence moves to the box's title, and the chat log still says who turned chat off and that only the host can post. Wording only, nothing sent. Spec `the chat-off placeholders fit the chat box` (host and viewer at 1280, 1920, 1024, 900, through `chatGateForTest`). `test/e2e/cross-chatoff.js` turns chat off from a real host and reads both boxes on two machines. Before: `test/e2e/artifacts/chat-off-cross-before.png`, `chat-off-cross-viewer-before.png`. After: `chat-off-host-after.png`, `chat-off-viewer-after.png`, `chat-off-cross-after.png`, `chat-off-cross-viewer-after.png`.

### Q93. The lobby card ran flush to the window's right edge

On a desktop window (701 px and wider) the white lobby card for a service and a small group sat at the window's right edge, its rounded corners cut square, while the preview kept 16 px to the left and between the two. The card kept the narrow-window `width: 100%` and added its 16 px margin, so it overflowed its column by 16 px (Firefox also let the lobby scroll sideways by 16 px). The desktop card is now `width: auto`: 16 px on every side, corners round. Layout only, nothing sent. Spec `the lobby card keeps the same gap to the right edge as the preview has to the left` (service and small group at 1280, 1920, 1024, 900, 760). `test/e2e/cross-lobedge.js` opens a small group's lobby and a service's on two machines. Before: `test/e2e/artifacts/lobby-edge-group-before.png`, `lobedge-cross-group-before.png`, `lobedge-cross-service-before.png`. After: `lobby-edge-group-after.png`, `lobby-edge-service-after.png`, `lobedge-cross-group-after.png`, `lobedge-cross-service-after.png`.

### Q94. With the chat open, the dock ran across the chat's edge

With the chat open beside the call on a desktop window, the dock stayed centred on the whole window: at 1280 the host's dock ran from 204 to 1076 px with End over the chat's edge at 940, a viewer's Leave sat over it too, and the chat kept an empty 128 px band at its bottom for the dock, its box floating above it. On a window 800 px and wider, when the dock fits in the call beside the chat, `placeDock` now centres it on the call (drag and nudge stay inside the call), and the composer moves down to the panel's bottom. A dock wider than the call (a host at 1024 and 900) keeps the old place over the chat's bottom band, the composer above it. Closing the chat puts the dock back in the window's middle. Layout only, nothing sent. Spec `with the chat open, the dock sits in the call beside it, not across its edge` (host, viewer and small group at 1280, 1920, 1024, 900). `test/e2e/cross-dockside.js` opens Chat on a live host and a viewer on another machine. Before: `test/e2e/artifacts/dock-side-before.png`, `dock-side-cross-before.png`, `dock-side-cross-viewer-before.png`. After: `dock-side-after.png`, `dock-side-cross-after.png`, `dock-side-cross-viewer-after.png`.

### Q95. With the chat open, the room bar broke its title and every pill in two

With the chat open beside the call on a 800 to 1024 px window, the call is 460 to 684 px wide, and the room bar squeezed its title and pills onto one row: a viewer at 900 read **Service · You are watching** over two lines and every pill split in two (**Not / recording**, **1 / watching**, **Sound / on**); a host at 900 read **Service · You are / live**. On a window 800 px and wider, the title and pills no longer break inside, and with the chat open the bar may put the pills on a row under the title (80 px tall instead of 52; Q89's spec now allows two rows below 1100 px). At 1100 px and wider, and with the chat closed, the bar is one row as before. Layout only, nothing sent. Spec `with the chat open, the room bar keeps each pill and its title on one line` (host, viewer and small group at 900, 800, 1024, 1280). `test/e2e/cross-airwrap.js` opens Chat on a live host and a viewer on another machine at 900x720. Before: `test/e2e/artifacts/airbar-wrap-before.png`, `airbar-wrap-cross-before.png`, `airbar-wrap-cross-viewer-before.png`. After: `airbar-wrap-after.png`, `airbar-wrap-cross-after.png`, `airbar-wrap-cross-viewer-after.png`.

### Q96. With the chat open on a small window, the dock ran over the chat

With the chat open beside the call on a 800 to 1024 px window, the call is 460 to 684 px wide, but the host's dock was 872 px and a viewer's 648 px, so the dock kept its place across the chat: at 900 the host's Chat, Share, More and End sat on the panel (dock 14 to 886, chat edge 560), and a viewer's Leave ran over the edge at 800. When the dock is wider than the call beside the chat, it now takes the phone button sizes and moves Chat, then Invite, Full screen and Share, into More, one at a time, until it fits; More shows a button for each that presses the real one, and the dock sits centred in the call. Video, Unmute, Step on or off, Raise hand, React, More and End or Leave stay on the dock. Closing the chat (Escape or ✕) brings the whole dock back and puts the keyboard on Chat. Layout only, nothing sent. Spec `with the chat open on a small window, the dock fits in the call and the rest is under More` (host, viewer and small group at 900, 800, 1024); the Escape spec now opens Invite from More when it is there. `test/e2e/cross-dockfit.js` opens Chat on a live host and a viewer on another machine at 900x720. Before: `test/e2e/artifacts/dock-fit-before.png`, `dock-fit-cross-before.png`, `dock-fit-cross-viewer-before.png`. After: `dock-fit-after.png`, `dock-fit-cross-after.png`, `dock-fit-cross-viewer-after.png`.

### Q97. The small group lobby said muted twice

The small group lobby's preview reads **You join muted, with the camera off**, and the card right beside it said it again: **You come in muted. Turn the camera on from the call if you want to be seen.** The card now says only what the preview does not: **Turn mic and camera on from the call.** It fits on one line at 900, 1280 and 1920. A service's card (**You host. People watch with the link.**) is unchanged. Words only, nothing sent. Spec `the small group lobby says muted once: the preview says it, the card does not repeat it` (1280, 1920, 900). `test/e2e/cross-lobmuted.js` opens the lobby on two machines. Before: `test/e2e/artifacts/lobby-muted-before.png`, `lobby-muted-cross-before.png`, `lobby-muted-cross-second-before.png`. After: `lobby-muted-after.png`, `lobby-muted-cross-after.png`, `lobby-muted-cross-second-after.png`.

### Q98. A service host's React tray offered Raise hand

A service host has no hand to raise: the dock gives them Step on instead of Raise hand, and H does nothing for them. But the React tray still opened on **✋ Raise hand**, and pressing it raised the host's own hand (the tray button turned blue and the hand went out to the room) at a service where the host is the one who answers hands. The host's tray now holds the four reactions (Clap, Yes, No, Laugh), centred over the dock; R lands on Clap, and Tab skips the hidden hand. A viewer's tray is unchanged: ✋ first, and pressing it puts them on the host's raised-hands line. A small group keeps ✋ for everyone. Nothing new sent; the host simply stops sending a hand. Spec `a service host's React tray has no Raise hand; a viewer's still does` (host and viewer at 1280, 1920, 900); the C/H/R key spec now looks for the first shown reaction. `test/e2e/cross-reacthand.js` opens React on a live host and a viewer on another machine, then the viewer raises a hand from the tray and the host's line must name them. Before: `test/e2e/artifacts/react-nohand-before.png`, `react-nohand-cross-before.png`, `react-nohand-cross-viewer-before.png`. After: `react-nohand-after.png`, `react-nohand-cross-after.png`, `react-nohand-cross-viewer-after.png`.

### Q99. Float in the More sheet was a small label

In the desktop More sheet, Who, Stage, Settings and Help read at 18px, but Float (shown where the browser has a mini window: Chromium, Edge) was a 13px label pressed against its icon, so it looked like a different, lesser control. It is a phone-sized icon label that the sheet never resized. On windows 800px and wider, Float's label now takes the sheet's size and weight, with 8px between the icon and the word; host and viewer alike. Phones keep the old label: bcast-mobile's call. Nothing new sent. Spec `Float in the More sheet reads at the size of Who, Stage and Settings` (viewer and host at 1920, 1280, 900; in Firefox, which has no mini window, Float must stay hidden). `test/e2e/cross-morefloat.js` opens More on a live host and a viewer on another machine and reads Float against Who on both. Before: `test/e2e/artifacts/more-float-before.png`, `more-float-cross-before.png`, `more-float-cross-viewer-before.png`. After: `more-float-after.png`, `more-float-cross-after.png`, `more-float-cross-viewer-after.png`.

### Q100. A service host's More sheet offered Hand

Q98 took ✋ Raise hand out of a service host's React tray, but the host's More sheet still had **Hand**, and pressing it raised the host's own hand at their own service (it read Lower hand and the hand went out on the host's status). A viewer's Hand sits on the dock as Raise hand, so only a host's stayed in More. A service host's More sheet now leaves Hand out; a viewer still raises a hand from the dock and the host's line names them, and a small group keeps its Hand. A page that turns out not to be the host (its key is refused) gets the Hand back. Nothing new sent; the host simply stops sending a hand. Spec `a service host's More sheet has no Hand; a viewer raises one from the dock` (host, viewer and small group at 1280, 1920, 900). `test/e2e/cross-morehand.js` opens More on a live host and a viewer on another machine, then the viewer raises a hand from the dock and the host's line must name them. Before: `test/e2e/artifacts/more-hand-before.png`, `more-hand-cross-before.png`, `more-hand-cross-viewer-before.png`. After: `more-hand-after.png`, `more-hand-cross-after.png`, `more-hand-cross-viewer-after.png`.

### Q101. The Blur row in the More sheet was small

The More sheet opens on a Blur row for anyone who sends video (a service host, a person on the stage, everyone in a small group). Under 18px buttons it was a 14px grey word and 11px Max / Min / No blur, the dark bar's sizes carried onto the light sheet, so the first row of the sheet was the hardest to read. On windows 800px and wider, Blur now reads at the sheet's 18px and weight in dark text, and Max / Min / No blur at 16px in the same 48px boxes with room around each word. Phones keep the old row: bcast-mobile's call. Nothing new sent. Spec `the Blur row in the More sheet reads at the sheet's size` (service host and small group at 1280, 1920, 900). `test/e2e/cross-moreblur.js` opens More on a live host with a viewer on another machine watching, reads the host's Blur row, and checks the viewer's sheet has none. Before: `test/e2e/artifacts/more-blur-before.png`, `more-blur-cross-before.png`, `more-blur-cross-viewer-before.png`. After: `more-blur-after.png`, `more-blur-cross-after.png`, `more-blur-cross-viewer-after.png`.

### Q102. Allow screen share broke over two lines in the More sheet

A live host's More sheet (a room admin's) has **Allow screen share**, and at 1280 it broke into "Allow screen / share" in its 168px box while every other button read on one line; the on state, **Stop guest shares**, broke too. On windows 800px and wider the sheet is now as wide as its longest label needs (four equal columns, 176px at 1280), still at least 720px and never wider than the window, or than the call when the chat is open beside it. Phones keep the old sheet: bcast-mobile's call. Nothing new sent. Spec `Allow screen share in the More sheet stays on one line` (service host and small group at 1280, 1920, 900, 800, and 1280 with the chat open; both labels). `test/e2e/cross-moreshare.js` opens More on a live host with a viewer on another machine watching, reads the button off and on, and checks the viewer's sheet has none. Before: `test/e2e/artifacts/more-share-before.png`, `more-share-cross-before.png`, `more-share-cross-viewer-before.png`. After: `more-share-after.png`, `more-share-cross-after.png`, `more-share-cross-viewer-after.png`.

### Q103. Share was the only dock control without a key

M, V, C, R, H and F each pressed a dock control, but Share took a Tab walk through the dock, on a service host, an allowed viewer and a small group. Zoom gives sharing a key. Now S opens the Share sheet with the keyboard on Choose what to share…, or stops a share that is on, wherever this person has Share: the dock, More, or More's stand-in when the dock is squeezed beside the chat (Q96). Escape closes the sheet and the keyboard lands back on Share, or on More when Share is folded under it. A viewer the host has not allowed to share has no Share, so S does nothing for them and the ? list leaves it out. S does not fire while you type, in the lobby, or under a sheet. The ? list names it, and Share carries `aria-keyshortcuts`. Nothing new sent. Spec `S opens Share where you can share, and the ? list names it` (service host at 1280, small group, host at 800 with the chat open). `test/e2e/cross-sharekey.js` checks a host and a viewer on another machine, before and after the host presses Allow screen share. Before: `test/e2e/artifacts/sharekey-before.png`, `sharekey-cross-before.png`, `sharekey-cross-viewer-before.png`. After: `sharekey-after.png`, `sharekey-cross-after.png`, `sharekey-cross-viewer-after.png`.

## Open

A recording card names who is recording, and the bar stays Recording (Q22). Trust stays short of Zoom and Teams: there is no waiting room, and the card does not hold the recording until the other people have answered. FaceTime is still ahead on how little chrome a personal call shows. The dock tucks on a small group, and Fit leaves with it (Q35). A service keeps the dock and hides Fit (Q44). Service chat keeps its title on one line (Q45). Service help says Raise hand and Step off (Q46). Full screen on a service shows the stage (Q47). The service password sheet says Viewer password (Q48). Who is watching talks about the service (Q49). A host alone gets Invite in the chip, and the live sentence stays (Q50). A host shares the stage from the dock (Q51). Settings on a service says the stage (Q52). The Chat tip on a service talks about the people watching (Q53). Settings on a service is called Service settings (Q54). A file pinned from service chat is pinned to the service (Q55). Run app and Float talk about the service (Q56). A host ends the service from the dock. A viewer still leaves (Q57). A service recording captures the stage (Q58). A clap on a service shows on the stage (Q59). Float on an empty stage says there is nothing to float yet (Q60). Viewer claps add up on the stage (Q61). A clap made as the link opens reaches the host (Q65). A host with the camera off shows as an initial or picture, a name, and Camera off on the stage (Q66). Sound on the room bar mutes the stage on this device (Q62). The room bar, the mute line, and the status chip stay. The lobby stays at 4: one button, and the other ways in are still on the first screen. Labeled controls stay at 4. Share is on a small-group dock (Q34), and Zoom’s bar is still the reference. The viewer join sentence is on the sheet (Q38). A viewer raises a hand from the dock (Q39). A promoted viewer steps off from a red dock button (Q40). On stage with the camera off, the stage says so (Q41). The room bar says Service · You are on stage (Q42). The top line and the badge say On stage (Q43). The raised-hands list and promote and demote stay with the role-controls work (Q32). A viewer at the name card has no Video or Unmute (Q67). A viewer reads that they are watching, and a live host reads that they are live (Q69, Q70). The stage label is light on the dark band (Q72). The Chat icon on the dock is as large as its neighbours (Q73). The clap pill names who clapped (Q74). A viewer's line names who is live (Q75). The lobby preview says you join muted with the camera off (Q76). Escape closes the chat (Q77). The chat's close and attach buttons have names (Q78). Tab stops only on controls you can see (Q79). Tab reaches the room bar before the dock (Q80). ? lists the keyboard shortcuts (Q81). C, R and H open Chat, Reactions and raise a hand (Q82). The raised-hands line is light on the dark page (Q83). The vote sheet is readable (Q84). F opens Full screen, and Escape closes it (Q85). Full screen of a camera-off host shows who it is (Q86). The card comes up when the feed arrives late (Q87). A joining viewer reads Joining the service… and then Connecting to the host, not The stage is clear (Q88). The open chat sits beside the room bar and stage (Q89). The chat head keeps its buttons on one row (Q90). The chat box shows its whole placeholder (Q91). With chat off, the box still shows its whole line (Q92). The lobby card keeps its gap to the right edge (Q93). With the chat open, the dock sits in the call beside it (Q94). With the chat open, the room bar keeps each pill on one line (Q95). With the chat open on a small window, the dock fits in the call and the rest is under More (Q96). The small group lobby says muted once, on the preview (Q97). Float in the More sheet reads like the rest of the sheet (Q99). A service host has no Hand in More (Q100). The Blur row in More reads at the sheet's size (Q101). Allow screen share in More stays on one line (Q102). S opens Share (Q103).

## How a session was opened without a relay

`run.html#mb=1&v=<room>&av=<16+ hex>&bc=1` adds `body.meet-session` and `body.broadcast` without knocking the network. Hash-only navigations do not re-run boot; tests must load that URL as a full navigation.
