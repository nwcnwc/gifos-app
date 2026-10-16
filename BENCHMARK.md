# Meet mobile scorecard

Scored 16 Oct 2026 from the baseline in `QUIRKS.md`, on a phone, for three audiences. 10 is "a person can finish the job without guessing, on a small phone, in both orientations." We do not lead any audience yet.

Compared with what those products do on a phone, not their desktop apps: Zoom, Google Meet, Teams, FaceTime, StreamYard / Restream, YouTube Live, and a typical church stream (BoxCast, Sunday Streams, ProPresenter-style volunteer panels).

Out of scope for this branch, so they are not scored as wins or losses here: the gallery/skinny-tile packer, self-view and stage placement, the reactions icon.

## Where they still beat us

- Zoom, Meet, Teams, FaceTime: hang-up fits, the landscape More sheet scrolls, chat clears the dock, Join is on screen on an SE, labels grow at 200%, the control says Captions, the notch and home indicator are clear, and Fit is at least 44px.
- FaceTime and church volunteer panels: primary targets are at least 44px. The dock grip, chat close, Send, and Fit are 44px on an iPhone 15 as well as a narrow phone. Fit's label grows at 200%.
- iOS: the notch and home indicator are cleared. `viewport-fit=cover` is set and the dock, chip, and Fit use `env(safe-area-inset-*)`.
- Meet, Teams, YouTube name the control Captions. Ours does too, and at 200% text that label is 32px.
- Zoom and church tools: a host admits from a waiting-room list, and the other host controls say what they do. Ours does too. In landscape, Invite, Room password, Waiting room, and Chat are on the first screen of More.
- StreamYard, Restream, YouTube Live: a producer sees Live, and Record and Captions, on the call. Ours does too, above the dock, until the call is quiet. The record sheet still asks what to capture before it starts.
- FaceTime tucks the call controls until you tap. On a phone, Live, Record, Captions, and the dock do too. Fit and the name chip stay.
- A purpose-built church volunteer page still has a bigger live control than More. On a phone, More's first screen is now four actions, and Invite is the blue one.

What we already do that they do not: one link, no account, join muted, camera choice stays in the lobby, blur until there is a reason to be clear, the meeting is the peers rather than a server in the middle. That is the personal and church advantage. The phone chrome around it is in better shape, and we still do not lead.

## Corporate

Polished, efficient, trustworthy. A manager on a phone between meetings.

| Job | Score | Note |
| --- | --- | --- |
| End the call, mute, camera, on a 360px phone | 9 | Hang up, mute, camera, and Fit fit and are at least 44px. On a phone they tuck when the call is quiet and come back on a tap. |
| Host: password, record, captions, stage, in landscape | 9 | Live, Record, and Captions are on the call. Room password, Vote on someone, and Step on stage stay in More and scroll into view. Waiting room admits from a list. |
| Chat or check names without losing the controls | 9 | The count and the latest line sit on the call. Emoji inserts into the field. Theirs is a light bubble, mine is blue, and both names are 1rem. |
| Looks trustworthy (nothing cut off, type scales) | 9 | The header says "4 in call". Live is on the call, and Recording is a separate red state. When the call is quiet the faces use the space the dock was holding. |
| **Audience** | **9** | Hang up, landscape host tools, the live state, captions, chat, the home indicator, the header count, and a waiting-room admit list are in good shape. The quiet call tucks the dock. We do not lead yet. |

## Church

A volunteer and an older member, a service or a small group, often a phone held sideways on a stand or passed around.

| Job | Score | Note |
| --- | --- | --- |
| Start or join from the lobby on an SE | 9 | Join is on screen in portrait and in landscape, including at 200% text. Start is the only blue button. The phone shows the action, not the essay under it. |
| Tap targets for someone who misses small controls | 9 | Dock grip, chat close, Send, and Fit are 44px, including on an iPhone 15. Blur for all is a 64px square, inset from the tile corner, on a phone and on the desktop. |
| Captions a member can find, at 200% text | 9 | Captions is on the call, and the line sits on the face. At 200% text it is 40px and stays inside the tile. A long line is cut to the lower part of the face. |
| Host runs the room from the phone they already hold | 10 | Live, Record, and Captions are on the call. The phone sheet opens on Invite, Room password, Waiting room, and Chat. Invite is the blue one. Vote on someone and Step on stage scroll. |
| **Audience** | **9** | Join stays on screen at 200% text. Captions, the dock, Fit, landscape More, and a waiting-room list work on a phone. We do not lead yet. |

## Personal

Family and friends. Warm, few steps, a texted link.

