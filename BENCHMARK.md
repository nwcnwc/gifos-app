# Desktop meeting scorecard

Scored 16 Oct 2026 from the desktop UI in `run.html` (branch `cursor/qa-meet-desktop`), driven locally in Chromium, Firefox, and WebKit. Scores are 1–10. A lead means we are ahead of the best product that audience already uses, on that row, for the desktop call itself.

We lead the corporate average, **8.1** against Zoom and Meet at about 8. Polish is still 7, so that lead is the average, not every row. We do not lead church or personal. A host can mute, hold, rename, and spotlight from the roster. Share screen is one dock button, and Alt+S does the same thing. Who, Invite, Run app, Vote, Password, Stage, Record, captions, Settings, Transcript, and Help each have a key, and the list names them. A shared slide fills the stage, with Stop sharing on the slide. A church broadcast has an order of service, and during Song the booth can read the current line and the next one. Those words stay on this computer. Settings, Who, Share, Vote, Password, and Invite follow German and Spanish. Coming back from another tab says you are still in the call. Run app does not follow the language.

## Who we are measured against

| Product | Where it still beats GifOS on desktop |
| --- | --- |
| Zoom | Gallery polish at every width, a waiting room that cuts every audio path, recording a company expects, and a few strings that stay English |
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
| Efficiency (keyboard, few clicks) | 8 | Alt+A / V / S / C / K / H / F / Q, and Tab reaches Mute on a tile. Who, Invite, Run app, Vote, Password, Stage, Record, Settings, Transcript, and Help each have a key while More is closed. Host bulk tools still need the pointer, so this is not a 9 |
| Presenting | 8 | Share screen is one button on the dock, and Alt+S opens the browser’s picker. Stop sharing sits on the slide, and the thumbnail can stop it too. The same key stops a share that is already up |
| Large-room host | 8.5 | Mute, a waiting room, rename, and spotlight sit on the roster. Someone waiting is off the wall until Admit. The lobby does not yet cut every audio path, so this is not a 9 |
| **Audience** | **8.1** | Leads Zoom and Meet (~8) on the average. Polish is still 7 |

## Church

Simple for volunteers and older members. Services and small groups. Best of the field: Zoom or Meet for a small group (~7.5), StreamYard or a church desk for a service (~8).

| | GifOS | Notes |
| --- | ---: | --- |
| Volunteer simplicity | 7 | Join is one blue button. More is People, Share, Room, and Help, not one wall. The list is still long |
| Readability for older eyes | 6.5 | The mic says Unmute or Mute. Camera, More/Hide, and Leave say so in the button. There is no second Unmute in the header. The chat privacy line is 16px and one line. Reactions is still an icon, so this is not a 7 |
| Small group (conversation, singing) | 8 | One link, blur, unison. Voting someone up no longer hides the faces under the More sheet |
| Service / broadcast | 7.5 | The booth has an order of service, Off air, and On air. During Song, Program and Preview are labeled at 16px. The line to read now is 32px and the next line is smaller. The words stay on this computer. They are not on the outgoing picture, and the other booth does not see them, so this is not an 8 |
| **Audience** | **7.3** | Does not lead |

## Personal

Warm and effortless for family and friends. Best of the field: FaceTime, about 9. Meet is the web comparison, about 7.5.

| | GifOS | Notes |
| --- | ---: | --- |
| Warmth | 7.5 | The join card is a person, not a form. With other people here the line says faces stay soft until a password. The dock is still a product, so this is not an 8 |
| Effort to get in | 8.5 | One link. You confirm your name and picture, then you are in. When you are alone, Invite copies that link in one click. A return in the same tab does not ask again. You still confirm your name first, so this is not a 9 |
| Staying in the call (resize, tab away) | 7 | A friend who steps away shows Away. Coming back says Still in the call. A phone that ends the camera says so even when the page stays open. A live camera that sends no frames says so on the first quiet sample. A camera that is still painting black frames waits, so this is not an 8 |
| Locale | 9 | Lobby, help, shortcuts, join, dock, More, the count, chat, Settings, Who, Share, Vote, Password, and Invite follow German and Spanish, including the tips, the stage line, the card that offers to share again, and the form that makes a room you run. Run app stays English. The Who download for the police stays English, so this is not a 10 |
| **Audience** | **8.0** | Does not lead |

## This cycle

