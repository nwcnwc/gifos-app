# Broadcast / Meeting desktop scorecard

Scored 16 Oct 2026 against the desktop chrome in `run.html` (Meeting, and Broadcast via `#bc=1`). Scores are 1–5 for the **desktop UI** a person actually sees. 5 means that product is the reference for the row. This is not a score for media quality, scale, or mobile.

GifOS does **not** lead any audience yet. The gap column is what this branch is closing, one repro at a time.

## Who we are scoring against

- **Corporate:** Zoom, Google Meet, Microsoft Teams. Polished, efficient, trustworthy.
- **Church:** StreamYard, YouTube Live, and typical church streaming (BoxCast, ProPresenter live, a volunteer-run “go live” desk). Simple for volunteers and older members. Services and small groups.
- **Personal:** FaceTime, Meet. Warm, few steps, family and friends.

## Corporate

| | Zoom | Meet | Teams | GifOS now |
| --- | --- | --- | --- | --- |
| Lobby says what will happen | 5 | 4 | 4 | 3 |
| Mute / camera state is obvious | 5 | 5 | 4 | 2 |
| Controls labeled, not hover-only | 5 | 4 | 4 | 2 |
| Layout holds at 1280, 1920, 900, resize | 5 | 4 | 4 | 2 |
| Chat usable while the dock is up | 5 | 5 | 4 | 2 |
| Keyboard path (shortcuts, Escape, focus) | 4 | 4 | 4 | 3 |
| Trust: live, recording, who is here | 5 | 4 | 5 | 2 |
| **Audience score** | **4.9** | **4.3** | **4.1** | **2.3** |

Zoom leads. The biggest GifOS gaps are the covered chat composer (Q1), icon-only mute (Q5), and no on-air trust mark (Q3).

## Church

| | StreamYard | YouTube Live | Church desk tools | GifOS now |
| --- | --- | --- | --- | --- |
| A volunteer knows if they are on air | 5 | 5 | 5 | 1 |
| Language a non-technical host understands | 4 | 4 | 3 | 2 |
| Large, obvious controls | 4 | 3 | 4 | 4 |
| Service (broadcast) vs small group (meeting) | 5 | 4 | 4 | 2 |
| Chat / prayer requests don’t fight the controls | 4 | 4 | 3 | 2 |
| Join without an account or an install | 2 | 3 | 2 | 5 |
| **Audience score** | **4.0** | **3.8** | **3.5** | **2.7** |

StreamYard leads. GifOS already wins “open the link, no account”. It loses the service: the room still says Meeting (Q2), nothing says Live (Q3), and the chat field hides under the dock on a narrow desktop (Q1).

## Personal

| | FaceTime | Meet | GifOS now |
| --- | --- | --- | --- |
| Warm, little chrome | 5 | 3 | 3 |
| Start or join in one obvious step | 5 | 4 | 3 |
| Invite is in the primary controls | 5 | 5 | 2 |
| Reactions feel human | 4 | 4 | 2 |
| Leave / rejoin is understandable | 5 | 4 | 3 |
| **Audience score** | **4.8** | **4.0** | **2.6** |

FaceTime leads. Invite is buried in More. Reactions are the words Clap / Yes / No / Laugh, stacked on the same popover as More (Q7).

## Lead rule

An audience flips to GifOS only when its audience score is strictly above every other column in that table. Rescore after each fix. Do not mark a lead from a single row.

## Rescore log

| When | Corporate | Church | Personal | Note |
| --- | --- | --- | --- | --- |
| Baseline | 2.3 (Zoom 4.9) | 2.7 (StreamYard 4.0) | 2.6 (FaceTime 4.8) | Q1–Q10 open |
