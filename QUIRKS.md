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

## Open

A recording card names who is recording, and the bar stays Recording (Q22). Trust stays short of Zoom and Teams: there is no waiting room, and the card does not hold the recording until the other people have answered. FaceTime is still ahead on how little chrome a personal call shows. The dock tucks on a small group, and Fit leaves with it (Q35). A service keeps the dock and hides Fit (Q44). Service chat keeps its title on one line (Q45). Service help says Raise hand and Step off (Q46). Full screen on a service shows the stage (Q47). The service password sheet says Viewer password (Q48). Who is watching talks about the service (Q49). A host alone gets Invite in the chip, and the live sentence stays (Q50). A host shares the stage from the dock (Q51). Settings on a service says the stage (Q52). The Chat tip on a service talks about the people watching (Q53). Settings on a service is called Service settings (Q54). A file pinned from service chat is pinned to the service (Q55). Run app and Float talk about the service (Q56). A host ends the service from the dock. A viewer still leaves (Q57). A service recording captures the stage (Q58). A clap on a service shows on the stage (Q59). Float on an empty stage says there is nothing to float yet (Q60). Viewer claps add up on the stage (Q61). A clap made as the link opens reaches the host (Q65). Sound on the room bar mutes the stage on this device (Q62). The room bar, the mute line, and the status chip stay. The lobby stays at 4: one button, and the other ways in are still on the first screen. Labeled controls stay at 4. Share is on a small-group dock (Q34), and Zoom’s bar is still the reference. The viewer join sentence is on the sheet (Q38). A viewer raises a hand from the dock (Q39). A promoted viewer steps off from a red dock button (Q40). On stage with the camera off, the stage says so (Q41). The room bar says Service · You are on stage (Q42). The top line and the badge say On stage (Q43). The raised-hands list and promote and demote stay with the role-controls work (Q32). The watcher Video and Unmute leak stays with that work too.

## How a session was opened without a relay

`run.html#mb=1&v=<room>&av=<16+ hex>&bc=1` adds `body.meet-session` and `body.broadcast` without knocking the network. Hash-only navigations do not re-run boot; tests must load that URL as a full navigation.
