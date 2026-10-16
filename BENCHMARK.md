# Meet mobile scorecard

Scored 16 Oct 2026 from the baseline in `QUIRKS.md`, on a phone, for three audiences. 10 is "a person can finish the job without guessing, on a small phone, in both orientations." We do not lead any audience yet.

Compared with what those products do on a phone, not their desktop apps: Zoom, Google Meet, Teams, FaceTime, StreamYard / Restream, YouTube Live, and a typical church stream (BoxCast, Sunday Streams, ProPresenter-style volunteer panels).

Out of scope for this branch, so they are not scored as wins or losses here: the gallery/skinny-tile packer, self-view and stage placement, the reactions icon.

## Where they still beat us

- Zoom, Meet, Teams, FaceTime: hang-up fits, the landscape More sheet scrolls, chat clears the dock, Join is on screen on an SE, labels grow at 200%, the control says Captions, the notch and home indicator are clear, and Fit is at least 44px.
- FaceTime and church volunteer panels: primary targets are at least 44px. The dock grip, chat close, Send, and Fit are 44px. Fit's label grows at 200%.
- iOS: the notch and home indicator are cleared. `viewport-fit=cover` is set and the dock, chip, and Fit use `env(safe-area-inset-*)`.
- Meet, Teams, YouTube name the control Captions. Ours does too, and at 200% text that label is 32px.
- Zoom and church tools: a host can admit from a waiting-room list. Our phone can set a password, record, caption, and step on stage, including in landscape. There is no separate admit list.
- StreamYard, Restream, YouTube Live: a producer sees a labeled live/record state that cannot be covered by another bar. Record and Captions scroll inside More.

What we already do that they do not: one link, no account, join muted, camera choice stays in the lobby, blur until there is a reason to be clear, the meeting is the peers rather than a server in the middle. That is the personal and church advantage, and it is currently stuck behind the phone chrome.

## Corporate

Polished, efficient, trustworthy. A manager on a phone between meetings.

| Job | Score | Note |
| --- | --- | --- |
| End the call, mute, camera, on a 360px phone | 8 | Hang up, mute, camera, and Fit fit and are at least 44px. |
| Host: password, record, captions, stage, in landscape | 7 | Those controls scroll into view on SE, iPhone 15, Pixel 7, and 360px landscape. The captions control says Captions. |
| Chat or check names without losing the controls | 7 | The field taps, sits above the dock, and lifts for a keyboard band. Close and Send are 44px. |
| Looks trustworthy (nothing cut off, type scales) | 5 | The header says "4 in call" and the phrase fits. On an iPhone 15 the dock still covers the bottom row. |
| **Audience** | **7** | Hang up, landscape host tools, captions, chat, the home indicator, and the header count are in good shape. Still behind Zoom and Meet on a waiting-room admit list. |

## Church

A volunteer and an older member, a service or a small group, often a phone held sideways on a stand or passed around.

| Job | Score | Note |
| --- | --- | --- |
| Start or join from the lobby on an SE | 7 | Join is on screen in portrait. In landscape the first action is on screen and Join scrolls into the card. |
| Tap targets for someone who misses small controls | 7 | Dock grip, chat close, Send, and Fit are 44px. Fit grows with the text size. |
| Captions a member can find, at 200% text | 7 | The control says Captions and grows to 32px at 200% text. |
| Host runs the room from the phone they already hold | 6 | Password, record, captions, and stage scroll into reach in landscape. Labels are still terse. |
| **Audience** | **8** | Join, Captions, the dock, Fit, and landscape More work on an SE, and the home indicator is clear. Still behind a church stream panel on a waiting-room admit list. |

## Personal

Family and friends. Warm, few steps, a texted link.

| Job | Score | Note |
| --- | --- | --- |
| Open a texted link and pick a name | 7 | The name dialog shows, the field is 48px, Continue works. |
| See everyone and hang up on a small phone | 6 | Faces paint. Hang up fits on SE and 360px. |
| Send a chat line | 7 | The field is above the dock, 44px, and lifts when the keyboard band is set. |
| Turn the phone sideways | 6 | Invite and Password scroll into the More sheet. |
| **Audience** | **8** | The link, the name step, hang up, landscape More, chat, the lobby, the home indicator, and a 44px Fit control are in good shape. FaceTime still feels quieter; we do not lead yet. |

## Cycle

1. Dock fit on a narrow phone. `test/mobile/dock-fits.js` failed, then passed. Corporate 3→4, church 3→4, personal 4→5.
2. Landscape More sheet scrolls. `test/mobile/more-sheet-fits.js` failed, then passed. Corporate 4→5, church 4→5.
3. Chat composer clears the dock and a keyboard band. `test/mobile/chat-above-dock.js` failed, then passed. Corporate 5→6, personal 5→6. Church stayed 5 until the lobby fix.
4. Lobby Join is on screen on an SE. `test/mobile/lobby-join-visible.js` failed, then passed. Church 5→6. Corporate stays 6, personal stays 6.
5. More labels follow 200% text size. `test/mobile/text-scale-controls.js` failed, then passed. Captions row 3→5.
6. The controls say Captions and People. `test/mobile/plain-words.js` passes. Church captions 5→7, church audience 6→7.
7. Safe area. `test/mobile/safe-area.js` failed, then passed. Corporate 6→7, personal 6→7. Church stays 7.
8. Fit is 44px and grows at 200%. `test/mobile/fit-target.js` failed, then passed. Corporate end-call 7→8. Church tap targets 5→7, church audience 7→8. Personal 7→8.
9. Header count. `test/mobile/header-count.js` failed, then passed. The chip says "4 in call" for four real peers, and the phrase fits. Corporate trust 4→5. Audience scores stay put. Nobody leads yet. On the list after this: the self tile's initial versus its name, then the 22×48 grip and the dock covering the bottom row on a 393px phone. The waiting-room admit list is still open.
