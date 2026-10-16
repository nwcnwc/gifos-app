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
- StreamYard, Restream, YouTube Live: a producer sees Live, and Record and Captions, on the call. Ours does too, above the dock. The record sheet still asks what to capture before it starts.

What we already do that they do not: one link, no account, join muted, camera choice stays in the lobby, blur until there is a reason to be clear, the meeting is the peers rather than a server in the middle. That is the personal and church advantage. The phone chrome around it is in better shape, and we still do not lead.

## Corporate

Polished, efficient, trustworthy. A manager on a phone between meetings.

| Job | Score | Note |
| --- | --- | --- |
| End the call, mute, camera, on a 360px phone | 8 | Hang up, mute, camera, and Fit fit and are at least 44px. |
| Host: password, record, captions, stage, in landscape | 9 | Live, Record, and Captions are on the call. Room password, Vote on someone, and Step on stage stay in More and scroll into view. Waiting room admits from a list. |
| Chat or check names without losing the controls | 9 | The count and the latest line sit on the call. Emoji inserts into the field. Theirs is a light bubble, mine is blue, and both names are 1rem. |
| Looks trustworthy (nothing cut off, type scales) | 8 | The header says "4 in call". Live is on the call, and Recording is a separate red state. Faces end above the dock. |
| **Audience** | **8** | Hang up, landscape host tools, the live state, captions, chat, the home indicator, the header count, and a waiting-room admit list are in good shape. We do not lead yet. |

## Church

A volunteer and an older member, a service or a small group, often a phone held sideways on a stand or passed around.

| Job | Score | Note |
| --- | --- | --- |
| Start or join from the lobby on an SE | 8 | Join is on screen in portrait and in landscape. Start is the only blue button. |
| Tap targets for someone who misses small controls | 8 | Dock grip, chat close, Send, and Fit are 44px, including on an iPhone 15. Fit grows with the text size. |
| Captions a member can find, at 200% text | 8 | Captions is on the call, says Captions, and the label is 32px at 200% text. |
| Host runs the room from the phone they already hold | 9 | Live, Record, and Captions are on the call. Room password, Vote on someone, Step on stage, and a waiting-room list are named in plain words. |
| **Audience** | **8** | Join, Captions, the dock, Fit, landscape More, and a waiting-room list work on a phone. A volunteer panel is still calmer. |

## Personal

Family and friends. Warm, few steps, a texted link.

| Job | Score | Note |
| --- | --- | --- |
| Open a texted link and pick a name | 8 | The join step opens with the GifOS name and picture, and says how you will appear. Continue is the only blue button. |
| See everyone and hang up on a small phone | 7 | Four faces end above the dock on iPhone 15, SE, and 360px. Hang up fits. |
| Send a chat line | 9 | The latest line and the count sit on the call. Emoji inserts into the field. Theirs is a light bubble and mine is blue, at 1rem. |
| Turn the phone sideways | 8 | Invite, Room password, Waiting room, and Chat are on the first screen of More. You do not scroll to find them. |
| **Audience** | **8** | The link, the name step, hang up, the first screen of landscape More, chat, the lobby, the home indicator, and a 44px Fit control are in good shape. FaceTime still feels quieter. We do not lead yet. |

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
