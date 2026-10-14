# Meet polish

Measured on the local call, relay ws://127.0.0.1:9, after .tile.me and with #joinveil removed. Aurora is on: page #e8ecf1, bar white, accent #0071e3, accent2 #5856d6. The GifOS wordmark is the runtime gradient, 135° from #0071e3 to #5856d6. Camera was turned on so the frame could be measured. Fill is how much of the visible #feed the tiles cover.

Self is always a grid cell: .tile.me, position relative, inside #grid. It is not a floating picture-in-picture. The pip button only floats the whole meeting out of the tab. No emoji or reaction button exists in the bar. #hand is the word Hand. It is hidden until the chevron opens the extra row.

Video uses object-fit contain (black behind the frame). The fake camera was 320×180, the same 16:9 as the tile, so unused area was 0%. No bars inside the picture. The empty space is the page around the tiles, not letterboxing inside them.

## 1280×800

Collapsed bar is 47px. Feed is 1280×753. Mic and camera are 46×29. Leave is 66×28.

- 1 tile: 1264×711. Feed covered: 93.2%.
- 2 tiles: 628×353 each. Feed covered: 46%.
- 3 tiles: 416×234 each. Feed covered: 30.3%.
- 4 tiles: 310×174 each. Feed covered: 22.4%.

One person almost fills the screen. Two or more sit in one short row, and the lower half is empty #e8ecf1. Opening the chevron grows the bar to 85px of 28px text buttons. Hand is then 61×28. Still no reactions.

## 412×915

Collapsed bar is 59px, already two lines (icons, then the status). Feed is 412×856. Every tile is 396×223, one column. Mic and camera are 32×25. Leave is 49×23.

- 1 tile: feed covered 25%.
- 2 tiles: 50%.
- 3 tiles: 75.1%.
- 4 tiles: 92.5% of what you see. The fourth starts below the fold (feed scrolls to 931px; raw tile area is 100.1%).

One person is a short strip. About three quarters of the phone is empty page. Opening the chevron grows the bar to 115px. Hand is then 46×23, in a row with Who, Vote, Stage, and Password.

## Three changes

1. Make the tiles fill the feed. On the phone, one person should use nearly all of that 856px, not 223px. On the wide screen, two to four people should grow down into the empty half instead of shrinking into a 174px strip. Keep the rounded tiles and the Aurora page. The page should be the rim, not the view.

2. Float yourself once someone else is here. Your face becomes a small rounded card in a corner, edged with accent #0071e3 (the self border is a hardcoded #5ca0ff today). Everyone else gets the feed. Alone, you stay the big picture. Do not treat the meeting-float button as a self-view.

3. Put the call on a bottom dock: large mic, camera, reactions, more, and hang-up, about thumb size, on the white surface. Hang-up can stay the red you already use. There is no reactions control at all; Hand can live under More. Keep the gradient wordmark as a small top mark. The top bar is 47px on the desktop and 59px on the phone of tiny type, and opening it stacks more words on the video. That is a system strip, not a finished call.
