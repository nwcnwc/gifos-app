# Desktop meeting scorecard

Scored 16 Oct 2026 from the desktop UI in `run.html` (branch `cursor/qa-meet-desktop`), driven locally in Chromium, Firefox, and WebKit. Scores are 1–10. A lead means we are ahead of the best product that audience already uses, on that row, for the desktop call itself.

We do **not** lead any audience yet. A host can mute, hold, rename, and spotlight from the roster. A shared slide fills the stage, with Stop sharing on the slide. A church broadcast has an order of service, and during Song the booth can read the current line and the next one. Those words stay on this computer. Settings, Who, Share, and Vote follow German and Spanish. Coming back from another tab says you are still in the call. Password, Invite, and Run app do not follow the language.

## Who we are measured against

| Product | Where it still beats GifOS on desktop |
| --- | --- |
| Zoom | A wider shortcut set (share, hand, view), gallery polish at every width, waiting room, host tools, localized UI, recording that a company expects |
| Google Meet | Fewer controls, excellent captions, a composer that never fights the toolbar, companion / picture-in-picture that is obvious |
| Teams | Raise-hand and roster that stay readable in a large room, chat and files that feel like one place |
| FaceTime | Almost no chrome, names you already know, a call that feels like a room rather than a product |
| StreamYard / Restream | Scenes, lower thirds, branding, one “go live” a volunteer can teach in a minute |
| YouTube Live | Stream health, public chat at scale, a clear on-air state |
| Church streaming (ProPresenter, Resi, a typical “live service” desk) | Lyrics on the picture the room sees, multi-camera, an archive of the sermon |

GifOS already beats them on a few things those products do not offer: no account, one link, peer-to-peer media, blur by default, and a quiet join. That is the trust row. It is not the whole call.

## Corporate

Polished, efficient, trustworthy. Best of the field today: Zoom and Meet, about 8.

| | GifOS | Notes |
| --- | ---: | --- |
| Trust (no account, private media, quiet join) | 9 | Ahead of Zoom, Meet, and Teams |
| Visual polish | 7 | Dock is calm and the primary controls are labeled. Chat no longer slides under it |
| Efficiency (keyboard, few clicks) | 6 | Alt+A / V / C / Q, and Tab reaches Mute on a tile. Share, hand, and view still need the pointer. Chat is still two clicks with the mouse |
| Presenting | 6 | A slide fills the stage and Stop sharing sits on it. Share is still More, then a sheet, then the picker |
| Large-room host | 8.5 | Mute, a waiting room, rename, and spotlight sit on the roster. Someone waiting is off the wall until Admit. The lobby does not yet cut every audio path, so this is not a 9 |
| **Audience** | **7.3** | Does not lead |

## Church

Simple for volunteers and older members. Services and small groups. Best of the field: Zoom or Meet for a small group (~7.5), StreamYard or a church desk for a service (~8).

| | GifOS | Notes |
| --- | ---: | --- |
| Volunteer simplicity | 7 | Join is one blue button. More is People, Share, Room, and Help, not one wall. The list is still long |
| Readability for older eyes | 6 | Mic, Camera, More/Hide, and Leave say so in the button. Reactions is still an icon. Chat’s privacy line wraps |
| Small group (conversation, singing) | 8 | One link, blur, unison. Voting someone up no longer hides the faces under the More sheet |
| Service / broadcast | 7.5 | The booth has an order of service, Off air, and On air. During Song, Program is the line to read now and Preview is the next line. The words stay on this computer. They are not on the outgoing picture, and the other booth does not see them, so this is not an 8 |
| **Audience** | **7.1** | Does not lead |

## Personal

Warm and effortless for family and friends. Best of the field: FaceTime, about 9. Meet is the web comparison, about 7.5.

| | GifOS | Notes |
| --- | ---: | --- |
| Warmth | 7 | The join card is a person, not a form. The in-call line still says “a password unlocks clear video” |
| Effort to get in | 8 | One link. You confirm your name and picture, then you are in. A return in the same tab does not ask again |
| Staying in the call (resize, tab away) | 7 | A friend who steps away shows Away. Coming back says Still in the call. A phone that ends the camera says so on your tile and brings it back. A live-but-black camera still waits on the watchdog |
| Locale | 8.5 | Lobby, help, shortcuts, join, dock, More, the count, chat, Settings, Who, Share, and Vote follow German and Spanish. Password, Invite, and Run app stay English |
| **Audience** | **7.6** | Does not lead |

## This cycle

During Song the booth reads the current line large and the next line smaller (see QUIRKS.md). Service 7 → 7.5. Church audience 7.0 → 7.1. The words are on this computer only, not on the outgoing picture and not on the other booth, so service is not an 8 and we do not lead a church desk (~8). Corporate stays 7.3. Personal stays 7.6. Still behind Zoom and Meet (~8) and FaceTime (~9). We do not lead. Blur for all on each tile is a 64px square, 12px in from the corner, the same rule as the phone build. Scores stay where they are.
