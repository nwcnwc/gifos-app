# hdr-invite proof (2026-10-18)

Server: `http://127.0.0.1:8960` (python3 -m http.server)

## Desktop (Chromium)

`BASE_URL=http://127.0.0.1:8960 npx playwright test -c test/desktop/playwright.config.js \
  test/desktop/invite-slot.spec.js test/desktop/alone-invite.spec.js \
  test/desktop/os-header.spec.js test/desktop/shortcuts.spec.js \
  test/desktop/more-groups.spec.js test/desktop/pw-inv-locale.spec.js \
  --project=chromium`

See `desktop-chromium.log` (29/30 passed; one os-header help flake passed on isolated rerun).

## Mobile

`MEET_BASE=http://127.0.0.1:8960 NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/header-invite.js`

See `mobile-header-invite.log` — PASS header invite.