| Job | Score | Note |
| --- | --- | --- |
| Open a texted link and pick a name | 9 | The join step opens with the GifOS name and picture. Save keeps them and is the solid blue button. Clear blanks both and is the outline. |
| See everyone and hang up on a small phone | 10 | Four faces are two rows of two, near a portrait-phone shape, and Fit no longer sits on a face. Live, Record, Captions, and the dock tuck when the call is quiet. A tap brings Hang up back. |
| Send a chat line | 9 | The latest line and the count sit on the call. Emoji inserts into the field. Theirs is a light bubble and mine is blue, at 1rem. |
| Turn the phone sideways | 9 | Four faces stay near a portrait-phone shape, and Fit shares the header row. Invite, Room password, Waiting room, and Chat are on the first screen of More. |
| **Audience** | **9** | The link, the name step, hang up, the grid, a sideways phone, chat, the lobby, and Fit are in good shape. The dock tucks the way a phone call does. Fit and the name chip stay. We do not lead yet. |

## Cycle

1. Dock fit on a narrow phone. `test/mobile/dock-fits.js` failed, then passed. Corporate 3→4, church 3→4, personal 4→5.
2. Landscape More sheet scrolls. `test/mobile/more-sheet-fits.js` failed, then passed. Corporate 4→5, church 4→5.
3. Chat composer clears the dock and a keyboard band. `test/mobile/chat-above-dock.js` failed, then passed. Corporate 5→6, personal 5→6. Church stayed 5 until the lobby fix.
4. Lobby Join is on screen on an SE. `test/mobile/lobby-join-visible.js` failed, then passed. Church 5→6. Corporate stays 6, personal stays 6.
5. More labels follow 200% text size. `test/mobile/text-scale-controls.js` failed, then passed. Captions row 3→5.
6. The controls say Captions and People. `test/mobile/plain-words.js` passes. Church captions 5→7, church audience 6→7.
7. Safe area. `test/mobile/safe-area.js` failed, then passed. Corporate 6→7, personal 6→7. Church stays 7.
8. Fit is 44px and grows at 200%. `test/mobile/fit-target.js` failed, then passed. Corporate end-call 7→8. Church tap targets 5→7, church audience 7→8. Personal 7→8.
9. Header count. `test/mobile/header-count.js` failed, then passed. The chip says "4 in call" for four real peers, and the phrase fits. Corporate trust 4→5.
10. Join appearance. `test/mobile/appear-preview.js` failed, then passed. The step prefills the system name and picture, and Continue is no longer the same purple as Not now. Personal name row 7→8. Audience scores stay put. Nobody leads yet. Still open: the 22×48 grip, the dock covering the bottom row on a 393px phone, and a waiting-room admit list.
11. Dock clears the bottom row. `test/mobile/dock-clears-faces.js` failed, then passed. The content box reserves the measured dock. The packer is unchanged. Corporate trust 5→6. Personal "see everyone" 6→7. Audience scores stay 7 / 8 / 8. Nobody leads yet. Still open: the 22×48 grip on a 393px phone, and a waiting-room admit list.
12. Drag grip is 44px. `test/mobile/grip-target.js` failed (`22x48` on iPhone 15 and Pixel 7), then passed. Hang up stays on screen. Corporate trust 6→7. Church tap targets 7→8. Audience scores stay 7 / 8 / 8. Nobody leads yet. Still open: a waiting-room admit list.
13. Waiting-room admit list. `test/mobile/wait-list.js` failed (no Waiting room button), then passed. Default off, so a dark return still answers the door. When it is on, the host sees names above the dock and Admit calls the existing door answer. Corporate host 7→8, corporate audience 7→8. Church host 6→8. Audience scores are 8 / 8 / 8. Nobody leads yet. More's host labels are still short.
14. Host words. `test/mobile/host-words.js` failed (`Password`, `Vote`, `Stage`), then passed, including at 200% text. The controls say Room password, Vote on someone, and Step on stage (Step off stage once you are up). The phone sheet is two columns so the phrases fit. Corporate host 8→9. Church host 8→9. Audience scores stay 8 / 8 / 8. Nobody leads yet. Still open: in landscape, Invite and Room password are below the first screen of More.
15. Landscape first screen. `test/mobile/landscape-first.js` failed (Invite and Room password below the sheet on an SE), then passed. Those two, plus Waiting room and Chat, are the first four controls. Personal sideways 6→8. Audience scores stay 8 / 8 / 8. Nobody leads yet. Still open: Record and Captions live inside More, so a producer does not see a live/record state on the call itself.
16. Live and record state on the call. `test/mobile/call-state.js` failed (no state on the call), then passed, including at 200% text. Live, Record, and Captions sit above the dock. Recording is red. Captions on is blue. Corporate trust 7→8. Church captions 7→8. Audience scores stay 8 / 8 / 8. Nobody leads yet. Still open: in landscape the lobby still makes you scroll to Join.
17. Landscape lobby Join. `test/mobile/lobby-join-visible.js` failed (`bottom 378` on an SE), then passed. The three actions share one row, and Join is on screen. Church lobby 7→8. Audience scores stay 8 / 8 / 8. Nobody leads yet.
18. Unread badge on the call. `test/mobile/chat-badge.js` failed (no count with More closed), then passed, including at 200% text. The count sits above Live. Opening chat clears it. The chat sheet also paints over the live row so the field can be tapped. Chat stays 7: there is still no preview, no emoji, and the bubbles are small and dark. Audience scores stay 8 / 8 / 8. Nobody leads yet.
19. Message preview. `test/mobile/chat-preview.js` failed (no preview), then passed, including at 200% text. The latest line sits beside the count. Faces end above it. Corporate chat 7→8. Personal send-a-line 7→8. Audience scores stay 8 / 8 / 8. Nobody leads yet. Still open: emoji, and bubbles that are small and dark.
20. Emoji. `test/mobile/chat-emoji.js` failed (no emoji control), then passed, including at 200% text. The row is 44px targets above the field, and a tap inserts the character without sending. Scores stay 8 / 8 / 8. Nobody leads yet. Still open: the bubbles are small and dark.
21. Send stayed on screen. `test/mobile/chat-above-dock.js` failed (`send off screen (right 382)`), then passed. The field shrinks so the emoji button does not push Send past the edge.
22. Readable bubbles. `test/mobile/chat-bubbles.js` failed (13.6px body, name contrast 2.61, mine and theirs the same color), then passed, including at 200% text. Theirs is light, mine is blue, the name is 1rem, and a long line wraps inside the bubble. Corporate chat 8→9. Personal send-a-line 8→9. Audience scores stay 8 / 8 / 8. Nobody leads yet.
23. Keyboard. `test/mobile/chat-keyboard.js` failed (the inset ignored the visible viewport, and in landscape Close scrolled off), then passed, including at 200% text. The sheet uses the larger of the dock and the keyboard. The field is 1rem. Audience scores stay 8 / 8 / 8. Nobody leads yet. Still open: the call is busier than FaceTime, so "see everyone" stays 7.
24. Portrait tiles. `test/mobile/see-everyone.js` failed (bottom row 88px and 73px, three rows), then passed. Four people are two rows of two. A phone tile is no longer a wide strip. Personal see-everyone 7→8. Audience scores stay 8 / 8 / 8. Nobody leads yet. The corner still carries a solid build chip.
25. Quieter chrome. `test/mobile/call-calm.js` failed (Fit covered a face, and the build tag was a solid chip), then passed. Faces start below Fit. The build name is faint and has no fill. Personal see-everyone 8→9. Audience scores stay 8 / 8 / 8. Nobody leads yet. FaceTime still hides more of its chrome.
26. Idle chrome. `test/mobile/chrome-idle.js` failed (`chrome stays up when idle`), then passed on an iPhone 15 and an SE. Live, Record, Captions, and the dock tuck, the faces grow into that band, and a tap brings them back at 44px. More holds them up. Corporate end-call 8→9, corporate trust 8→9, corporate audience 8→9. Personal see-everyone 9→10, personal audience 8→9. Church stays 8. Nobody leads yet. A volunteer panel is still calmer. Fit and the name chip stay on screen.
27. Calmer More. `test/mobile/more-calm.js` failed (`13 buttons on the first screen`, sheet top 44), then passed on an iPhone 15 and an SE. The first screen is Invite, Room password, Waiting room, and Chat. Invite is blue. The name stays clear. Church host 9→10, church audience 8→9. Audience scores are 9 / 9 / 9. Nobody leads yet.
28. Blur for all. The per-tile control was 83×32 and flush with the corner. It is now a 64px square, 12px in from the corner, on a phone and on the desktop. `test/mobile/blur-tile.js` passes. Church tap targets 8→9. Audience scores stay 9 / 9 / 9. Nobody leads yet.
29. Join Clear and Save. The step said Not now and Continue. Clear blanks the name and the picture. Save keeps both and stays the solid button. `test/mobile/appear-preview.js` passes. Personal name row 8→9. Audience scores stay 9 / 9 / 9. Nobody leads yet.
30. Sideways tiles. `test/mobile/sideways-tiles.js` failed (SE 141×46 aspect 3.07, iPhone 15 bottom pair 130×60 aspect 2.19), then passed. Fit shares the header row on a short landscape phone, and a tile that would have been a strip stays within a portrait-phone shape. Desktop packing is unchanged. Personal sideways 8→9. Audience scores stay 9 / 9 / 9. Nobody leads yet.
31. Lobby at 200% text. `test/mobile/lobby-large-text.js` failed (Join bottom 986 on a 568px SE, and all three actions bottom 539 on a sideways SE), then passed. A phone shows the action title only, with tighter padding, so Start and Join stay on screen and Start stays the only blue button. Church lobby 8→9. Audience scores stay 9 / 9 / 9. Nobody leads yet. Captions are still the low church row.
32. Caption on the face. `test/mobile/caption-on-tile.js` failed (a line was 618px tall on a 236px face and started above the screen at 200% text), then passed. The line stays in the lower part of the tile, at 1.25rem, including at 200%. Church captions 8→9. Audience scores stay 9 / 9 / 9. Nobody leads yet.
