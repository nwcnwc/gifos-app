# Broadcast and meeting mobile quirks

Role-play pass on `run.html` (Broadcast is this page with `#bc=1`). Served locally and driven with Playwright Chromium, touch, mobile emulation.

Devices: iPhone SE (320×568), iPhone 15 (393×659), Pixel 7 (412×839), a 360×740 Android, each in portrait and landscape.

Personas: church volunteer starting a broadcast, late viewer on a shared link, flaky connection, low-vision at a 32px root font, broadcaster who needs to flip cameras.

Screenshots for the open bugs are in `test/mobile/screenshots/before/`.

## Open

## Fixed

### Q66. A viewer had to hunt for Hand

The join line says a viewer is seen only if they raise a hand. On an iPhone SE the dock was React, More, and Leave, and Hand was a 0×0 control inside More. Hand now sits on the dock, 44×44, before React, with Leave still inside the screen at x=214. A tap raises the hand and the button reads Lower. A town hall watcher gets the same dock. A meeting, a host, and a person called on stage keep Hand in More. `test/mobile/hand-dock.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-hand-dock.png`. After: `test/mobile/screenshots/after/iphone-se-hand-dock.png`.

Design: the action the screen asked for is on the dock. Church and corporate stay at 4. Someone who arrives after a service has ended still cannot watch it.

### Q65. A raised hand was hidden under OFF AIR

The hand line sat at the top of an iPhone SE, 24px tall, in 12.8px type. A name was 31×18. The OFF AIR banner is 44px and covered it, so the tap landed on the banner. The line now sits under the chip. The name is 117×44, and that name is the tap. The friend-link card moves below the line, starting at y=204. A town hall host still reaches Invite. A meeting keeps the line in the page. Who can be called up is unchanged. `test/mobile/hand-queue.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-hands.png`. After: `test/mobile/screenshots/after/iphone-se-hands.png`.

Design: a raised hand is a tap on the phone. Church stays at 4. Someone who arrives after a service has ended still cannot watch it.

### Q64. An empty town hall was the invite sentence on a dark stage

A town hall host alone on an iPhone SE read “Just you — send the invite; the link has no expiry” in the chip. The stage was dark, and Invite was not there. The stage now says “The town hall has not started.” The chip names the room and offers a blue Invite, 75×44. The shared link carries `th=1` and leaves the password out. A wide screen keeps the invite sentence and hides the button. A watcher does not get Invite. A meeting still asks its host to send the invite. The camera stays on the dock. A speaker still fills the stage, and the sentence steps aside. `test/mobile/town-hall-join.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-town-hall-empty.png`. After: `test/mobile/screenshots/after/iphone-se-town-hall-empty.png`.

Design: the empty hall says what it is, and Invite is the next tap. Corporate stays at 4. Someone who arrives after a service or stream has ended still cannot watch it.

### Q63. A town hall host saw a meeting gallery

The host’s own tile filled an iPhone SE, 316×504, named “Guest … (you).” The gallery is gone. The host’s room is the stage. A speaker fills that screen. The invite line stays while they are alone, and the camera stays on the dock. A watcher is unchanged. A meeting still shows the gallery. `test/mobile/town-hall-join.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-town-hall-host.png`. After: `test/mobile/screenshots/after/iphone-se-town-hall-host.png`.

Design: the host looks at the stage. Corporate stays at 4. The empty hall is still the invite sentence on a dark stage.

### Q62. An ended service had nothing to watch

The stage said “The service has ended.” and stopped there. A viewer who watched the stage now gets Watch on that screen. It plays the picture they just saw, filling the phone, and Close leaves the file where it is. A stream says the same thing. A service that has not started has no Watch. The host still uses Record. `test/mobile/viewer-replay.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-viewer-replay.png`. After: `test/mobile/screenshots/after/iphone-se-viewer-replay.png`.

Design: what you watched is still there. Church and personal stay at 4. Someone who arrives after it ended still has nothing to watch. The town hall host still sees the room as a gallery.

### Q61. A broadcast speaker was a small card

The program was a rounded card, 304×171, parked at the top of an iPhone SE. It now fills the phone, 320×568, with square corners. The frame stays whole. “On stage” sits above the dock. The “has not started” line stays off while someone is up, and it stays when the stage is empty. A meeting speaker stays a tile. `test/mobile/broadcast-stage.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-broadcast-stage.png`. After: `test/mobile/screenshots/after/iphone-se-broadcast-stage.png`.

Design: the program is the phone. Church and personal stay at 4. A viewer still cannot watch the ended service.

### Q60. A finished recording never played

Stopping a recording on the phone downloaded a file and left the call where it was. The picture that was just captured never came back. On a phone that recording now plays. The picture fills the screen, a slider moves through it, and a tap pauses it. Save keeps the file. Close keeps it too, unless it was already saved. A wide screen still downloads. A viewer whose service has ended still has nothing to watch. `test/mobile/replay.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-replay.png`. After: `test/mobile/screenshots/after/iphone-se-replay.png`.

Design: the recording is something you can watch. Church and personal stay at 4. A viewer still cannot watch the ended service.

### Q59. Go live was a white sheet under the picture

The camera filled 320×504 of an iPhone SE, and a white bar sat under it with Go live. The picture now fills the phone, 320×568. Go live is a button on that picture, and a tap on the picture is that same button. Sunday morning and Friday night stay on the picture. More still opens Watch and the host key. The host key is still minted. A short landscape keeps the strip so Go live stays on the screen. `test/mobile/action-buttons.spec.mjs`, `test/mobile/create-one-password.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-go-live.png`. After: `test/mobile/screenshots/after/iphone-se-go-live.png`, `test/mobile/screenshots/after/iphone-se-stream-go-live.png`.

