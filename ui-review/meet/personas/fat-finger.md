# Fat finger — Meet

412×915, touch on, coarse pointer, no hover. One headless browser. The join veil covered the room (the relay on port 9 never gave me a seat). I removed it, then measured. A first-visit name sheet was also covering the screen. Not now is 95.7×33, Continue is 100.1×33. Both under 48 tall. The bar boxes below are the layout under that sheet. The sheet does not move them.

## Lobby

- #lob-open: 380×67.2. Not under 48 tall.
- #lob-admin-btn: 380×82.8. Not under 48 tall.
- #lob-join-btn: 380×67.2. Not under 48 tall.
- #lob-rename ("change"): 47×19. Under 48 tall, and under 48 wide.

Space between the three big buttons: 9.5px, then 9.6px. The edges are close. The buttons themselves are tall enough. Rename is a bare text link.

## Call, bar collapsed

Bar is 412×59.4. That is 6.5% of 915. Two rows. The buttons fit on row 1. The status line wraps onto row 2. Space between those rows: 4.8px. Space between neighbors on the row: 4.8px. Same-row neighbors have no vertical gap. They sit side by side.

- #bartoggle: 26×26
- #mic: 31.8×24.8
- #cam: 31.8×24.8
- #blur-max: 35.9×20.9
- #blur-min: 32.9×20.9
- #blur-none: 49.4×20.9
- #leavebtn: 49.4×22.9

Row order: toggle, GifOS, mic, cam, float (pip, 31.8×24.8), blur, Leave. Max, Min, and No blur touch. Gap between those segments: 0. No blur's box ends 5.9px before Leave. The blur group itself is 4.8px from Leave.

Every one of these is under 48px tall. Toggle, mic, cam, Max, and Min are under 48px wide too.

## Call, bar open

Same top row. Same sizes. Bar grows to 412×114.9. That is 12.6% of 915. Four rows. Space between each pair of rows: 4.8px. Neighbors on a row: 4.8px apart, no vertical gap.

- #invite: 45.5×22.9
- #sharebtn: 86.5×22.9
- #hand: 45.5×22.9
- #chatbtn: 42.3×22.9
- #stagebtn: 48.1×22.9

Row 3: Who, Invite, Run app, Share screen, Password, Vote.
Row 4: Hand, Chat, Record, CC, Stage, Help.
Those buttons are all 22.9px tall. Invite, Hand, and Chat are also under 48 wide. Share is wide enough (86.5) but still 22.9 tall. Stage is 48.1 wide and 22.9 tall.

Collapsed uses 2 rows and 59.4px. Open uses 4 rows and 114.9px. Opening adds 55.5px. The extra rows are cheap only because the targets stayed tiny.

## Verdict

I will miss. The live row is 21–26px tall with 4.8px of air, and Leave sits on that row, one sloppy tap from No blur. Opening the bar wraps to 4 rows and still only takes 12.6% of the screen, so there was room to make the targets bigger. Nothing in the bar clears 48px tall.

Worst three: #blur-min (32.9×20.9, glued to Max and to No blur), #leavebtn (22.9 tall, 4.8px from the blur group, and it drops the call), #bartoggle (26×26, the only way to Hand, Chat, and Invite). Mic is the same kind of miss (31.8×24.8, 4.8px from the camera) and I hit it more often.
