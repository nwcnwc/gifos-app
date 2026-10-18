# Broadcast and Meet: what the design says

This note is the design record for how Broadcast differs from Meet. It does not change any control.

The authority is the repo: docs, specs, manifests, code, and commit history. An unmerged branch is part of the repo. A Meet branch describes Meet. It does not replace the shipped Broadcast skin. Nathan confirmed the five points under Confirmed design. Those answers settle the earlier chat-versus-repo conflicts. Anything this note still cannot pin down is under Still ambiguous.

Claims below are tied to a file or a commit. Anything the repo does not say is marked as an assumption or left as an open question.

`docs/broadcast-role-controls.md` is an audit of the current page. It is not a design source.

## Sources read

In this repo (`nwcnwc/gifos-app`):

- Shipped copy and comments on `origin/main`: `run.html` (lobby, Help, the broadcast skin), `browser-support.json`, `changelog.json`, `about.html`, `js/sample-apps.js`, `js/runtime.js`, `js/desktop.js`, `themes/icons.js`.
- `origin/cursor/qa-broadcast-mobile`: `BENCHMARK.md` (the audience scorecard) and `QUIRKS.md`.
- `origin/cursor/qa-broadcast-desktop` at `a5b2611`: `QUIRKS.md`, `test/e2e/broadcast-desktop.spec.js`, and the Watching screenshots under `test/e2e/artifacts/`.
- `origin/cursor/meet-selfview-stage`: `design/meet-selfview-stage.md` (commit `1b9da0c`).
- `origin/cursor/meet-gallery-fit-scroll`: `js/meet-pack.js` and commit `5bc3390`.
- `origin/cursor/reactions-smiley-pin-header`: commit `7ae8c49`.
- `origin/ui-redesign-meet`: mockups only (`ui-review/meet/`). No written Broadcast spec.

`nwcnwc/gifos` is not a public repository. `gh repo list nwcnwc` returns `gifos-app`, `gifos-apps-source`, and `gifos-mcp` (since renamed `gifos-meet-mcp`, next to `gifos-broadcast-mcp` and `gifos-mcp-core`), and `git clone https://github.com/nwcnwc/gifos.git` returns "repository not found".

`nwcnwc/gifos-apps-source` has no Broadcast app. Meeting Bot (`meeting-bot/manifest.json`, `help.md`, `CONTROL.md`) is a different product: a bot that sits in meetings. Its "broadcast" wording is app-data visibility (`read-only`: guests see, the host writes), not the Broadcast app.

Comments in `run.html` cite `docs/meeting.md`, `docs/media-plane.md`, `docs/one-runtime.md`, and `docs/app-mesh.md`. None of those files are in any branch of this repo.

## Who each app is for

**Meet is many-to-many.** The Meeting Help, which stays in the page until a broadcast or an app room replaces it, says the room has no size limit and is built so everyone can speak in one live room: "the whole Earth in one meeting at once — everyone able to speak." A seat, a row, and the stadium are how that crowd is arranged. The Stage is the front, heard first by everyone, and it is one tier inside that crowd, not a replacement for it. (`run.html` Help, "How this meeting works".)

The Meeting icon is a grid of faces. (`themes/icons.js`, `ART.video`.) The Home Screen help says a meeting is "video, audio, chat, and apps in a call with people you invite." (`js/sample-apps.js`, the `meet` help string.) About describes the built-in meeting as a host-less room: the link does not expire, everyone joins muted with the camera off, anyone can blur, anyone can mute or blur someone else for the room, and any participant can lock the room with a password. (`about.html`, "Meetings, strictly peer-to-peer".) The browser page says a meeting is "Seeing and hearing each other on a shared link," and a camera is optional. (`browser-support.json`, feature `meet`.)

The lobby offers two ways to start: "Start a meeting" (an open room, anyone with the link) and "Start a room you run" (you are the admin). (`run.html` lobby markup.)

