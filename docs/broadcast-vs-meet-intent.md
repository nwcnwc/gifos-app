# Broadcast and Meet: what the design says

This note is the design record for how Broadcast differs from Meet. It does not change any control. Claims are tied to a source. Anything not in a source is marked as an assumption or left as an open question.

`docs/broadcast-role-controls.md` is an audit of the current page. It is not a design source, and it is not treated as Nathan's confirmation.

## Sources read

In this repo (`nwcnwc/gifos-app`):

- Shipped copy and comments on `origin/main`: `run.html` (lobby, Help, the broadcast skin), `browser-support.json`, `changelog.json`, `about.html`, `js/sample-apps.js`, `js/runtime.js`, `js/desktop.js`, `themes/icons.js`.
- `origin/cursor/qa-broadcast-mobile`: `BENCHMARK.md` (the audience scorecard) and `QUIRKS.md`.
- `origin/cursor/meet-selfview-stage`: `design/meet-selfview-stage.md` (commit `1b9da0c`).
- `origin/cursor/meet-gallery-fit-scroll`: `js/meet-pack.js` and commit `5bc3390`.
- `origin/cursor/reactions-smiley-pin-header`: commit `7ae8c49`.
- `origin/ui-redesign-meet`: mockups only (`ui-review/meet/`). No written Broadcast spec.

`nwcnwc/gifos` is not a public repository. `gh repo list nwcnwc` returns `gifos-app`, `gifos-apps-source`, and `gifos-mcp`, and `git clone https://github.com/nwcnwc/gifos.git` returns "repository not found".

`nwcnwc/gifos-apps-source` has no Broadcast app. Meeting Bot (`meeting-bot/manifest.json`, `help.md`, `CONTROL.md`) is a different product: a bot that sits in meetings. Its "broadcast" wording is app-data visibility (`read-only`: guests see, the host writes), not the Broadcast app.

Comments in `run.html` cite `docs/meeting.md`, `docs/media-plane.md`, `docs/one-runtime.md`, and `docs/app-mesh.md`. None of those files are in any branch of this repo.

## Who each app is for

**Meet is many-to-many.** The Meeting Help, which stays in the page until a broadcast or an app room replaces it, says the room has no size limit and is built so everyone can speak in one live room: "the whole Earth in one meeting at once — everyone able to speak." A seat, a row, and the stadium are how that crowd is arranged. The Stage is the front, heard first by everyone, and it is one tier inside that crowd, not a replacement for it. (`run.html` Help, "How this meeting works".)

The Meeting icon is a grid of faces. (`themes/icons.js`, `ART.video`.) The Home Screen help says a meeting is "video, audio, chat, and apps in a call with people you invite." (`js/sample-apps.js`, the `meet` help string.) About describes the built-in meeting as a host-less room: the link does not expire, everyone joins muted with the camera off, anyone can blur, anyone can mute or blur someone else for the room, and any participant can lock the room with a password. (`about.html`, "Meetings, strictly peer-to-peer".) The browser page says a meeting is "Seeing and hearing each other on a shared link," and a camera is optional. (`browser-support.json`, feature `meet`.)

The lobby offers two ways to start: "Start a meeting" (an open room, anyone with the link) and "Start a room you run" (you are the admin). (`run.html` lobby markup.)

**Broadcast is one-to-many.** The icon comment says the picture is one host on one panel, "never a grid: the whole point is one-to-many," with a LIVE lamp and rows of eyes watching. (`themes/icons.js`, `ART.broadcast`.) The browser page says "One person on stage, everyone else watching." (`browser-support.json`, feature `cast`.) The Home Screen help says "you on stage, as many viewers as you like, and chat as the back channel," and "Viewers watch; they talk in chat." (`js/sample-apps.js`, the `broadcast` help string.) The in-call Help says "one host (and anyone they call up) on the Stage, and an unlimited audience watching." (`run.html` `applyRoomHelp`, broadcast story, as shipped on `origin/main`.)

The lobby drops the open room. Creating a broadcast mints an admin room, and the button says "You go live on the Stage; anyone with the link watches and chats." (`run.html` `showLobby`, the `#bc=1` rewording.) Nathan placed the Broadcast icon directly under Meeting on the Home Screen (`js/desktop.js`, `placeBroadcastBelowMeeting`, 2026-08-03).

The mobile scorecard scores Broadcast against three audiences: Corporate, Church, and Personal. The rivals named for a broadcast are StreamYard, YouTube Live, and church streaming desks (Resi, BoxCast, and a ProPresenter-style go-live panel). The church volunteer is the person who should get "a short path: name the service, go on, read a link." (`origin/cursor/qa-broadcast-mobile` `BENCHMARK.md` and `QUIRKS.md`.) The words "town hall" and "personal stream" are the wording of the request that asked for this note. The scorecard's matching rows are Corporate and Personal. Those two phrases are not in the repo.

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

## How someone moves on and off the stage, and who decides

**Meet, open room.** You decide. Stage means "step up to be seen and heard first by the whole room," and you step down yourself. (`run.html` Help.) Seats are capped. A room majority can vote someone onto the stage, off it, or out of the room, because there is no admin to ban. (`run.html` `applyAdminUi`.) Tapping Song steps that person onto the stage as the song leader. (`run.html` Help, "Singing together".)