Design: the picture is the tap. Church and personal stay at 4. There is still no replay.

### Q58. A town hall speaker was a meeting tile

The stage strip was a 16:9 card, 320×180, parked at the top of the phone. A speaker now fills the watcher’s screen. The picture is cover, the corners are square, and the short side stays at least 120px. “On stage” sits above the dock. The “has not started” line stays off while a speaker is up. A meeting speaker stays a tile. The host still has the gallery. `test/mobile/town-hall-join.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-town-hall-speaker.png`. After: `test/mobile/screenshots/after/iphone-se-town-hall-speaker.png`.

Design: the speaker is the stage. Corporate stays at 4. FaceTime is still one tap, and that tap is the whole screen.

### Q57. A town hall watcher filled the phone with their own tile

The gallery gave a watcher a meeting tile of themselves, 316×504 on an iPhone SE, while the stage sat off screen. The watcher’s room is now the stage. Their tile is gone. The stage says “The town hall has not started.” The host still has the gallery, and still keeps the camera. A meeting still shows the gallery. `test/mobile/town-hall-join.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-town-hall-gallery.png`. After: `test/mobile/screenshots/after/iphone-se-town-hall-gallery.png`.

Design: a watcher looks at the stage. Corporate stays at 4. A speaker on that stage is still a meeting tile.

### Q56. A town hall viewer got a meeting’s camera and mic

Opening a town hall put Camera, Flip, and Unmute on the dock, then Blur, Run app, Share screen, Password, and Record in More. A watcher now gets React, More, and Leave. Hand, Chat, and Admin sign-in stay. The host, who holds the room key, keeps the camera and the mic. A stage grant puts the watcher’s camera and mic back. A meeting is unchanged. `test/mobile/town-hall-join.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-town-hall-dock.png`. After: `test/mobile/screenshots/after/iphone-se-town-hall-dock.png`.

Design: a town hall watcher is here to watch. Corporate stays at 4. The room can still show a meeting’s gallery.

### Q55. The phone dock had no words

Camera, Flip, the mic, React, More, and Leave were icons. A tall phone now prints the word on each one: Camera, Flip, Unmute, React, More, Leave. The mic is the only Unmute. When the mic is on, that same word becomes Mute. A broadcast viewer’s mic stays hidden, so they do not get an Unmute. A short landscape keeps the thin strip of marks and hides the words. `test/mobile/dock-labels.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-dock-labels.png`. After: `test/mobile/screenshots/after/iphone-se-dock-labels.png`.

Design: one word on the control, and one Unmute. Church, corporate, and personal stay at 4.

### Q54. A viewer alone was told to send the invite

A church viewer who opened a quiet service, and a friend who opened a quiet stream, read “Just you — send the invite; the link has no expiry.” That line is the host’s. The stage now says “The service has not started.” or “The stream has not started.” The chip says the same thing, and the banner stays OFF AIR. Once this tab has seen someone else in the room and the room is empty again, the stage says “The service has ended.” or “The stream has ended.” A host who is alone still gets Invite. A town hall viewer still reads that the hall has not started. A meeting still gets the invite line. `test/mobile/broadcast-ended.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-viewer-ended.png`. After: `test/mobile/screenshots/after/iphone-se-viewer-ended.png`, `test/mobile/screenshots/after/iphone-se-service-ended.png`.

Design: the empty stage is the sentence, the way a player says the broadcast has not started or has ended. Church and personal stay at 4. There is still no replay.

### Q53. A host alone was told to send the invite

The chip said “Just you — send the invite; the link has no expiry.” On a phone that sentence is a blue Invite button. It opens the share sheet, or copies the viewer link when the phone has no share sheet. The viewer password is not in the link or the words. The button goes away once someone joins. A viewer does not get it. Wide screens keep the sentence: `.topchip[data-invite="1"]` and `__gifosVideo.shareInvite` are there for the desktop Broadcast agent. `test/mobile/header-invite.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-host-alone.png`. After: `test/mobile/screenshots/after/iphone-se-host-invite.png`.

Design: the same blue Invite Meet uses when you are alone. Church stays at 4.

### Q52. The join sheet said “This is how you’ll appear” twice

The title and the line under it were the same sentence. The title stays. The repeat is gone on a meeting and on a town hall host. A broadcast viewer keeps that line, and it now says “Only seen if you raise your hand and are promoted to the stage.” A broadcast host still skips the sheet. A town hall viewer still skips it. `test/mobile/appear-preview.spec.mjs`, `test/mobile/viewer-join.spec.mjs`, `test/mobile/town-hall-join.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-join-double.png`. After: `test/mobile/screenshots/after/iphone-se-join-sheet.png`, `test/mobile/screenshots/after/iphone-se-broadcast-viewer-join.png`.

Design: one title, and a second line only when it says something the title does not. Church stays at 4.

### Q51. A town hall viewer was told to send the invite

Opening a town hall link skipped the appearance step and then said “Just you — send the invite; the link has no expiry.” That line is the host’s. A viewer now reads “The town hall has not started.” A host who holds the room key still gets the invite line. A meeting still gets it. `test/mobile/town-hall-join.spec.mjs`.

Design: a viewer waits for the town hall. Corporate stays at 4. The room still wears a meeting’s controls.

### Q50. A town hall viewer stopped on the appearance step

A person opening a town hall link saw “This is how you’ll appear in the town hall” before they could watch. They watch off camera, the way a church viewer does, so that step is gone. The title stays Town hall, and Leave the town hall stays the leave control. The camera control stays on the dock. A host who already holds the room key still gets the appearance step. A meeting still gets it. `test/mobile/town-hall-join.spec.mjs`.

