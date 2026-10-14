# GifOS Meet — UI redesign proposal

Design only. `run.html` is unchanged. The mockups are static HTML in `mockups/` and the PNGs in `after/`. Nothing here is wired into the app.

Reviewed the local build on branch `ui-redesign-meet` (Aurora: page `#e8ecf1`, surface `#ffffff`, text `#1d1d1f`, accent `#0071e3`, accent2 `#5856d6`). Served from this worktree at `http://127.0.0.1:8791`. The room used a closed relay, `ws://127.0.0.1:9`, so production was never contacted. Viewports: 1280×800 and 412×915. Playwright 1.61.1, one browser, `nice -n 10`.

The Google Meet photo at `google-meet-reference.jpg` is a quality bar only. Direction A and Direction B are GifOS: Aurora or the night wordmark, GifOS type, and the same call jobs. They do not copy that photo's layout.

Phone hardware shots were skipped. `~/h0922/gb-moto.status` was `STATUS: RUNNING` for the whole review, so the motos stayed with that session. No adb, no ssh tunnel, no work on raspberrypi.

Personas, each run as its own pass against this server: `personas/confused.md`, `personas/fat-finger.md`, `personas/a11y.md`, `personas/polish.md`. Fill percentages below are from the clean recapture in `before/metrics.json` (the join veil was photographed once, then hidden so the grid could be seen). Contrast ratios are the accessibility pass, checked against screenshot pixels.

## Top 10

1. On a phone, one person is a short landscape strip and most of the screen is empty.
2. Your own face takes a full tile. It does not float.
3. Camera, mic, and hang-up are tiny. Hang-up is the word Leave in the bar, next to blur.
4. There is no reactions button. Hand is a small word in a long list.
5. Most controls sit behind a 26px chevron. Opening it piles word-buttons on the video, all about 23px tall.
6. On a wide screen, two people use about half the feed and four use about a quarter. The rest is empty gray.
7. Before you join you do not see yourself. You get a narrow form on a blank page.
8. "A room you run" asks for two passwords, and faces stay blurred until a guest password exists.
9. The meeting page is a light gray sheet. The video never takes the window.
10. Leave sits next to the other small controls. Nothing asks if you meant it. The card appears after you have already left.

## Findings

1. **High.** On a phone the tile is 396×223. With the bar collapsed the feed is 412×856, so one person covers 25% of it. Two people cover 50%. Four tiles of the same size run past the bottom of the screen. Screenshot: `before/phone-call-1-default.png`. Also `before/phone-call-3.png`. Fix: one person fills the stage. Two people fill it together. A fourth person stays on screen.

2. **High.** You are a cell in the grid (`.tile.me`), the same size as everyone else. Screenshot: `before/phone-call-3.png` and `before/desk-call-4.png`. Fix: once someone else is here, float yourself as a small card. Alone, you stay the big picture.

3. **High.** On 412×915 every live control is under 48px, and most are under 25px tall. Collapsed bar is 412×59 (6.5% of the screen). Mic and camera are 31.8×24.8. Blur Min is 32.9×20.9 and touches Max and No blur (0 gap). Leave is 49.4×22.9, 4.8px from the blur group. The chevron is 26×26. Open, the bar is 115px and four rows, and Who, Invite, Hand, Chat, Record, CC, Stage, and Help are all 22.9px tall. Screenshots: `before/phone-call-1-default.png`, `before/phone-bar-open.png`. Fix: a bottom dock with camera, mic, reactions, and more at 56px or larger, and a hang-up that is bigger than those and separated from them.

4. **High.** There is no reactions control. Hand is the word Hand, hidden until the chevron opens, 45.5×22.9 on the phone. Screenshot: `before/phone-hand.png` (the button flips to "Lower hand"). Fix: put reactions on the dock. The tray holds Hand (the control that exists today) plus Clap, Yes, No, and Laugh.

5. **High.** The joining cover is dark, `rgba(10,10,15,.82)`, and it uses the Aurora text colors. "Reaching the meeting…" is `#1d1d1f` at 1.34:1 on the phone pixel and 1.37:1 on the desktop pixel (large text still needs 3:1). "Connecting you to the room." is `#6e6e73` at 2.49:1 on the phone and 2.37:1 on the desktop. The cover is rebuilt while you have no seat, and it sits over the focused control. On the desktop the tile's big G sits on the title, so the word "the" is the letter G. The name card also covers this cover until Not now. Screenshots: `before/phone-joining-veil.png`, `before/desk-joining-veil.png`, `before/phone-name.png`. Fix: put that message on a light card, in dark type, above the picture and above the name card.

6. **High.** Leave is a small outline word on the same row as blur. Tap it and the meeting is already over: "You left the meeting", with Rejoin and Close. No question first. Screenshot: `before/phone-leave.png`. Fix: a large red hang-up, away from mic and blur, that asks before it drops the call. The mockups draw the hang-up. They do not draw the confirm step.

