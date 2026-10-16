# Meet self-view and stage strip (v0.9.23)

Your own video is adjustable. A stage keeps the other people in a visible strip. Only an explicit Stage only view hides them, and your tile goes on the stage only when you put it there.

## Self-view arrangements

| Arrangement | What you see | Size | Position | Covers someone? |
| --- | --- | --- | --- | --- |
| Tile | You are the first gallery tile, the same cell as the people you are with | The grid's cell | Leading seat | No |
| Float | A window on top of the meeting | S / M / L (20% / 30% / 42% of the short side, at least 72px, at most half the short side) | Corner (TL, TR, BL, BR) or a dragged point, clamped inside the video area and lifted off the dock | Only where you park it |
| Strip | A band reserved on one edge. The meeting packs into what is left | S / M / L thickness (phone 76 / 108 / 148, desktop 96 / 140 / 196, never more than 42% of that edge) | Bottom, right, left, or top | No |
| Hide | Nothing on your screen | — | — | No |

The camera still sends when the tile is hidden. Hide only changes your screen.

**Default: Tile.** A floating inset always covers part of someone, and the old one was a fixed picture: 294×221 on a desktop, 180×240 on a phone, jumping to the left at three people and shrinking at five. Tile keeps you in the grid at the same size as everyone else, in the leading seat, and nobody is covered. Float, strip, and hide are one tap away in More → You.

The old name `inset` is a float at the current size and corner, not a locked picture. Drag the float to move it. Arrow keys nudge it while it is focused. Double-click returns it to the bottom-right corner. A strip's edge follows the window until you pick one: bottom on a phone, the right edge on a wide desktop, bottom on a tall desktop.

Size, place, and hide are stored per phone and desktop in `gifos_self_view_v1`.

**Show me on stage** is off until you turn it on. That is the only way your own tile becomes a stage tile. Stepping up for the room (the Stage button) does not do it by itself, and being the person who is talking does not do it either. If you pin yourself on the stage, you are not also drawn as a float or a strip.

## Stage strip

Stage and speaker views split the frame. The stage is the larger part. Everyone who is not on the stage stays in a strip beside it.

- On a phone the strip is always along the bottom, including landscape. A side rail on a short phone is a sliver of foreheads and reads as if those people were covered.
- On a wide desktop the strip is a side rail. On a tall desktop it is a bottom strip.
- The strip is at least 88px on a phone (112px on a desktop bottom strip, 140px on a side rail) and about 16–22% of that edge, and never more than 42% so the stage stays larger.

The rectangles do not overlap. The strip is real layout space, not a thumbnail painted on top of the stage.

**Stage only** is the only mode that drops the strip. Auto used to pick it for a screen share on a landscape phone. It no longer does. A share opens stage + strip. Stage only happens when you choose that mode (`manual: 'stageOnly'` or `__meetViewMode = 'stageOnly'`). If nobody is left off the stage — you hid yourself and everyone else is pinned — the stage uses the whole frame, because there is nobody left to cover.