Design: a viewer lands in the town hall. Corporate stays at 4. The room still wears a meeting’s controls.

### Q49. Watch and the host key sat on the go-live sheet

The sheet under the picture held Go live, then Watch, then Change host key. The sheet is now Go live. More sits on the picture and opens Watch and the host key, including Generate. The key is still minted. On an iPhone SE the name is y=422 to y=470 and Go live is y=508, the full width of the sheet. A stream uses the same sheet. `test/mobile/create-one-password.spec.mjs`, `test/mobile/action-buttons.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-service-desk.png`, `test/mobile/screenshots/after/iphone-se-stream-name.png`.

Design: the picture, the filled name, then the blue Go live. Church and personal stay at 4. FaceTime is one tap, and that tap is the whole screen.

### Q48. Go live on a service sat under the service name

Sunday morning was a field in the sheet, above Go live. It now sits on the picture, and Go live is the first control in the sheet. On an iPhone SE the name is y=294 to y=342 and Go live is y=380. Watch a service stays under it. The host key is still minted. A blank name still goes live as Sunday morning. `test/mobile/create-one-password.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-service-desk.png`.

Design: the picture, the filled service name, then the blue Go live. Church stays at 4. Watch and the host key still share the sheet.

### Q47. The stream sheet asked for a name before Go live

A stream opened with an empty-looking name field above Go live, so the sheet was the first thing in the way. The name now opens as Friday night and sits on the picture, 12px above the sheet. On an iPhone SE the field is y=294 to y=342 and Go live is y=380, the first control in the sheet. Watch a stream stays under it. The host key is still minted. From the meeting lobby, Stream sits beside Open meeting and opens this desk. A blank name still goes live as Friday night. `test/mobile/create-one-password.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-stream-name.png`.

Design: the picture, the filled name, then the blue Go live. Personal stays at 4. Watch and the host key still share the sheet. FaceTime is one tap.

### Q46. A church desk opened as a stream named Friday night

`#bc=1` said Stream, “Friends watch with the link.”, and Friday night. It now says Service, “People watch with the link.”, Service name, and Sunday morning. Go live stays the blue button. Watch a service is the outline under it. A blank name uses Sunday morning. The host key is still minted. The link on the stage says “People watch with this link.” `test/mobile/create-one-password.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-service-desk.png`.

Design: the picture, the service name, the blue Go live. Church stays at 4. Go live still sits in a sheet under the picture.

### Q45. A quiet service read RECONNECTING

A viewer opening a service that had not started, or that this phone had not reached, saw an amber RECONNECTING banner. Nothing had dropped. The banner now says OFF AIR, the same word a host sees before the picture is up. RECONNECTING stays for a link that dropped, a door they are knocking on again, or a network that cannot get through. A host who is already sending a picture still reads RECONNECTING while the room is out. `test/mobile/live-badge.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-viewer-offair.png`.

Design: one grey banner, OFF AIR, until the service is there. Church stays at 4. The desk opens as a service.

### Q44. A stream on a phone was a form with a strip of camera

The camera sat in a 72px strip and the white sheet was the screen. On a phone the picture is now the top of the screen, 292px tall on an iPhone SE. Stream and “Friends watch with the link.” sit on the picture. The sheet under it is the name, Go live, and Watch. Change host key and Add a viewer password share the row under Watch. The host key is still minted. Opening it brings Generate onto the screen. A short landscape keeps the strip so Go live stays on the screen. `test/mobile/create-one-password.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-stream-preview.png`.

Design: the picture, then the name, the blue Go live, the outline Watch. Personal stays at 4. The sheet still asks for a name. FaceTime is one tap.

### Q43. A town hall joiner landed in a meeting

The link from Start a town hall opened as a meeting: “in the meeting,” and a meeting title. The link now carries `th=1` (`?th=1` on a pretty `/meet` path, `&th=1` in the hash). A joiner lands in the town hall. The title is Town hall. The first sentence is “This is how you’ll appear in the town hall.” Leave says Leave the town hall. The shared link keeps the flag. A meeting without the flag still says meeting. The camera, the stage, and the host key are unchanged. `test/mobile/town-hall-join.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-town-hall-join.png`.

Design: the same room, named for what they joined. Corporate stays at 4. They still pass an appearance step.

### Q42. A church viewer still stopped to give a name

Opening a service showed Watching the service, a name, and Save. The name is already seeded for the knock, and Settings still holds it, so that step is gone. A viewer lands on the service. Stop watching stays the leave control. The camera stays off. A meeting still gets the appearance step. `test/mobile/viewer-join.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-viewer-straight.png`.

Design: the service is the screen. Church stays at 4. A quiet service reads OFF AIR. The desk they start from is a stream named Friday night.

### Q41. Go live left the camera off

A stream host landed off air and had to tap the camera. Go live now turns the camera on. The mic stays quiet. A reload that already chose keeps that choice. A meeting still joins with the camera off. The friend link becomes a row above the dock, y=422 to y=486 on an iPhone SE, so the picture stays the stage. Blur stays on the video. There is no separate picture laid over it. `test/mobile/viewer-join.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-stream-live.png`.

Design: the stage is the camera, Copy sits on the dock. Personal stays at 4. The first screen is still a form. FaceTime is the preview.

### Q40. The friend link was a later hunt

Go live opened off air, and the link lived behind More. The off-air stage now says “Friends watch with this link.” with the link and Copy. On an iPhone SE the card runs y=118 to y=285, under the title chip, and Copy is 48px, above the dock. A short landscape keeps the card between the chip and the dock. The camera still puts the picture on, and then the card leaves. A viewer does not see it. A meeting does not see it. `test/mobile/viewer-join.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-stream-link.png`.

