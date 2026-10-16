# Desktop meeting scorecard

Scored 16 Oct 2026 from the desktop UI in `run.html` (branch `cursor/qa-meet-desktop`), driven locally in Chromium, Firefox, and WebKit. Scores are 1–10. A lead means we are ahead of the best product that audience already uses, on that row, for the desktop call itself.

We do **not** lead any audience yet. The chat fix below moves one cell. The rest of the gap is still open.

## Who we are measured against

| Product | Where it still beats GifOS on desktop |
| --- | --- |
| Zoom | Keyboard shortcuts, gallery polish at every width, waiting room, host tools, localized UI, recording that a company expects |
| Google Meet | Fewer controls, excellent captions, a composer that never fights the toolbar, companion / picture-in-picture that is obvious |
| Teams | Raise-hand and roster that stay readable in a large room, chat and files that feel like one place |
| FaceTime | Almost no chrome, names you already know, a call that feels like a room rather than a product |
| StreamYard / Restream | Scenes, lower thirds, branding, one “go live” a volunteer can teach in a minute |
| YouTube Live | Stream health, public chat at scale, a clear on-air state |
| Church streaming (ProPresenter, Resi, a typical “live service” desk) | Lyrics, a confidence view for the person running the booth, multi-camera, an archive of the sermon |

GifOS already beats them on a few things those products do not offer: no account, one link, peer-to-peer media, blur by default, and a quiet join. That is the trust row. It is not the whole call.

## Corporate

Polished, efficient, trustworthy. Best of the field today: Zoom and Meet, about 8.

| | GifOS | Notes |
| --- | ---: | --- |
| Trust (no account, private media, quiet join) | 9 | Ahead of Zoom, Meet, and Teams |
| Visual polish | 6 | Dock is calm. Chat used to slide under it below ~1140px; that is fixed |
| Efficiency (keyboard, few clicks) | 3 | No shortcuts. Chat is two clicks (More, then Chat) |
| Presenting | 5 | Share exists. Not yet walked as a client demo |
| Large-room host | 4 | Count is a status sentence that ellipsizes |
| **Audience** | **5.4** | Does not lead |

## Church

Simple for volunteers and older members. Services and small groups. Best of the field: Zoom or Meet for a small group (~7.5), StreamYard or a church desk for a service (~8).

| | GifOS | Notes |
| --- | ---: | --- |
| Volunteer simplicity | 5 | Lobby copy is long. More is a wall of tools |
| Readability for older eyes | 5 | Icons are large. They have no words. Privacy line in chat was 110px wide; it now wraps |
| Small group (conversation, singing) | 7 | One link, blur, unison. The call itself is close |
| Service / broadcast | 4 | No lower third, no obvious on-air, no volunteer checklist |
| **Audience** | **5.3** | Does not lead |

## Personal

Warm and effortless for family and friends. Best of the field: FaceTime, about 9. Meet is the web comparison, about 7.5.

| | GifOS | Notes |
| --- | ---: | --- |
| Warmth | 6 | Light lobby, dark call. Copy still sounds like a security product (“a password unlocks clear video”) |
| Effort to get in | 7 | One link, no install. First visit still throws a name dialog over the controls |
| Staying in the call (resize, tab away) | 5 | Resize no longer covers the composer. Tab-away not walked yet |
| Locale | 3 | Chrome is English. Captions follow the device language |
| **Audience** | **5.3** | Does not lead |

## This cycle

Fixed the chat panel fighting the dock (see QUIRKS.md). Corporate polish 5 → 6, church readability unchanged except the chat line, personal “staying in the call” still 5 until tab-away is proven. Audience totals stay in the mid 5s. Next gap: words on the dock and keyboard shortcuts, which are the largest corporate-efficiency and church-readability holes that this UI can close without touching gallery layout, self-view, or the reactions icon.
