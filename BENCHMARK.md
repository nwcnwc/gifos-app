# Meet mobile scorecard

Scored 16 Oct 2026 from the baseline in `QUIRKS.md`, on a phone, for three audiences. 10 is "a person can finish the job without guessing, on a small phone, in both orientations." We do not lead any audience yet.

Compared with what those products do on a phone, not their desktop apps: Zoom, Google Meet, Teams, FaceTime, StreamYard / Restream, YouTube Live, and a typical church stream (BoxCast, Sunday Streams, ProPresenter-style volunteer panels).

Out of scope for this branch, so they are not scored as wins or losses here: the gallery/skinny-tile packer, self-view and stage placement, the reactions icon.

## Where they still beat us

- Zoom, Meet, Teams, FaceTime: hang-up fits, the landscape More sheet scrolls, chat clears the dock, and Join is on screen on an SE. They still beat us on 200% control labels, the word Captions, safe areas, and the 32px Fit control.
- Meet and Teams: the overflow menu scrolls inside the screen in landscape. Ours draws Password above the top edge and does not scroll.
- iMessage, Meet, Teams: the composer stays above the keyboard and above the call controls. Ours is underneath the dock, and a tap never lands.
- FaceTime and church volunteer panels: primary targets are at least 44px. Our move-grip is 22px wide and Fit is 32px tall. Chat's close control is 23px.
- iOS: controls clear the home indicator and the notch. Our viewport does not opt into safe areas, and the dock is a fixed 14px from the layout bottom.
- Meet, Teams, YouTube: captions are named Captions. Ours says CC, and a 200% text setting does not enlarge that label.
- Zoom and church tools: a host can admit, lock, record, and caption from a phone without rotating into a dead end. Our host tools exist (password, stage, record, CC) and are unreachable in SE landscape.
- StreamYard, Restream, YouTube Live: a producer sees a labeled live/record state that cannot be covered by another bar. We have Record and CC, buried in the same sheet.

What we already do that they do not: one link, no account, join muted, camera choice stays in the lobby, blur until there is a reason to be clear, the meeting is the peers rather than a server in the middle. That is the personal and church advantage, and it is currently stuck behind the phone chrome.

## Corporate

Polished, efficient, trustworthy. A manager on a phone between meetings.

| Job | Score | Note |
| --- | --- | --- |
| End the call, mute, camera, on a 360px phone | 7 | Hang up, mute, and camera fit and are at least 44px. Fit is still 32px tall. |
| Host: password, record, captions, stage, in landscape | 6 | Those controls scroll into view on SE, iPhone 15, Pixel 7, and 360px landscape. The captions control still says CC. |
| Chat or check names without losing the controls | 7 | The field taps, sits above the dock, and lifts for a keyboard band. Close and Send are 44px. |
| Looks trustworthy (nothing cut off, type scales) | 4 | Fine on iPhone 15 and Pixel 7 portrait. Fails the small phone. |
| **Audience** | **6** | Hang up, landscape host tools, and chat work on a phone. Still behind Zoom, Meet, and Teams on Captions as a word, 200% labels, and the home-indicator inset. |

## Church

A volunteer and an older member, a service or a small group, often a phone held sideways on a stand or passed around.

| Job | Score | Note |
| --- | --- | --- |
| Start or join from the lobby on an SE | 7 | Join is on screen in portrait. In landscape the first action is on screen and Join scrolls into the card. |
| Tap targets for someone who misses small controls | 5 | Dock grip, chat close, and Send are 44px. Fit is still 32px tall. |
| Captions a member can find, at 200% text | 3 | Labeled CC. Label stays 16px when the root is 32px. |
| Host runs the room from the phone they already hold | 6 | Password, record, captions, and stage scroll into reach in landscape. Labels are still terse. |
| **Audience** | **6** | Dock, landscape More, and the lobby Join action work on an SE. Still behind a church stream panel: captions say CC, and 200% text does not enlarge them. |

## Personal

Family and friends. Warm, few steps, a texted link.

| Job | Score | Note |
| --- | --- | --- |
| Open a texted link and pick a name | 7 | The name dialog shows, the field is 48px, Continue works. |
| See everyone and hang up on a small phone | 6 | Faces paint. Hang up fits on SE and 360px. |
| Send a chat line | 7 | The field is above the dock, 44px, and lifts when the keyboard band is set. |
| Turn the phone sideways | 6 | Invite and Password scroll into the More sheet. |
| **Audience** | **6** | The link, the name step, hang up, landscape More, chat, and the small-phone lobby are in good shape. 200% labels and the home indicator are still behind FaceTime. |

## Cycle

1. Dock fit on a narrow phone. `test/mobile/dock-fits.js` failed, then passed. Corporate 3→4, church 3→4, personal 4→5.
2. Landscape More sheet scrolls. `test/mobile/more-sheet-fits.js` failed, then passed. Corporate 4→5, church 4→5.
3. Chat composer clears the dock and a keyboard band. `test/mobile/chat-above-dock.js` failed, then passed. Corporate 5→6, personal 5→6. Church stayed 5 until the lobby fix.
4. Lobby Join is on screen on an SE. `test/mobile/lobby-join-visible.js` failed, then passed. Church 5→6. Corporate stays 6, personal stays 6. Nobody leads yet. Next: 200% text leaves the More labels at 16px.