Design: one white card, one sentence, the link, one blue Copy. Personal stays at 4. The picture is still a separate camera tap. FaceTime is still that camera.

### Q39. A stream asked for a name, then another sheet

Go live did nothing until a name was typed, and the next screen was “This is how you’ll appear in the meeting.” The name now opens as Friday night. A blank name uses that too, so Go live is one tap. A host who holds the room key lands on the stream. A viewer still gets Watching the service. A meeting still gets the appearance step. The host key is still minted. `test/mobile/create-one-password.spec.mjs`, `test/mobile/viewer-join.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-stream-friends.png`.

Design: the name is ready, then the blue Go live. Personal stays at 4. The stream opens off air, and the friend link is still another step. FaceTime is still one tap.

### Q38. A stream to friends opened as a church service

`#bc=1` said Broadcast, Service name, Sunday morning, and Watch a broadcast. It now says Stream, “Friends watch with the link.”, Name, and Friday night. Go live stays the blue button. Watch a stream is the outline under it. An empty name says “Name it first.” Change host key and Add a viewer password stay under Watch, and the key is still minted. A short landscape hides the sentence with the title so Go live stays on the screen. `test/mobile/create-one-password.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-stream-friends.png`.

Design: Stream, one sentence, the name, the blue Go live, then the outline Watch. Personal stays at 4. FaceTime is still one tap, and this still mints a host key.

### Q37. A meeting lobby led with an open room

The filled button was Start a meeting, an open room with no host. Start a room you run talked about a password and banning someone. The filled button is now Start a town hall. It opens the host form: Town hall, Your host key, Generate, and Create & enter. Start an open meeting stays underneath, unfilled. `test/mobile/create-one-password.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-town-hall.png`.

Design: one blue town hall, then an outline open meeting, then Join a link. The host key stays on the form, the way a meeting room you run is built. Corporate stays at 4. A town hall still asks the host for a key, and people who join still land in a meeting.

### Q36. A church viewer was asked to appear in the meeting

Opening a service link showed “This is how you’ll appear in the meeting” and Preview camera. A viewer stays off camera. The step now says “Watching the service” and “You stay off camera. A name shows only if you chat.” Preview camera is gone. Clear and Save stay. Stop watching replaces Hang up. A host who holds the room’s key still gets the appearance step and Preview camera. `test/mobile/viewer-join.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-viewer-watch.png`.

Design: one sentence, the name, Clear and Save. No camera. Church stays at 4. They still pass a name step before the service is the whole screen.

### Q35. Change host key sat above Go live

A broadcast opened on the service name, then Change host key, then Go live. The key was in the path. Go live now sits under the name, Watch under that, and Change host key under Watch. On an iPhone SE the name is y=130 to y=178, Go live y=198 to y=246, Watch y=258 to y=307, and Change host key y=321. Opening it shows Your host key, the readable three-word key, and Generate, from y=317. The key is still minted and stored. A meeting still shows the host key above Create & enter. `test/mobile/create-one-password.spec.mjs`.

Before: `test/mobile/screenshots/after/iphone-se-service-first.png`.
After: `test/mobile/screenshots/after/iphone-se-service-desk.png` and `test/mobile/screenshots/after/iphone-se-host-key-open.png`.

Design: the name, the blue Go live, then the outline Watch. The host key is a text link under that, and opening it is the same readable key the meeting uses. Warm copy stays at 4. A church desk still does not list a host key.

### Q34. A rotated strip was still a tall band

The frosted pill was 48px with 22px marks. It is now 36px, and the marks are 18px. The targets stay 44px, so a thumb still lands, and they sit a little proud of the strip. Hang up stays the solid red control. On an iPhone SE landscape the pill is y=270 to y=306 and the face is y=59 to y=320, 560×261. A 32px root grows the strip to 48px and the marks to 24px. `test/mobile/landscape-stage.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-landscape-thin.png`.

Design: a thin frosted line, small marks, and one red Hang up. Landscape stays at 4. Meet’s strip is still a little thinner. The face stays a stage.

### Q33. A short landscape dock ignored a larger text size

At a 32px root the portrait dock grows to 88px, and the rotated dock stayed 44px inside a 48px pill. It now follows the root size up to 56px controls and a 64px pill. On an iPhone SE landscape the controls are 56px, the glyphs are 28px, and the pill runs y=242 to y=306. The face stays y=87 to y=320, 560×233. The pill covers 78px of that tile, under half. A 16px root still paints the 44px glyphs in a 48px pill. `test/mobile/dock-scale.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-landscape-type.png`.

Design: the rotated controls get larger with the text, and Hang up stays the only red. The picture stays a stage under the chip. Large type stays at 4. The rotated dock stops at 56px so the face is not a strip. FaceTime still wins that dimension.

### Q32. A rotated dock painted solid discs on the picture

The frosted pill still carried grey circles, so each control hid a 44px patch of the face. On a short landscape those circles are gone. Camera, flip, mic, reactions, and More are 22px glyphs on the translucent pill, with the 44px target kept. Hang up stays the solid red control. The face is still y=59 to y=320 on an iPhone SE landscape. `test/mobile/landscape-stage.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-landscape-glyphs.png`.

Design: the picture reads through the strip, and the only filled control is Hang up. Landscape stays at 4. The glyphs still sit in a 48px pill. Meet’s marks are smaller and its strip is thinner, so more of the face stays clear.

### Q31. Not now and Continue did not say how you join