During Song the booth reads the current line large and the next line smaller (see QUIRKS.md). Service 7 → 7.5. Church audience 7.0 → 7.1. The words are on this computer only, not on the outgoing picture and not on the other booth, so service is not an 8 and we do not lead a church desk (~8). Corporate stays 7.3. Personal stays 7.6. Still behind Zoom and Meet (~8) and FaceTime (~9). We do not lead. Blur for all on each tile is a 64px square, 12px in from the corner, the same rule as the phone build. The join step says Save and Clear. A client share now says whose screen is on stage, at 16px, and the share step’s title and Choose button are readable. The path is still More, then the sheet, then the picker, so presenting stays 6. Who, Share, and Vote tips, and the line after you share or vote, follow German and Spanish. Locale stays 8.5 because the Password and Invite sheets are still English. A camera that stays live and sends no frames says so on the first quiet sample, and restarts on the third. A camera that is still painting black frames waits, so staying stays 7. Program and Preview on the booth are labeled at 16px. The words are still not on the outgoing picture, so service stays 7.5 and we do not lead. Once a slide is actually up, More folds and the thumbnail says Stop sharing and takes the click. The path to start is still More, then the sheet, then the picker, so presenting stays 6. On a German or Spanish device the stage line names whose screen is up, and the card that offers to share again follows that language. Locale stays 8.5 because the Password and Invite sheets are still English. A camera that ends while the page stays open says so on the next sample and starts again. A camera that is still painting black frames waits, so staying stays 7. On a short window the lyric card no longer covers Off air. The words are still not on the outgoing picture, so service stays 7.5 and we do not lead. Share screen is one dock button, and one click opens the picker, so presenting 6 → 7 and the corporate audience 7.3 → 7.5. There is still no share shortcut, and we do not lead Zoom or Meet (~8). Password and Invite follow a German or Spanish device, including the button tip and the form that makes a room you run. Locale 8.5 → 9. Run app and the Who download for the police stay English, so locale is not a 10. Personal audience 7.6 → 7.8. Still behind FaceTime (~9). We do not lead. Alt+S shares or stops the screen, so presenting 7 → 8 and the corporate audience 7.5 → 7.7. Hand and view still need the pointer, so efficiency stays 6. We do not lead Zoom or Meet (~8). The chat privacy line is 16px and one line, in German and Spanish too. Readability 6 → 6.5. Reactions is still an icon, so this is not a 7. Church audience 7.1 → 7.3. We do not lead a small group (~7.5) or a church desk (~8). With other people in the call, the line says faces stay soft until a password, in German and Spanish too. Warmth 7 → 7.5. The dock is still a product, so this is not an 8. Personal audience 7.8 → 7.9. Still behind FaceTime (~9). We do not lead. When you are alone, Invite copies the link in one click, and shares it where the browser can. Effort 8 → 8.5. Personal audience 7.9 → 8.0. You still confirm your name first, so effort is not a 9, and we do not lead FaceTime (~9). The join card’s heading is the title. It does not have a second line, “This is how you’ll appear in the meeting.” A meeting is always transcribed: each browser writes its own voice, and anyone can open or download the transcript from chat. CC only shows or hides captions on your screen, and the selected button is blue. Tiles no longer say who is transcribing. Caption quality is still not Meet’s, so that round left corporate at 7.7 and we do not lead. Chat is one button on the dock, the same place Zoom, Meet, and Teams put it, so efficiency 6 → 6.5 and the corporate audience 7.7 → 7.8. Hand and view still need the pointer, so efficiency is not a 7. We do not lead Zoom or Meet (~8). Alt+H raises or lowers a hand while More stays closed, in German and Spanish on the shortcut list. The gallery view still needs the pointer, so efficiency stays 6.5 and corporate stays 7.8. We do not lead. Alt+F switches Fit and Scroll, so efficiency 6.5 → 7 and the corporate audience 7.8 → 7.9. Invite, settings, and the rest of More still need the pointer, so efficiency is not an 8. We do not lead Zoom or Meet (~8). The dock mic says Unmute while you are muted and Mute while you are live, in German and Spanish too, and there is no header Unmute beside it. Reactions is still an icon, so readability stays 6.5 and church stays 7.3. Personal stays 8.0. Who, Invite, Run app, Vote, Password, Stage, Record, captions, Settings, Transcript, and Help each have a key, in German and Spanish on the list, so efficiency 7 → 8 and the corporate audience 7.9 → 8.1. That average is ahead of Zoom and Meet at about 8. Polish is still 7, and host bulk tools still need the pointer, so efficiency is not a 9. We do not lead church or personal.