7. **High.** The lobby is a card about 440px wide, centered on the empty page. No camera preview. The three choices are tall enough (Start a meeting 380×67, Start a room you run 380×83, Join a link 380×67 on the phone). "change" under them is 47×19. Screenshots: `before/desk-prejoin.png`, `before/phone-prejoin.png`. Fix: a full camera preview, Start as the primary, Join and "A room you run" as the other two, and a change control at least 48px.

8. **Med.** "Start a room you run" opens two password fields and a long explanation that faces stay fully blurred until the guest password is set. The guest note talks about a blur slider and a password button that are not on this form. Screenshot: `before/phone-prejoin-admin.png`. Fix: one optional guest password, and one sentence about blur.

9. **Med.** Create & enter is a gray button beside Cancel. An empty room name is not flagged. The only message that pass got was "Set an admin password — it's the key to your room." Screenshot: `before/phone-prejoin-admin.png`. Fix: say when the name is missing, and make Create & enter the blue button.

10. **High.** A bad paste says "Couldn't read that — paste a meeting link or its id." The computed color is `rgb(255,138,138)`, 2.27:1 on white and 1.91:1 on the page `#e8ecf1`. The word hello is accepted as a meeting id, opens a room, and shows up under Recent & saved. Screenshot: `before/phone-prejoin-join-error.png`. Fix: darken that error, and treat a bare word like a bad paste.

11. **Med.** The first visit puts up "Pick a screen name" over the room. Not now is 95.7×33 and Continue is 100.1×33. The tile behind already shows a Guest number. Screenshot: `before/phone-name.png`. Fix: make those two at least 48px tall.

12. **Med.** On 1280×800 with the bar collapsed, one tile is 1264×711 and covers 93.2% of the feed. Two tiles are 628×353 and cover 46%. Three are 416×234 (30%). Four are 310×174 (22%). Six, with the bar open, are 246×139 and cover 22% of that shorter feed. The tiles stay one short row. Video is `object-fit: contain`. The fake camera was 16:9, same as the tile, so the hole is the page around the tiles, not bars inside the picture. Screenshot: `before/desk-call-4.png`. Also `before/desk-call-6.png`. Fix: grow the row to the height that is left. Crop people with cover so a face fills the tile.

13. **Med.** Screen share on the phone gives the slide a tall frame and letterboxes it in black, with a filmstrip along the bottom that clips the last face. Screenshot: `before/phone-screenshare.png`. Fix: the shared screen fills the stage, and faces sit in a filmstrip that stays fully on screen.

14. **Med.** "RECENT & SAVED" is `#1d1d1f` at opacity 0.55 over `#e8ecf1`, 12.5px, 3.62:1. It fails 4.5:1. Screenshot: `before/phone-prejoin.png`. Fix: paint that heading at full strength.

15. **Med.** There is no authored focus ring. Tab uses the browser's 1px outline. While the joining cover is up, the focused bar button is underneath it. Screenshot: `before/phone-joining-veil.png`. Fix: a visible ring on the dock and the lobby buttons, and do not cover it with the joining layer.

16. **High.** On a saved recent row, the star button is 24.5×23.2 and its only name is the character ☆. The remove button is 24.6×21.4, the icon is hidden from the name, and the only name is a title tooltip. The show-password buttons are 22.4×22.4. Admin and join fields, Cancel, and Create & enter are about 33px tall. These were measured on a seeded recent row during the accessibility pass. The empty lobby in `before/phone-prejoin.png` does not show the star or the remove button. Fix: name them ("Save", "Remove"), and make every one of those targets at least 48px.

17. **Low.** This edge build prints the word "edge" in the bottom-left corner of the meeting. Screenshot: `before/phone-call-1-default.png`. Fix: keep the channel mark off the call surface, or park it where it does not sit on the video.

Bar status text, the blur label, and the blur segments clear 4.5:1 on the white bar (5.07:1, and 11.91:1 for the selected Max chip). The three lobby primary buttons clear 48px tall.

## Direction A — Clear Stage

Aurora, on a dark video stage (`#0c0e12`). The wordmark is the live gradient, 135° from `#0071e3` to `#5856d6`, in a small frosted chip with the room name and the count.

People fill the stage. Tiles are rounded (16px) and cropped with cover, so the face uses the tile. One or two people each take the whole stage. Three people: a large tile and a side stack. Four: the first person stays large and the other two stack. Six: two columns, three rows, and the last person spans the bottom. That is a sidebar, not a pair on top of a single tile.

You float as a rounded card (white edge) once other people are here. On the phone it is a portrait card; on the desktop it is a wide card.

The dock is a frosted white pill, centered. Camera, mic, reactions, and more are 56px circles. Hang-up is a 64px red squircle (`#b61622`, corner radius 20px) with a handset icon. It is not a circle, and it is not only a word.

Before you join, the camera is the page. A sheet says you join muted and the camera stays as you set it here. Actions: Start a meeting, Join with a link, A room you run. Change is a text button in the accent blue, on that sheet.