The join step is the same screen for a meeting and a broadcast. The outline button said Not now and the blue button said Continue. They now say Clear and Save. Clear empties the name field and the picture in the form and leaves the step open. Save closes it and keeps whatever the form is showing. Clearing and then saving joins with no stored name and no picture. Saving without clearing keeps Ada Lovelace and the picture. Save stays the only filled button (`#0064c8`). Clear stays the outline, 12px away, both at least 44px. `test/mobile/action-buttons.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-join-not-now.png`.
After: `test/mobile/screenshots/after/iphone-se-join-save.png` and `test/mobile/screenshots/after/iphone-se-join-clear.png`.

Design: the preview, the field, then Clear and Save. Save is the blue button. After Clear the face is an empty circle and the field shows its placeholder, so the blank is what you would be saving. Warm copy stays at 4. A church desk still goes on with no host key.

### Q30. A 200% text size still capped the dock at 64px

The phone controls followed the root size only up to 64px, and Hang up up to 72px. They now follow `2.75rem` up to 88px, and Hang up follows `3rem` up to 96px. At a 32px root on iPhone SE the dock is two rows: camera, flip, and mic at y=356, 88px; reactions, More, and Hang up at y=452, with Hang up 96px. The bar is 312×204, from y=350. The face stays 316×504. The dock covers 218px of that tile, under half. Gaps on a row are 8px. A short landscape stays a 44px row inside a 48px pill. `test/mobile/dock-scale.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-dock-88.png`.

Design: the controls are the large type, two rows, 8px apart, Hang up still the only red. The picture stays a stage under the chip. Large type stays at 4. A short landscape does not grow, and FaceTime still wins that dimension.

### Q29. The dock on a rotated picture was a solid white slab

The 48px pill was `rgba(255,255,255,.94)`, so the strip hid the picture it sat on. It is now `rgba(255,255,255,.58)` with a 16px blur. The face is still y=59 to y=320 on an iPhone SE landscape, and the pill is still y=258 to y=306. The round controls stay solid, so a chin behind a button is still covered. `test/mobile/landscape-stage.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-landscape-glass.png`.

Design: the gaps in the pill show the picture, and Hang up stays a solid red. Landscape stays at 4. The controls are still solid discs. Meet draws smaller glyphs on its strip, so more of the face stays readable.

### Q28. A rotated call still gave up a band when the controls came back

A tap used to lift the face so a 56px dock could sit under it. The face now stays put, from just under the title chip to the bottom of the phone. On an iPhone SE landscape the chip is y=14 to y=53 and the face is y=59 to y=320, 560×261. The dock is a 48px pill, y=258 to y=306, laid on that picture. Camera and Hang up stay 44px. A 32px root does not grow this row. The short side of the face stays well above 120px. `test/mobile/landscape-stage.spec.mjs`.

Before: `test/mobile/screenshots/after/iphone-se-landscape-chip.png`.
After: `test/mobile/screenshots/after/iphone-se-landscape-bar.png`.

Design: the picture is the phone under the chip. The dock is a white pill on the lower edge, with a little of the picture showing under it, and Hang up is the only red. Landscape stays at 4. Meet's bar is a thinner translucent strip, so the face stays easier to read while the controls are up.

### Q27. The dock stayed one size when the text grew

On a phone the controls were a fixed 44px or 56px row. They now follow the root text size, from 44px up to 64px, and Hang up from 44px up to 72px. At a 32px root on iPhone SE the row no longer fits, so the dock wraps: camera, flip, mic, and reactions on the first row at 64px, More and Hang up on the second at 64px and 72px. The bar is 312px wide and 156px tall, starting at y=398. The face stays 316×504. The dock covers less than half of that tile. Gaps on a row stay at least 8px. A short landscape keeps a single 56px row of 44px controls so a rotated face is not a strip. `test/mobile/dock-scale.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-dock-scale.png`.

Design: two rows of round controls, 8px apart, Hang up still the only red. The picture stays a stage under the chip. Large type stays at 4. The controls stop at 64px, and a short landscape does not grow. FaceTime still wins that dimension.

### Q26. A rotated meeting gave the title's band to the picture

With the controls away, the face started at y=0 and the title chip was invisible. The chip now keeps its band. On an iPhone SE landscape it sits at y=14 to y=53, and the face runs from y=59 to y=320. The dock stays off the screen (top 330) until a tap, then Hang up comes back above the chin. A second face in that box stays at least 120px on its short side. `test/mobile/landscape-stage.spec.mjs`.

Before: `test/mobile/screenshots/after/iphone-se-landscape-face.png`.
After: `test/mobile/screenshots/after/iphone-se-landscape-chip.png`.

Design: the title is a dark pill in its own band, and the picture is everything under it. The dock is gone until you tap. Landscape stays at 4. Meet still lays a thinner bar on the picture when the controls are up.

### Q25. Starting a broadcast took a tap before the service had a name

The lobby opened on Start broadcasting, and the name was a second screen. A broadcast now opens on Service name and Go live. Watch a broadcast is the outline button under it. The host key is still minted and stored, and Change host key reveals it. A meeting still starts from its own buttons and still shows the host key. `test/mobile/create-one-password.spec.mjs`.

Before: `test/mobile/screenshots/after/iphone-se-service-name.png`.
After: `test/mobile/screenshots/after/iphone-se-service-first.png`.

Design: the preview, one label, one field, then Go live. Change host key and Add a viewer password are blue text. Watch is an outline, with air under Go live. Warm copy stays at 4. A church desk still goes on with no host key at all.

### Q24. Chat stayed small at a 200% root font

The log and the composer were `0.85rem`, and the sender’s name was `0.7rem`. They are now `1rem` and `0.875rem`. A 32px root paints the message and the field at 32px and the name at 28px. Send stays 44px or taller, and the composer sits 24px above the dock on iPhone SE. A reaction word, the blur chip, and the stadium label follow the same root size. `test/mobile/chat-scale.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-chat-scale.png`.