**Broadcast is one-to-many.** The icon comment says the picture is one host on one panel, "never a grid: the whole point is one-to-many," with a LIVE lamp and rows of eyes watching. (`themes/icons.js`, `ART.broadcast`.) The browser page says "One person on stage, everyone else watching." (`browser-support.json`, feature `cast`.) The Home Screen help says "you on stage, as many viewers as you like, and chat as the back channel," and "Viewers watch; they talk in chat." (`js/sample-apps.js`, the `broadcast` help string.) The in-call Help says "one host (and anyone they call up) on the Stage, and an unlimited audience watching." (`run.html` `applyRoomHelp`, broadcast story, as shipped on `origin/main`.)

The lobby drops the open room. Creating a broadcast mints an admin room, and the button says "You go live on the Stage; anyone with the link watches and chats." (`run.html` `showLobby`, the `#bc=1` rewording.) Nathan placed the Broadcast icon directly under Meeting on the Home Screen (`js/desktop.js`, `placeBroadcastBelowMeeting`, 2026-08-03).

The mobile scorecard scores Broadcast against three audiences: Corporate, Church, and Personal. The rivals named for a broadcast are StreamYard, YouTube Live, and church streaming desks (Resi, BoxCast, and a ProPresenter-style go-live panel). The church volunteer is the person who should get "a short path: name the service, go on, read a link." (`origin/cursor/qa-broadcast-mobile` `BENCHMARK.md` and `QUIRKS.md`.) The phrases "town hall" and "personal stream" are not in the repo. The scorecard's matching rows are Corporate and Personal.

Church language inside Meeting Help ("a great stone church", a hymn, an "Amen") is about singing together in a meeting, not a statement that Broadcast is the church product. (`run.html` Help, "Singing together".)

## Roles, and what each role can see and do

### Meet

**Open-room participant.** There is no host. Help calls this "friendly anarchy" and says most rooms are open. (`run.html` Help, "Admin".) Anyone with the link joins. Everyone joins muted with the camera off (`about.html`). Anyone may step onto the Stage while a seat remains, raise a hand, chat, run an app, share a screen, record on their own device, and turn on captions. Anyone may mute or blur another person for the room, with attribution, and anyone may set the room password that unlocks clear video (`about.html`; `run.html` Help, "Password"). The private sound mix (Stage, My row, The stadium) and Timing (Conversation, Unison, Song) are in Settings and change only what that person hears (`run.html` Help, "The sound mix").

**Guest in a room an admin runs.** The lobby calls the admin password "yours alone" and the guest password the one you do share. (`run.html` lobby markup.) The guest does not hold the admin key. Stage entry and, separately, screen share are admin grants. The shipped comment says allowing apps or the stage does not allow the screen. (`run.html`, the comment above `mayShareScreen`.) Clear faces need the room password, an admin present, and that person's own consent. (`run.html` `blurLevelFor`.)

**Admin.** Knows the admin password. Can ban a device, set the guest password, grant the stage and apps, and grant screen share. Vote-off exists only where there is no admin. (`run.html` `applyAdminUi`: "Vote-off only exists where there is no admin to ban bad actors.")

A person who denies the camera is still in the meeting. View-only is a supported state, and a later tap can ask for the camera. (`browser-support.json` `meet.notRequired`; `run.html` boot comment, "THE KNOCK WAITS FOR NOBODY".)

### Broadcast

Broadcast is always that admin room, wearing a skin. There is no open broadcast. (`run.html` `showLobby`: "no open rooms (a broadcast without a host is nothing)".)

**Host.** Holds the host password, which Help calls "your control of this broadcast" and says not to send to viewers. (`run.html` broadcast Help, as on `origin/main`.) The host's camera and microphone still start off; going live on pixels is a deliberate tap. The page then tries to put the host on the Stage, because "a broadcast page's whole point" is that the Stage is where their camera reaches the room. (`run.html` boot comment, "The HOST auto-steps onto the Stage".) The host sets the viewer password. Without it the picture stays fully blurred. With it, people the host gives it to see the picture clear. The password is not part of the link. (`run.html` broadcast lobby notes and broadcast Help.) The host calls people up from the hand queue, can revoke that grant, can turn chat off, can delete a chat line, and can ban. Help says the ban lives on each tile. A broadcast winds down after a countdown when the host leaves. (`run.html` broadcast Help.)