**Meet, admin room.** The admin decides who may. Admins, and people they grant, can take the stage. The grant confers the right. The person's own client performs the step-up. No peer can put them on stage. A grant that arrives while their hand is raised is the admin answering the hand queue, and that client steps up itself. Stepping down is always their own right. (`run.html` comments above `paintStage` and `reactHandCall`.) Revoking the grant pulls them off on every receiver, because every receiver filters the stage set. (`run.html` comment above `canStage`.)

**Broadcast.** The host is put on the stage by the page, once their admin key is adopted, unless the stage is full. Camera and microphone stay off until they tap. If that auto-step fails, the status line tells them to tap Stage. (`run.html` boot comment and `tryBroadcastStage`.) A viewer asks by raising a hand. The host decides: the hand queue floats to the top, and the host taps a name to call them up. The viewer's phone asks for the camera and microphone, and only then do they join the stage. The viewer may step down. The host may revoke the grant. (`run.html` broadcast Help.)

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
- Share stays a separate grant. The shipped skin shows it to a non-host only after that grant. Record, captions, Run app, and Password stay off for non-hosts.

## Preferences Nathan has stated that are not the shipped Broadcast skin

These are recorded so a later control change does not ignore them. They are not implemented as Broadcast behavior in this note.

- The stage never covers the other participants unless Stage only is chosen. On the Meet branch `cursor/meet-selfview-stage`, stage and speaker views keep everyone else in a strip. The rectangles do not overlap. Stage only is the only mode that drops the strip, and a screen share must not pick it by itself. (`design/meet-selfview-stage.md`.) The same preference was restated in the request for this note. The shipped Broadcast skin does the opposite with the audience: it hides the row grid and the stadium entirely.
- His own tile goes on the stage only if he puts it there. The Meet note says "Show me on stage" is off until you turn it on. Stepping up for the room, and being the person who is talking, do not put your own tile on the stage. (`design/meet-selfview-stage.md`.) The request for this note states the same preference. The shipped Broadcast page auto-steps the host onto the stage for the audience. That is a different act from drawing the host's self-view tile inside the stage frame, and the note does not say they are the same.
- Tiles are never skinny. The Meet gallery packer refuses a tile narrower than a portrait phone (`w/h` below 0.44) when another arrangement exists, and a too-narrow box is shortened to that ratio. (`origin/cursor/meet-gallery-fit-scroll`, `js/meet-pack.js` and `test/unit/meet-gallery-layout.js`; commit `5bc3390`.) The request for this note states the same preference. Nothing in the Broadcast skin says the stage picture follows that rule.
- The join screen prefills the system name and avatar, with a "this is how you'll appear" preview. This is stated in the request for this note. The shipped lobby shows "You'll join as {name}" and a change button (`run.html` `.lob-namebar`). No source in these repos describes a system avatar or that preview sentence.
- The sparkle icon is for AI features. Reactions use a smiley. Commit `7ae8c49` on `cursor/reactions-smiley-pin-header` says the reactions control is a face, and the four-point sparkle is only on the transcript and the note bot. The Home Screen icons, including Meeting, use a separate four-point "aurora sparkle" as decoration (`themes/icons.js`). That icon sparkle is not the reactions control.

## Assumptions

- **Assumption.** "Corporate town hall" and "personal stream" mean the scorecard's Corporate and Personal rows. The repo names the rows and the rivals. It does not use those two phrases.
- **Assumption.** A called-up person is a temporary stage guest, not a second host. Help says they join the host on stage and can step down, and it does not give them the host password, the viewer password, chat moderation, or ban.
- **Assumption.** Hiding the audience grid is intentional for viewers who publish nothing, not an unfinished Meet layout. The CSS comment and the icon comment both say the grid is not the show. Whether co-presenters on stage must still see each other in a strip is not answered by those comments.
- **Assumption.** The Meet self-view, gallery, and reactions notes apply to Meet first. They apply to Broadcast only where a later confirmation says so. They are listed above so they are not dropped.

## Open questions

1. Does "the stage never covers the other participants" apply inside a broadcast? The shipped skin hides every viewer tile. If two people are on stage, must each still see the other in a strip, with Stage only as an explicit choice?
2. The host is auto-stepped onto the stage for the audience. Is that still wanted, given "my tile goes on the stage only if I put it there"? Or does that sentence only govern the host's self-view, while the audience stage stays automatic?
3. Must a broadcast stage tile obey the Meet rule that a tile is never narrower than a portrait phone?
4. Which join screen prefills the system name and avatar: Meet, Broadcast, or both? What is the system avatar when the device has none?
5. Do reactions exist in a broadcast, and is the smiley-versus-sparkle rule the same there? The shipped Broadcast Help does not mention reactions.
6. The shipped skin shows Share to a non-host after a screen-share grant, and hides Run app, Record, and captions from every non-host. Is a called-up person allowed any of those, or only camera and microphone?
7. Is the sound mix, including Song, deliberately absent from a broadcast? A church service is the audience the scorecard is losing, and Meeting Help's singing tools are exactly the stadium mix the broadcast skin hides.
8. Help says ban lives on each tile, and the broadcast skin does not draw those tiles. Where should promote, demote, mute, blur, and ban live?
9. Should a broadcast say LIVE, OFF AIR, or WATCHING? The scorecard's next gap is that a viewer sees "Joining the broadcast…" and a host with no picture has no OFF AIR mark (`BENCHMARK.md`, Q5).
10. `nwcnwc/gifos` was not readable, and `docs/meeting.md` and `docs/media-plane.md` are cited but not in this repo. If those files hold a later decision, this note has not seen it.