Design: the message is the large text, the name is a smaller blue line on the dark bubble, and Send is the same size as the field. The dock stays a fixed row under the sheet. Large type is still not a 5. FaceTime still wins that dimension. The call controls do not grow with the text.

### Q23. A rotated meeting kept the dock on the picture

A landscape iPhone SE is 568×320. The face used to stop above a 56px dock, so the call was a band between the chip and the controls. The controls now leave until you tap the picture. The face runs from y=0 to y=320, and the dock sits at y=330, off the screen. A tap brings a 56px dock back, Hang up is hittable, and the face ends above it (y=59 to y=248, dock top 250). A few seconds later the controls leave and the face takes the screen again. More and Reactions hold the dock while they are open. `test/mobile/landscape-stage.spec.mjs`.

Before: `test/mobile/screenshots/after/iphone-se-landscape-stage.png`.
After: `test/mobile/screenshots/after/iphone-se-landscape-face.png` and `test/mobile/screenshots/after/iphone-se-landscape-chrome.png`.

Design: the idle screen is the picture, with the name in the corner. A tap returns a white dock and a red Hang up, and the face moves up so the chin stays clear. Landscape stays at 4. Meet still puts a thinner bar on the picture and does not give a band back to a title chip.

### Q22. A broadcast still asked for a host key before the service had a name

The create form opened on “Your host key” and Generate, then Create & enter. A broadcast now asks for a service name and Go live. The host key is still minted and stored, and Change host key reveals it. A viewer password stays behind its own step. A meeting still shows the host key on the form. Go live sits 12px under the last text link, and on a short landscape the extra title is hidden so those links stay above the buttons. `test/mobile/create-one-password.spec.mjs`.

Before: `test/mobile/screenshots/after/iphone-se-host-key.png`.
After: `test/mobile/screenshots/after/iphone-se-service-name.png`.

Design: one label, one field, one filled button. Change host key and Add a viewer password are blue text. Cancel is an outline. Warm copy and the first screen stay at 4. You still tap Start broadcasting before the name, and a church desk still goes on with no host key at all.

### Q21. The lobby sentence stayed 14px at a 200% root font

`.lob-quiet` was 14px and the preview name was 15px. They are now `0.875rem` and `0.9375rem`. A 32px root paints them at 28px and 30px. The line is “You join muted.” on a meeting and “Your picture is the preview.” on a broadcast, so it stays one sentence. The phone preview row is at most 18vh, and the card scrolls, so Start stays on the screen. `test/mobile/lobby-scale.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-lobby-scale.png`.

Design: the sentence and the name on the preview follow the text size, and the first action is still in the card. Large type is still not a 5. FaceTime still wins that dimension.

### Q20. A rotated meeting laid the face under the dock

A landscape iPhone SE is 568×320. The layout treated any width under 600 as a portrait phone, and the dock floated over the tiles. The local face ran from y=64 to y=320, under an 88px dock whose top was 218. A short landscape now reserves 72px for the dock, the dock itself is 56px with 44px controls, and the face ends above it (y=59 to y=248, dock top 250). A second person is given that same band, at least 40% of the screen tall. `test/mobile/landscape-stage.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-landscape-stage.png`.

Design: the stage is the face, the dock is a thin row under it, and Hang up does not cover the chin. Landscape is still not a 5. Meet still hides its controls and keeps a rotated call feeling like the whole phone.

### Q19. Broadcast create still talked like a password form

The host step said “Host password” over a masked field, so a volunteer had to invent a secret before the service existed. It now says “Your host key,” the key is readable, and the form opens with one already filled. Generate replaces it with another three-word key. Create stays the only filled button. A viewer password stays behind its own step. `test/mobile/create-one-password.spec.mjs`.

Before: `test/mobile/screenshots/after/iphone-se-one-password.png`.
After: `test/mobile/screenshots/after/iphone-se-host-key.png`.

Design: one label, one short sentence, the whole key on its own line, then an outline Generate and the blue Create. On a phone the key sits above Generate so it is not cut off. Warm copy for church is still not a 5. A church desk names the service and goes on. This path still keeps a host key.

### Q18. The status sentence was cut off on one line

On a 320px phone the chip showed “Just you — send the invite; the li…”. On a screen at least 500px tall the status now wraps to two lines, and the visible text includes “the link has no expiry”. Fit drops to `14px + 4.25rem` so it stays under the taller chip (chip bottom 118, Fit top 150 at a 32px root on iPhone SE). A short landscape stays one line, so Fit does not land on the dock. `test/mobile/status-scale.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-status-wrap.png`.

Design: the instruction is readable, and Fit remains a separate control with air under the chip. Large type is still not a 5. FaceTime still wins that dimension. Warm copy for a church host stays at 3: a host password is still required before the room exists.

### Q17. Reaction labels stayed 16px at a 200% root font

Hand, Clap, Yes, No, and Laugh were `16px` on a phone and `18px` on a wide layout. They are now `1rem` and `1.125rem`. A 32px root paints them at 32px. The tray has a real width and wraps, so it stays on the screen in portrait and in a short landscape. `test/mobile/react-scale.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-react-scale.png`.

Design: two rows on a 320px phone, 8px between the words, dark type on the light cards. The open Reactions control is the blue dock button. Large type is still not a 5. The status sentence is still one line, so a 32px root cuts off the invite instruction.

### Q16. More sheet labels stayed 16px at a 200% root font

Invite, Chat, and the rest of More were `16px` on a phone and `18px` on a wide layout. Blur was `14px`. They are now `1rem`, `1.125rem`, and `0.875rem`. A 32px root paints Invite at 32px and Blur at 28px, and the sheet stays inside the screen (top 20, bottom 452 on a 568px iPhone SE). `test/mobile/more-sheet.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-more-scale.png`.