Reactions open a tray: Hand, Clap, Yes, No, Laugh. More opens the call tools: Invite, Share screen, Chat, Run app, Stage, Blur, Record, Captions, Vote, Who, Password, Help. Screen share fills the stage, with a filmstrip of faces above the dock.

Samples: `after/a-phone-prejoin.png`, `after/a-phone-3.png`, `after/a-desk-4.png`, `after/a-desk-6.png`, `after/a-phone-share.png`, `after/a-phone-more.png`.

## Direction B — Night Stadium

Ink `#100818`. The wordmark is the runtime night gradient, 120° from `#9b7bff` to `#ff7ab8`. The stage chip is `#5a32d6`. A speaking tile is edged in `#c43b86`.

The dock is a full-width ink bar, 96px tall. Camera, mic, reactions, and more are 60px rounded squares (`#2a1b3e`, 18px radius). Leave is a red pill, `#b61622`, 64px tall, with the word Leave. It is at least 112px wide on the phone and 128px on the desktop.

Three or more people: one large stage and a portrait rail. On the phone the rail is a strip across the top and the speaker fills the rest. On the desktop the rail is a column on the right. Six people keep that stage and put the others in the strip. You are a circle with a violet ring (`#7b5cff`), 96px on the phone and 112px on the desktop.

Pre-join is the same jobs as Direction A, in this night palette: camera on the left (or full bleed on the phone), Start a meeting in the violet-to-pink gradient, then Join with a link and A room you run. The line under your name says you join muted and the camera stays as you set it.

Samples: `after/b-phone-3.png`, `after/b-phone-6.png`, `after/b-desk-prejoin.png`, `after/b-desk-4.png`, `after/b-phone-react.png`.

Both directions keep the GifOS wordmark, GifOS colors, and the controls the call already has. The reference photo is the bar for polish: big buttons, video that fills the phone, a floating self-view. These two get there with a squircle hang-up or a labeled Leave pill, and with a sidebar or a stage-and-rail, which are this product's layouts.

## Before and after

| State | Viewport | Before | After A | After B |
| --- | --- | --- | --- | --- |
| Pre-join | Phone | `before/phone-prejoin.png` | `after/a-phone-prejoin.png` | `after/b-phone-prejoin.png` |
| Pre-join | Desktop | `before/desk-prejoin.png` | `after/a-desk-prejoin.png` | `after/b-desk-prejoin.png` |
| 1 person | Phone | `before/phone-call-1-default.png` | `after/a-phone-1.png` | `after/b-phone-1.png` |
| 1 person | Desktop | `before/desk-call-1-default.png` | `after/a-desk-1.png` | `after/b-desk-1.png` |
| 2 people | Phone | `before/phone-call-2.png` | `after/a-phone-2.png` | `after/b-phone-2.png` |
| 2 people | Desktop | `before/desk-call-2.png` | `after/a-desk-2.png` | `after/b-desk-2.png` |
| 3 people | Phone | `before/phone-call-3.png` | `after/a-phone-3.png` | `after/b-phone-3.png` |
| 3 people | Desktop | `before/desk-call-3.png` | `after/a-desk-3.png` | `after/b-desk-3.png` |
| 4 people | Phone | `before/phone-call-4.png` | `after/a-phone-4.png` | `after/b-phone-4.png` |
| 4 people | Desktop | `before/desk-call-4.png` | `after/a-desk-4.png` | `after/b-desk-4.png` |
| 6 people | Phone | `before/phone-call-6.png` | `after/a-phone-6.png` | `after/b-phone-6.png` |
| 6 people | Desktop | `before/desk-call-6.png` | `after/a-desk-6.png` | `after/b-desk-6.png` |
| Screen share | Phone | `before/phone-screenshare.png` | `after/a-phone-share.png` | `after/b-phone-share.png` |
| Screen share | Desktop | `before/desk-screenshare.png` | `after/a-desk-share.png` | `after/b-desk-share.png` |
| Reactions | Phone | `before/phone-hand.png` | `after/a-phone-react.png` | `after/b-phone-react.png` |
| Reactions | Desktop | `before/desk-hand.png` | `after/a-desk-react.png` | `after/b-desk-react.png` |
| More / leave | Phone | `before/phone-bar-open.png`, `before/phone-leave.png` | `after/a-phone-more.png` | `after/b-phone-more.png` |
| More / leave | Desktop | `before/desk-bar-open.png`, `before/desk-leave.png` | `after/a-desk-more.png` | `after/b-desk-more.png` |

The 2, 3, 4, and 6 before shots were taken with the extra bar open, so the controls are visible. The tile sizes match the collapsed-bar pass: a phone tile stays 396×223 either way.

## Proof

- Capture log ended `done metrics 20` with no FAIL. Metrics: `before/metrics.json`.
- Joining cover was shot, then forced off with a stylesheet so later frames are the grid. `before/phone-call-1.png` and `before/phone-call-3.png` show the tiles, not the cover.
- After PNGs: 36, one per mockup page, rendered at the same two viewports.
- App files were not edited.
