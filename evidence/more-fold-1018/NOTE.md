# More fold 2026-10-18 — device finding #8

No blur left the More sheet open, and a reload brought it back. Blur, your video, and the host switches sat in `data-stay`, so a real click did not fold the sheet. Opening More saved `gifos_meet_bar` as `0`, and the next load treated that as "start open".

A button in More now folds the sheet and saves it closed. A reload always starts closed, and a stored `0` is rewritten to `1`. A text field still does not fold the sheet.

## Before (release, no fix)

`test/mobile/more-fold.js` on Pixel 5 and 1280×720, `--disable-gpu`, `DEBUG=on`, trusted clicks. 10/10 red.

After No blur: sheet open (`display: grid`), More said Hide, No blur pressed, `gifos_meet_bar` `0`.
Reload: sheet open again.
A fresh load with `gifos_meet_bar` already `0`: sheet open.

Shots: `before-pixel5-after-none.png` (No blur selected, sheet still up), `before-pixel5-reload.png`, `before-pixel5-seeded.png`, and the desktop pair.

## After

Same command, 10/10 green. After No blur, Min, Max, and Keys: sheet closed, stored `1`. Reload stayed closed. A stored `0` loaded closed and was rewritten to `1`.

Shots: `after-pixel5-after-none.png` (dock says More, sheet gone), `after-pixel5-reload.png`, `after-pixel5-seeded.png`, and the desktop pair.

Relay meeting, Pixel 5, local relay `:9018`, room `morefold-seat-1018`, two people, `debugDump` present. No blur folded the sheet (`stored` `1`, collapsed). Reload stayed closed. `seated.json`, `seated-after-none.png`, `seated-reload.png`.

meet.js phone profile in that room: seated `0/0.0`, bar collapsed, `barmore` `display: none`, `debugDump` a function. `meet.js.txt`, `meet-phone.png`.

Desktop specs `a pick in More folds the sheet, including No blur, and a reload stays closed` and `a stored open More does not come back on load` passed on Chromium against this tree.