Design: the labels are the same scale as Fit. The sheet is a light card, dark type on `#e8ecf1`, three columns, and the rest scrolls. Large type is still not a 5. The reaction tray labels are still 16px.

### Q15. Fit’s label stayed 14px at a 200% root font

`.fitbtn` was `font: 700 14px/1.2` with a 32px minimum. A 32px root now paints it at 32px, and the control is at least 2.75rem (44px at the default root, 88px at 32px). It still sits under the chip. On a screen shorter than 380px the minimum stays 44px, and a broadcast banner stays 44px tall, so Fit does not land on the dock. `test/mobile/status-scale.spec.mjs` and `test/mobile/live-badge.spec.mjs`.

Before: `test/mobile/screenshots/after/iphone-se-title-scale.png` (title already scaled, Fit still 14px).
After: `test/mobile/screenshots/after/iphone-se-fit-scale.png`.

Design: Fit is a real control beside a grown chip, with about 21px of air under the chip on iPhone SE at a 32px root. Large type is still not a 5. The More sheet labels are still 16px on a phone.

### Q14. Live, off air, watching, and reconnecting were a word in the chip

The state sat in the same pill as GifOS and the status sentence, about 84px wide. On a broadcast it is now a full-width banner, 2.75rem tall (44px at the default root), above the chip. The chip keeps the name and the detail sentence, 8px under the banner. Fit drops with the chip. A meeting does not show the banner. `test/mobile/live-badge.spec.mjs`.

Before: `test/mobile/screenshots/after/iphone-se-broadcast-offair.png`.
After: `test/mobile/screenshots/after/iphone-se-broadcast-banner.png` and `test/mobile/screenshots/after/iphone-se-broadcast-reconnecting-banner.png`.

Design: the state is the only full-width color, and it is the first thing on the screen. OFF AIR is light on `#3a3a3f`, RECONNECTING is light on `#8a5a00`, LIVE is light on `#b61622`, WATCHING is light on `#0b6b3a`. The sentence underneath is the detail. This is not a 5. YouTube and StreamYard still own the program monitor and the screen a viewer gets when the broadcast has ended.

### Q13. The chip title ignored a 200% root font

`.topchip .title` was `20px` on a phone and `26px` on a wide layout, so a 32px root left the word GifOS at 20px while the status line grew to 34px. The title is now `1.25rem` on a phone and `1.625rem` on a wide layout. At a 32px root that is 40px on a phone. Fit and the admin countdown drop with `14px + 2.75rem`, so at the default 16px root they stay at 58px and at 32px they sit under the taller chip (Fit top 102, chip bottom 81 on iPhone SE). `test/mobile/status-scale.spec.mjs`.

Before: `test/mobile/screenshots/after/iphone-se-status-scale.png` (status already scaled, title still 20px).
After: `test/mobile/screenshots/after/iphone-se-title-scale.png`.

Design: the name and the status are one scale. Fit stays a separate control under the chip, with about 21px of air on a 32px root. Large type is still not a 5: Fit’s own label is `14px`. Live, off air, watching, and reconnecting stay a small chip badge.

### Q10. Compact dock buttons sat 4px apart

Once Flip joined the dock, the phone gap was 4px. It is 12px from 381px up, and 8px on a 320px phone, with every control still at least 44px and Leave still on the screen. Wider layouts keep a little extra air before Hang up. `test/mobile/dock-gap.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-dock-gap.png`.

Design: the row reads as separate controls instead of one packed cluster. Hang up still has a touch more air than its neighbors on a wide phone, which keeps the destructive action visually apart. The chip title is still a fixed pixel size, so large type for church is not finished.

### Q12. Broadcast create demanded two passwords up front

Start broadcasting opened a host-password essay and a viewer-password essay before Create. The first step is now the room name and one host password: “Only you use this. Viewers join with the link.” Add a viewer password is a 44px text button that reveals the second field. `test/mobile/create-one-password.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-two-passwords.png`.
After: `test/mobile/screenshots/after/iphone-se-one-password.png`.

Design: one label, one short sentence, one field, then the blue Create. The optional password is not a second competing form. What is still heavier than a church desk is that a host password is required at all. The dock gap (Q10) is the next measured spacing miss.

### Q11. Join actions were the same color and touched

`Not now` and `Continue` were both the accent fill, and the gap between them measured 0. Continue is now the only filled button (`#0064c8`). Not now is an outline on the white card. The row gap is 12px, and both targets are at least 44px. Cancel beside Create uses the same outline, with a 12px gap. `test/mobile/action-buttons.spec.mjs`.

Before: `test/mobile/screenshots/after/iphone-se-appear-preview.png` (the preview, still with the paired purple actions).
After: `test/mobile/screenshots/after/iphone-se-join-actions.png`.

Design: one primary, one secondary, 12px of air, and the card matches the light meeting. What still fails a design pass is the host form: two long password essays before Create, so the first screen a volunteer sees after this step is still denser than the action. The 320px dock is still a 4px gap (Q10).

### Q9b. The join step now says how you will appear

The step leads with “This is how you’ll appear in the meeting.” A face (the system picture, or a letter when there is none) sits beside the name, and the name updates as you type. Change picture writes a new GifOS picture. Preview camera shows the camera in that face and can be put back. `test/mobile/appear-preview.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-appear-preview.png`.

Design: the face and the name are one group, with 12px between them, and the edits are outline buttons rather than a second primary. The card is still the old dark surface on a light meeting, and `Not now` and `Continue` are still the same purple with no gap (Q11). That pair is the next visual failure.

### Q9. The join step ignored the GifOS name and picture

