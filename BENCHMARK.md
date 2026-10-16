# Meet mobile scorecard

Scored 16 Oct 2026 from the baseline in `QUIRKS.md`, on a phone, for three audiences. 10 is "a person can finish the job without guessing, on a small phone, in both orientations." We do not lead any audience yet.

Compared with what those products do on a phone, not their desktop apps: Zoom, Google Meet, Teams, FaceTime, StreamYard / Restream, YouTube Live, and a typical church stream (BoxCast, Sunday Streams, ProPresenter-style volunteer panels).

Out of scope for this branch, so they are not scored as wins or losses here: the gallery/skinny-tile packer, self-view and stage placement, the reactions icon.

## Where they still beat us

- Zoom, Meet, Teams, FaceTime: the hang-up control is always on screen. Ours leaves the screen at 320px and 360px.
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
| End the call, mute, camera, on a 360px phone | 3 | Hang up is clipped. Mute and camera fit. |
| Host: password, record, captions, stage, in landscape | 3 | Password is off the top of the SE landscape sheet. |
| Chat or check names without losing the controls | 2 | Composer is under the dock. |
| Looks trustworthy (nothing cut off, type scales) | 4 | Fine on iPhone 15 and Pixel 7 portrait. Fails the small phone. |
| **Audience** | **3** | Behind Zoom, Meet, and Teams on a phone. |

## Church

A volunteer and an older member, a service or a small group, often a phone held sideways on a stand or passed around.

| Job | Score | Note |
| --- | --- | --- |
| Start or join from the lobby on an SE | 3 | Join is below the fold in portrait. Every action is below the fold in landscape. |
| Tap targets for someone who misses small controls | 3 | Grip, Fit, chat close. |
| Captions a member can find, at 200% text | 3 | Labeled CC. Label stays 16px when the root is 32px. |
| Host runs the room from the phone they already hold | 4 | The tools are in More, and More fails in landscape. |
| **Audience** | **3** | Behind a church stream panel and behind FaceTime for the member. The one-link join is the part worth keeping. |

## Personal

Family and friends. Warm, few steps, a texted link.

| Job | Score | Note |
| --- | --- | --- |
| Open a texted link and pick a name | 7 | The name dialog shows, the field is 48px, Continue works. |
| See everyone and hang up on a small phone | 3 | Faces paint. Hang up does not fit. |
| Send a chat line | 2 | The field is under the dock. |
| Turn the phone sideways | 3 | More sheet loses Invite and Password. |
| **Audience** | **4** | The link and the name step are ahead of Zoom's account wall. The in-call phone chrome is behind FaceTime. |

## Cycle

Baseline only. Next cycle fixes the worst open quirk (hang up off the screen), with a Playwright repro that fails first, then passes, and these two files get rescored.