**Viewer.** Brings no camera and no microphone. The page must not even ask. Help: "Your camera and microphone are not used — watching asks no permissions at all." The comment gives the reason: "an audience of thousands must not see a permission prompt to watch." (`run.html` broadcast Help and the boot comment "BROADCAST viewers bring no media at all".) They watch and they chat. Chat is not stored on a server and is gone when the broadcast ends. (`run.html` broadcast Help.) They can raise a hand to ask for the Stage. The shipped skin hides their microphone, camera, flip, and blur until the host grants the stage, and hides Run app, Record, captions, and Password from every non-host. (`origin/main` `run.html` broadcast CSS.) `QUIRKS.md` records the hidden camera and mic as intended.

**Someone the host calls up.** Help's name for them is "anyone they call up," not a separate product name. The host's grant is the same signed stage grant as in an admin meeting. Their own phone then asks for the camera and microphone, and they join the host on the Stage. They may step down themselves. The host can revoke the grant and pull them back down. (`run.html` broadcast Help; broadcast CSS comment: a granted guest "gets the mic/cam buttons back".)

What a called-up person can do beyond camera and microphone is only partly written down. The shipped skin keeps Share hidden until a screen-share grant (`share-granted`), and the comment says "a viewer is not a broadcaster until an admin allows their screen." Run app, Record, captions, and Password stay hidden for every non-host even after a stage grant. (`origin/main` broadcast CSS.)

**What nobody in a broadcast gets.** The row grid and the stadium strip never render. Vote is hidden. The sound mix is hidden, because "Stage audio is the only bus there is." Blur-every-guest and turn-every-guest's-video-off are hidden, because they "moderate a row tier a broadcast doesn't have." (`origin/main` broadcast CSS comments.)

**What everyone still sees.** The stage picture, chat, the hand control, Who, Invite, Settings, Help, and Admin sign-in are not in that hide list. The picture stays blurred until the viewer password is set. Nathan's rule, dated 2026-08-03, is that the clear-video rule is unchanged in a broadcast: an admin room starts unlocked, and the host setting the room password is the deliberate act that allows clear video. A clear live picture that anyone with only the link can see "is deliberately not a thing and must never become one," because of minor-protection law. The password is that legal boundary. (`run.html` `blurLevelFor`.)

The skin is not a security boundary. A client that strips `#bc=1` lands in the meeting UI of the same room. Signed authority, admin-only stage entry, and receiver-side moderation are the admin room's rules. (`run.html` broadcast flag comment.)

### Avatar rides the video

Nathan's rule for Meet and for Broadcast: a person's avatar rides their video feed. When the camera is off, the page paints that avatar into the video track. Blur for all, and a blur on one person, then blur the avatar the same way they blur a camera, because the avatar is the picture in that track.

The shared page is `run.html`. The blur classes (`.blur1`, `.blur2`, and the same filter on a fullscreen tile) sit on the `<video>`. `paintAvatarCanvas` paints the initial into a video track and the overlay stays undisplayed. The me tile shows that track with the blur baked in, which is the same rule as a camera: the preview is the pixels that leave. Everyone else's tile keeps the receiver blur class on the video. A broadcast viewer publishes nothing. The still can sit on their own tile, and `sentVideoTrack` stays empty for that seat.

The gate is `test/browser/e2e-avatar-feed.js`. It is part of the broadcast role gate (`test/browser/e2e-broadcast-roles.js` runs it after the role checks). It failed while the letter was an overlay, then passed once the letter was a frame of the video.

## How someone moves on and off the stage, and who decides

**Meet, open room.** You decide. Stage means "step up to be seen and heard first by the whole room," and you step down yourself. (`run.html` Help.) Seats are capped. A room majority can vote someone onto the stage, off it, or out of the room, because there is no admin to ban. (`run.html` `applyAdminUi`.) Tapping Song steps that person onto the stage as the song leader. (`run.html` Help, "Singing together".)

**Meet, admin room.** The admin decides who may. Admins, and people they grant, can take the stage. The grant confers the right. The person's own client performs the step-up. No peer can put them on stage. A grant that arrives while their hand is raised is the admin answering the hand queue, and that client steps up itself. Stepping down is always their own right. (`run.html` comments above `paintStage` and `reactHandCall`.) Revoking the grant pulls them off on every receiver, because every receiver filters the stage set. (`run.html` comment above `canStage`.)