A stored `gifos_name` skipped the step, so the field never showed it. With no name, the field was empty while a `Guest` number was stored in the background. The system picture was not on the step. The step now opens with the GifOS display name in the field and the GifOS picture above it. A first visit with no name still gets a guest seed so the room can connect. `test/mobile/appear-prefill.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-name-step.png`.
After: `test/mobile/screenshots/after/iphone-se-name-prefill.png`.

Design: the picture and the name are finally the same identity as Settings. The step still fails hierarchy. `Not now` and `Continue` are the same purple, with no gap, and the heading still says “Pick a screen name” instead of showing how you will look. Contrast of the muted sentence on the dark card is the old theme, not the light meeting.

### Q1. Hang up is off the screen on a 320px and 360px phone

Measured on a meeting (`#v=sundayroom`), portrait. Leave’s right edge was 374px on both a 320px iPhone SE and a 360px Android. The dock is `width: auto` with `overflow: visible`, so the red hang-up control was only a sliver.

Below 380px the dock now uses 44px primary controls and a 48px Leave, all inside the screen. `test/mobile/dock-fit.spec.mjs` covers iPhone SE, iPhone 15, Pixel 7, and the 360px Android.

Before: `test/mobile/screenshots/before/iphone-se-meeting-dock.png`.
After: `test/mobile/screenshots/after/iphone-se-meeting-dock.png` and `test/mobile/screenshots/after/android-360-meeting-dock.png`.

### Q2. The chat field sits under the dock

Same meeting, chat opened. The message field overlapped the dock on every phone in the pass, portrait and landscape. Send was 34px tall. On iPhone SE an overlaid keyboard (visual viewport at 46% of the layout height) pushed the field into the dock again until the phone header stopped wrapping.

The composer now sits in the band above the dock (`--dock-clear`), Send and the field are at least 44px, and a `visualViewport` shrink lifts both the dock and the field. `test/mobile/chat-dock.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-meeting-chat.png`.
After: `test/mobile/screenshots/after/iphone-se-meeting-chat.png`.

### Q8. Chat header spent a third of a short screen

`#chathead` wrapped the title, the privacy sentence, Transcript, and close into about 110px on iPhone SE. On a phone the sentence is now clipped for sighted layout and kept for screen readers, and Transcript / close are 44px. That was required for Q2: the tall header pushed Send under the dock once the keyboard opened.

### Q5b. Flip was hidden until a second camera was enumerated

`#flipcam` lived in More and stayed `display: none` until `enumerateDevices` reported two video inputs, which does not happen before the camera is granted. On a phone it now sits on the dock, at least 44px, as soon as the screen is narrow or the pointer is coarse. The grip steps aside so Leave still fits. A broadcast viewer still does not get it. A desktop still waits for a second camera. `test/mobile/flip-cam.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-portrait-host.png`.
After: `test/mobile/screenshots/after/iphone-se-flip-dock.png`.

### Q6. The status line ignored a 200% root font

`document.documentElement.style.fontSize = '32px'`. Lobby actions use `rem`. `.topchip .status` stayed `17px` on a phone and `20px` on a wide layout. It is now `1.0625rem` on a phone and `1.25rem` on a wide layout, so a 32px root paints it at 34px or 40px, and the chip stays on screen. `test/mobile/status-scale.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-portrait-zoom.png`.
After: `test/mobile/screenshots/after/iphone-se-status-scale.png`.

### Q7. The chip and the dock ignored the notch and the home indicator

The viewport meta had no `viewport-fit=cover`. The chip was `top: 14px` and the dock was `bottom: calc(14px + var(--kb))`, so both sat in the hardware inset. They now use `max(env(safe-area-inset-*), --safe-*)`. A 47px notch and a 34px home indicator move the chip, Fit, and the dock, and chat stays above the raised dock. Side insets do the same in landscape. `test/mobile/safe-area.spec.mjs`.

After: `test/mobile/screenshots/after/iphone-se-safe-area.png` (red bands are the injected insets).

### Q3. More sheet started above the viewport in landscape

Meeting, More open. On iPhone SE landscape the sheet top was −194px (the earlier pass measured −8px with a shorter sheet). iPhone 15, Pixel 7, and the 360px Android landscape did the same. The sheet now has a max height that clears the dock and the top of the screen, and the rest scrolls. `test/mobile/more-sheet.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-landscape-more.png`.
After: `test/mobile/screenshots/after/iphone-se-landscape-more.png`.

### Q4. “Create & enter” was below the fold on every phone

Broadcast lobby (`#bc=1`), Start broadcasting expanded. The create button’s top was past the viewport on iPhone SE (y ≈ 853, viewport 568), iPhone 15, Pixel 7, and 360, portrait and landscape. Opening the form now parks the rest of the lobby, shrinks the preview on a short or narrow screen, and keeps Cancel / Create in the card while the fields scroll. `test/mobile/create-on-screen.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-portrait-lobby-form.png`.
After: `test/mobile/screenshots/after/iphone-se-portrait-lobby-form.png` and `test/mobile/screenshots/after/iphone-se-landscape-lobby-form.png`.

### Q5. No LIVE / OFF AIR / WATCHING signal

A broadcast had only the status sentence. A viewer sat on “Joining the broadcast…”. A host with the camera off had no off-air mark. The chip now shows RECONNECTING while the room is not reached, OFF AIR for a host who is not sending a picture, LIVE once that picture is on, and WATCHING for a viewer who is in. Meetings do not wear it. `test/mobile/live-badge.spec.mjs`.

Before: `test/mobile/screenshots/before/iphone-se-portrait-host.png`.
After: `test/mobile/screenshots/after/iphone-se-broadcast-reconnecting.png` and `test/mobile/screenshots/after/iphone-se-broadcast-offair.png`.