**Broadcast.** The host is put on the stage by the page, once their admin key is adopted, unless the stage is full. Camera and microphone stay off until they tap. The host can step off and back on. If that auto-step fails, the status line tells them to tap Stage. (`run.html` boot comment and `tryBroadcastStage`.) A viewer asks by raising a hand, and can lower it. The host sees that queue as a list with Promote on each name. Promote is the signed stage grant. The viewer's phone asks for the camera and microphone, and only then do they join the stage. Demote returns them to a viewer and their client stops publishing. The viewer may step down. (`run.html` broadcast Help; Confirmed design.)

## What Broadcast reuses, and what it must hide or change

Broadcast is the Meet page. `runtime.js` routes the Broadcast system app to `run.html#bc=1`. The browser page says it is "the same page as a meeting wearing a different skin" and has the same requirements, listed separately only because people ask separately. (`js/runtime.js` `SYSTEM_PAGES`; `browser-support.json` feature `cast`.) The link form is `/cast/<room>/<verifier>` instead of `/meet/...`, and a broadcast link must reopen as a broadcast. (`changelog.json` 0.9.2; `run.html` pretty-path comment.) Meeting and Broadcast keep separate Recent lists. (`changelog.json` 0.9.2.)

Reused from the call pipeline, because the comments say the rules are the admin room's:

- The mesh: each phone talks only to a handful of neighbors, so two viewers and two million run the same. (`run.html` broadcast Help.) A viewer's local encode budget is given to the stage, because viewers bring no media. (`run.html`, the broadcast return in the quality ladder: "the whole local budget is the stage's".)
- The relay only introduces phones. It does not carry the picture or the sound. (`about.html`; `run.html` Help, "Your privacy".)
- Quiet join for the person who does publish: camera and microphone acquired only on a gesture, and off until they tap.
- The admin key, the signed grant table, bans, chat moderation, and the viewer password as the clear-video gate.
- The stage as the tier the whole room watches, including a person the host calls up.
- Hand queue, chat, Who, Invite, and Admin sign-in.

Hidden or changed, from the shipped skin and Help:

- No open room, and no "anyone with the link is a publisher."
- Viewers are not asked for a camera or a microphone, and they have no publish controls until the host calls them up.
- The audience grid and the stadium are not drawn. The icon is one panel plus eyes, not a grid of faces.
- No vote. No per-listener stadium mix. No blur-all and no video-off-all.
- The host password and the viewer password are named differently from a meeting's admin password and guest password, and the lobby says so.
- Share stays a separate grant. Record, captions, Run app, and Password stay off for non-hosts, including someone the host has called up. Whether that last part should change is still open (Still ambiguous).
- The viewer's join step says their name and picture are seen only if they raise a hand and are promoted. It also says they are watching the service and staying off camera (Confirmed design).
- A lamp in the bar says Watching, Live, or Off air (Confirmed design).

## Meet layout notes that do not govern Broadcast

These are repo sources for Meet on unmerged branches. They are not chat, and they are not the Broadcast skin.

- On `cursor/meet-selfview-stage`, stage and speaker views keep everyone else in a strip. The rectangles do not overlap. Stage only is the only mode that drops the strip, and a screen share must not pick it by itself. "Show me on stage" is off until that person turns it on. Stepping up, and being the person who is talking, do not put their own tile on the stage. (`design/meet-selfview-stage.md`, commit `1b9da0c`.)
- On `cursor/meet-gallery-fit-scroll`, the gallery packer refuses a tile narrower than a portrait phone (`w/h` below 0.44) when another arrangement exists, and a too-narrow box is shortened to that ratio. (`js/meet-pack.js`, `test/unit/meet-gallery-layout.js`, commit `5bc3390`.)
- On `cursor/reactions-smiley-pin-header`, the reactions control is a face, and the four-point sparkle is only on the transcript and the note bot. (`7ae8c49`.) Home Screen icons, including Meeting, use a separate four-point aurora sparkle as decoration. (`themes/icons.js`.)

The shipped Broadcast skin does not use those rules. It hides the row grid and the stadium, it auto-steps the host onto the stage the audience watches, and its Help does not mention reactions or a tile aspect ratio.

## Assumptions

- **Assumption.** A called-up person is a temporary participant on the stage, not a second host. Help says they join the host on stage and can step down. It does not give them the host password, the viewer password, chat moderation, or ban.
- **Assumption.** Hiding the audience grid is intentional for viewers who publish nothing, not an unfinished Meet layout. The CSS comment and the icon comment both say the grid is not the show. The comments do not say whether two people on the stage must still see each other.

## Confirmed design

Nathan confirmed these. They settle the five earlier conflicts. Broadcast follows this list.

1. **Stage only.** A broadcast shows the stage. The row grid and the stadium stay off. Meet's "Stage only" choice and its strip of everyone else stay Meet's (`design/meet-selfview-stage.md`). They do not put viewer tiles back on a broadcast.
2. **Host on stage, and promoting others.** The host goes on the stage when they adopt the admin key (`tryBroadcastStage`). Camera and microphone stay off until a tap. The host can step off and back on. A viewer raises and lowers a hand. The host sees a raised-hands list, with Promote on each person. Promote is the signed stage grant. Demote returns that person to a viewer, and that client stops publishing.
3. **No other tiles.** A broadcast has only the stage, so Meet's gallery tile rules do not apply. The portrait-phone ratio on `cursor/meet-gallery-fit-scroll` stays Meet's.
4. **Viewer join.** Name and picture are new. On the viewer's join step, the page says their name and picture are seen only if they raise a hand and the host promotes them to the stage. The same step says "Watching the service" and "You stay off camera". A search of `origin/cursor/qa-broadcast-mobile` (`run.html`, `QUIRKS.md`, `BENCHMARK.md`) did not find those two phrases as stored copy. They are written here because Nathan named them as the copy this step should match. The desktop line "This is how you'll appear" (`cursor/qa-broadcast-desktop` Q13) is not this step.
5. **Sparkle.** Leave it. The reactions control is a face. The in-call sparkle stays on the transcript and the note bot (`7ae8c49`). The Home Screen aurora sparkle stays decoration, including on Meeting (`themes/icons.js`).

Two earlier gaps are decided the same way:

- **Where ban and the other tile actions go.** Mute, blur, demote, and ban sit on each stage seat (everyone on stage except you). The same actions, with Promote, sit on each row of the admin raised-hands list. The viewer list (Who) groups On stage, Raised hands, and Watching, and each other person there has the same actions. A broadcast still does not draw the row grid, so those buttons are not the hidden Meet tile menu.
- **On-air words.** The page shows a lamp with words beside it. A viewer reads Watching. A host or a stage guest who is sending a camera or a microphone reads Live. A host or a stage guest who is not sending reads Off air. Meetings hide the lamp. The desktop QA bar "Service · You are live" is a different skin. Nathan asked for the words next to the lamp, not that bar.

The watching-viewer rule still holds. A viewer has no camera or microphone control and publishes nothing. On this page that seat is `bc-viewer`, from the viewer role itself, not from `body.notadmin`. `cursor/watching-viewer-no-av-f3b0` keys the same rule off `bc-watching` on the desktop skin.

The avatar rule above still holds. The letter is a frame of the video, so blur covers it.

## Still ambiguous

- A called-up person gets camera and microphone. The shipped skin still hides Share, Run app, Record, and captions from them. Help does not say whether those should come back. They stay hidden.
- Whether a viewer should see the raised-hands list, or only the host. The list is on the page for everyone. Promote, mute, blur, and ban show only for the host.
- Promote on a person who has not raised a hand. Who still offers it. The grant is the right to step up. The hand is what makes their own client step up. Promote on the raised-hands list is the call-up.
- The stage picture is still one strip. Seat actions are a row for each other person on that stage, because the strip is one picture and the row grid stays hidden.
- The host does not get mute, blur, demote, or ban on their own seat.
- Exact lamp words beyond Live, Off air, and Watching. "Service · You are live" and a full-width bar were not part of the confirmation.
- `nwcnwc/gifos` was not readable, and `docs/meeting.md` and `docs/media-plane.md` are cited in `run.html` but are not in any branch of this repo. If those files exist elsewhere, this note has not seen them.
