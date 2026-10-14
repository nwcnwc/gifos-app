# GifOS Home Screen Settings — redesign proposal

Design only. Nothing here is wired into the app. The live sheet was reviewed from this worktree at `http://127.0.0.1:8931/` (edge checkout of `ui-redesign-settings`). Playwright walked every Settings control and every Advanced section, including Performance, at 1280×800 and 412×915. Erase was opened and cancelled. Version switches were not clicked. Phone hardware was skipped.

Four walks, one browser each: a first-time reader, a phone thumb, a keyboard pass, and a polish pass. Shots are in `before/`. Proposed screens are static files in `mockups/` and PNGs in `after/`.

The GifOS menu item **Settings…** is clear (`before/desk-02-menu.png`). Enter on the GifOS button opens that menu and leaves focus on the button, so Settings… is not the next Tab stop (`before/a11y-02-menu.png`, `persona-a11y.md`). The trouble starts when the sheet opens.

Help text on the white sheet is `#6e6e73` on white, measured at **5.07:1**. Closed disclosure summaries are the same pair, also **5.07:1**. That passes WCAG AA for normal text. Leave that gray as it is. The LATEST pill is the exception: white on green, 10.56px, **3.57:1** (`persona-a11y.md`).

“Build 0” on the Edge row is the committed dev stamp in `js/build.js`. A deployed edge build gets a real number. The version-list problem below does not depend on that zero.

## Top 10

1. **Erase looks like Save.** “Erase this computer…” is a full-width blue bar, and Save under it is the same blue bar (`before/desk-27-erase-open.png`).
2. **Every old version has a blue Roll back button.** The sheet becomes a changelog with a destructive action on each row (`before/desk-17-version.png`, `before/mob-17-version.png`).
3. **Advanced is below the fold, and it looks like the other closed rows.** On a 800px-tall window the first screen ends around Payments. Advanced, Save, and Close are clipped (`before/desk-03-settings-top.png`). AI, Third-party APIs, Payments, and Advanced are the same 29px disclosure with no status.
4. **Save does not save the page.** Background and text size apply as you edit. Your name, AI, and the connection address wait for Save. An account is saved only by Test & save. Payments save as you type the ceiling.
5. **On a phone the sheet floats, and the dim margin closes it.** The card is 379×787 inside 412×915, with about 64px of dim area above and below and 16px on each side (`before/mob-03-settings-top.png`). A tap at (8, 457) hits that dim area and the sheet is gone.
6. **The things you tap are about 30 pixels tall.** Section headers are 29px. A− and A+ are 42×32. Use a picture and Reset are 31px tall. The show-password control is 22px. The version caret is about 18×17. Roll back is 32px tall. The account trash control is 25×21 (`before/desk-audit.json`, `before/mob-audit.json`, `fat-measures.json`).
7. **Adding an account is a lecture and a crushed row.** The help is a paragraph about CORS, proxies, WebSockets, and a file in the repo (`before/desk-10-api-open.png`). On the phone the name, Test & save, and the trash icon share one line, and the name is cut off (`before/mob-11-api-add-row.png`). The name field measured 153×31.
8. **Test connection says nothing is set when the field is blank on purpose.** The help says leave it blank to keep `wss://relay.gifos.app`. The placeholder shows that address. Test says “Nothing to test — no address is set” (`before/desk-27-erase-open.png`, the connection block above Performance). The Home Screen does not load `js/relay-config.js`, so the test’s fallback never sees the default the apps actually use.
9. **The erase warning and the erase confirmation disagree.** The section says you stay on the same version channel (`before/desk-27-erase-open.png`). The confirmation says GifOS reinstalls the latest version from gifos.app (`before/desk-28-erase-confirm.png`). The code keeps the channel (`eraseReloadUrl` in `js/desktop.js`).
10. **The Performance block should go.** It is a repaint counter (“14 icons in view · 11 reused…”) and a blue **Repaint & measure** button (`before/desk-23-performance.png`). That is a developer check, not a setting. Remove the whole section.

## Findings

### 1. Erase is the same blue as Save

- **Severity:** High
- **Where:** `before/desk-27-erase-open.png`, `before/mob-27-erase-open.png`, `before/desk-28-erase-confirm.png`, `before/polish-desk-24-erase-open.png`, `before/polish-desk-26b-erase-dialog.png`
- **What:** Inside Advanced, the erase button uses `widebtn`. `.modal.wide .widebtn` paints the accent fill and beats `.widebtn.danger`, so the danger class never wins the color. The button sits directly above Save. Both are full-width blue. On the phone they are 326×35 and 326×33, with 39px between them (`before/fat-13-erase-zone.png`). Pressing erase removes the Settings sheet first (`bg.remove()` before the confirm). The confirm then stacks three 335×33 buttons, 8px apart: blue “Back up first, then erase”, red “Erase without backup”, then Cancel (`before/fat-16-erase-confirm.png`). Cancel returns to the Home Screen, not to Settings (`before/confused-22-erase-confirm.png`).
- **Fix:** A red text row at the bottom of System, on its own card, opening its own screen. The filled red button appears only on that screen, under “Back up first”. One sentence, and it matches the code: this wipes the computer in this browser, there is no undo, and you stay on the version you are using.

### 2. Version is a stack of Roll back buttons

- **Severity:** High
- **Where:** `before/desk-17-version.png`, `before/mob-17-version.png`, `before/desk-18-version-edge-notes.png`, `before/desk-20-version-more-0.png`, `before/polish-phone-12-version.png`
- **What:** Edge, the latest release, and every older release are open in the same scrolling sheet. Each older row carries a filled blue **Roll back**, the same fill as Use latest. Those buttons sit inside the disclosure summary, so the edge row’s accessible name is “Edge build build 0 RUNNING Re-pull” (`before/a11y-12-version-edge.png`). On the phone those buttons are 98×32 and the disclosure caret is about 18×17 (`fat-measures.json`). With Advanced open, the phone sheet’s scroll height reached 5313px. At 412px the row wraps: the pill drops under the build line while the blue button stays full size (`before/polish-phone-12-version.png`). A mouse click on the button is stopped from toggling the row; the thumb still has a blue button on every historical release. The Edge label reads “Edge build” plus the local stamp; hide the stamp. The LATEST pill is white on green at **3.57:1**.
- **Fix:** Rename the section **Updates**. Show the running build and the latest release. Put older releases behind one row, “Earlier versions”. **Switch** and **Re-pull** are text actions. **Roll back** is red text, on the older-version list only, not inside the disclosure summary.

### 3. The first screen hides Advanced, and the closed rows are twins

- **Severity:** High
- **Where:** `before/desk-03-settings-top.png`, `before/mob-03-settings-top.png`, `before/polish-desk-04-disclosures-and-save.png`, `before/polish-desk-16-advanced-storage.png`
- **What:** At 1280×800 the sheet is 560×688 and the collapsed content is 877px tall. Payments is the last row in view. Advanced settings, Save, and Close are below it (first-time walk: Advanced’s top was 772, Save was not in view). The sheet uses three groupings at once: Your name, Background, and Text size are always-open headings; AI models, Third-party APIs, Payments, and Advanced settings are the same muted 29px disclosure, with no “not set up” or “3.9 MB” until you open them; inside Advanced the blocks switch back to always-open headings, and an account row nests a third Advanced for one proxy field (`before/polish-desk-12-api-row-advanced.png`). A first visit cannot tell which row is everyday and which row can erase the computer. The same blue fill is also on Test, Add, Protect, Roll back, and Repaint & measure, so Save is not the one primary (`before/polish-desk-06-ai-open.png`, `before/polish-desk-11-api-add-row.png`).
- **Fix:** Replace the disclosures with grouped rows, 56px, each with a title and one status line. Groups: You, Look, For apps, This computer. **Advanced settings** becomes **System**. **Third-party APIs** becomes **Connected accounts**.

### 4. Save is only a partial save

- **Severity:** High
- **Where:** `before/desk-10-api-open.png`, `before/desk-05-text-bigger.png`, `before/desk-29-footer-save-close.png`
- **What:** Text size updates the whole interface the moment you tap A+ (shot at the larger size, then reset). Background color applies on input. Your name, the AI fields, and the connection address apply when you press Save. An API row applies only when Test & save succeeds. A payment ceiling applies on change. The footer still offers one blue Save, and on the first screen that button is not even in view.
- **Fix:** Each screen applies as you go, or says the one thing that saves it (“Test and save” on an account). The root header is **Done**, which closes. There is no second meaning of Save. Text size is the sharp case: A+ changes icon labels on the Home Screen immediately, and Close does not put them back. Reset has to be an obvious control on that screen, not a 32px neighbor of A+.

### 5. The phone sheet is a floating card with a dismiss margin

- **Severity:** High
- **Where:** `before/mob-03-settings-top.png`, `before/mob-30-sheet-in-viewport.png`, `before/fat-02-sheet-top.png`
- **What:** At 412×915 the card starts 64px down, is 379px wide, and leaves a dim band on every side. That band is the click-away closer. A tap in the left band closed the sheet. There is no sticky title while you scroll, so after the version list you cannot see “Settings” or a close control until you scroll back. Save is at the bottom of that scroll.
- **Fix:** On a narrow window, Settings is the screen: full width, full height, a sticky bar with Back and Done. The dim margin goes away, so a missed tap does not throw the work out.

### 6. Tap targets are under a thumb

- **Severity:** High
- **Where:** `before/desk-04-name-background-text.png`, `before/mob-04-name-background-text.png`, `before/mob-06-ai-open.png`, `before/desk-audit.json`, `fat-measures.json`
- **What:** Measured on the phone, collapsed sheet: name field 42px tall, color chip 51×35, Use a picture 118×31, background Reset 62×31, A− and A+ 42×32. Section summaries are 29px in the desktop audit. Show password is 22px. Account delete is 25×21. Test is 32px tall. None of these meet a 44px minimum, and several miss it on both axes.
- **Fix:** Rows and fields at least 48px tall. Stepper buttons at least 48×48, with accessible names “Smaller text” and “Bigger text” (today the accessible name is the glyph “A−”; the title “Smaller” is not the name). The password control and the row delete get the same 48px hit area. The two buttons that both say Reset need different names: “Reset background” and “Reset text size” (`before/confused-02-top.png`). At 150% text, icon names wrap mid-word (`before/confused-03-text-big.png`), so the type scale has to keep a label on one line.

### 7. Connected accounts open as a developer note

- **Severity:** High
- **Where:** `before/desk-10-api-open.png`, `before/mob-11-api-add-row.png`, `before/desk-12-api-row-advanced.png`, `before/desk-13-api-custom-header.png`, `before/desk-14-api-test-empty.png`
- **What:** The closed row is labeled “Third-party APIs”. Open, the first thing is a long explanation of direct calls, Deepgram’s WebSocket, a CORS proxy, and `cors-proxy/` in the repo. Add a row and the name field, Test & save, and the trash icon sit on one line. Auth choices are strings like “Bearer (Authorization: Bearer …)”. A nested Advanced holds an optional proxy URL. Test & save with an empty row says to give it a short name, which is fine, but it is the only way the row is stored, and nothing on the row says that until you are in the paragraph.
- **Fix:** Rename to **Connected accounts**. One short paragraph: a name, an address, and a key; the key goes only to that service; it is kept after a test succeeds. Fields stacked, each with a label. Auth choices in plain words (Bearer token, Token header, Basic, Custom header, Query parameter). The proxy is not on this page. Deleting a saved account asks first. The trash control removed the row immediately (`before/confused-09-api-advanced.png`).

### 8. AI is seven forms and a jargon paragraph

- **Severity:** Med
- **Where:** `before/desk-06-ai-open.png`, `before/mob-06-ai-open.png`, `before/desk-07-ai-lower.png`, `before/desk-08-ai-test-empty.png`
- **What:** Opening AI models replaces the sheet with a paragraph about OpenAI-compatible endpoints, Provider apps, the “ai” ability, CORS, and backups, then seven cards (Smartest text LLM, Cheapest text LLM, Text → speech, Speech → text, Text → image, Image → video, Text → video). Each card is a source menu, a URL, a key, a model, and a blue Test. The seven key fields are all named “API key”, and each source combobox has an empty name, so forms mode cannot tell the rows apart (`persona-a11y.md`). Test with an empty URL says “Set a base URL first.” The key and the model sit side by side, so on the phone both are clipped (“gpt-4o-m”, “api.openai.co”).
- **Fix:** The AI screen is a list: “Smartest text — Not set up”. Opening one ability shows a source choice and three stacked fields, then Test. The paragraph becomes two sentences: apps use what you pick here, and a key stays in this browser.

### 9. Test connection rejects the blank default

- **Severity:** Med
- **Where:** `before/desk-21-connection.png`, `before/desk-22-connection-result.png`, `before/mob-21-connection.png`
- **What:** The copy says leave the field blank unless you run your own, and names `wss://relay.gifos.app` as the default. The empty field’s placeholder is that same address, so it looks filled in. Test connection writes “Nothing to test — no address is set.” `index.html` never loads `js/relay-config.js`, and the test uses `field || window.GIFOS_RELAY`. On the Home Screen that global is unset, so a blank field — the normal case — fails the test. Apps opened from `run.html` do load the default.
- **Fix:** Rename to **Invite connection**. Show a row “Standard GifOS connection” with the address. A second field is “Your own connection”, blank meaning standard. Test checks the standard address when the field is blank.

### 10. Erase copy does not match erase

- **Severity:** Med
- **Where:** `before/desk-27-erase-open.png`, `before/desk-28-erase-confirm.png`, `before/confused-22-erase-confirm.png`
- **What:** The disclosure says the fresh computer comes back on the same version channel (edge, the live release, or a pinned snapshot). The confirm dialog says it reinstalls the latest version from gifos.app. `eraseComputer` keeps the pin and the edge flag and reloads that channel. Someone about to wipe the computer is told the wrong outcome.
- **Fix:** Use the disclosure’s sentence in both places. Drop “latest version from gifos.app” from the confirm.

### 11. The sheet is not a dialog to the keyboard

- **Severity:** Med
- **Where:** `before/desk-03-settings-top.png`, `before/a11y-03-settings-top.png`, `before/a11y-16-password-eye.png`. Checked with a keyboard script against the same server.
- **What:** The sheet has no `role="dialog"` and no accessible name. Opening it leaves focus on the page; the first Tab lands in the name field. Escape does not close it. After Close, the next Tab leaves the sheet, so focus is not trapped and the page behind stays operable. None of the inputs has a `<label>`. The name field’s only name is its placeholder. The color input’s name is its title (“Background color”), with no visible text on the swatch. The connection field’s accessible name is the placeholder address `wss://relay.gifos.app`. The text-size percent changes from 100% to 110% with no live region. Test, Test & save, Test connection, and Repaint & measure write their result into ordinary text. Eight eye buttons are all named “Show password”, with no row in the name (`before/a11y-16-password-eye.png`). The erase confirm is also unlabeled. Its first Tab stop is “Back up first, then erase” and its second is “Erase without backup”; Escape leaves it open; Cancel returns to the Home Screen (`before/a11y-20-erase-confirm.png`, `before/a11y-21-after-cancel.png`). Writeup: `persona-a11y.md`.
- **Fix:** `role="dialog"` `aria-modal="true"` and a name of Settings. Move focus to the first field. Trap Tab. Escape closes, same as Close, and the page behind is inert. A visible `<label>` on the name, the color, the connection field, and every AI and account field, with the row in the name (“API key for Smartest text LLM”). Name the source and auth menus. `aria-live="polite"` on the percent and on test results. Stepper buttons named “Smaller text” and “Bigger text”. Eye buttons named for that row. The erase confirm is an `alertdialog`, focus starts on Cancel, and Cancel returns to the erase row.

### 12. Payments is a legal paragraph behind a twin row

- **Severity:** Med
- **Where:** `before/desk-15-payments.png`, `before/mob-15-payments.png`, `before/confused-11-payments.png`
- **What:** Empty, the section leads with a paragraph about approval screens, cards, wallets, sharing a GIF, and forgetting a purchase. The only sentence a first visit needs is the last one: nothing has been charged. The row looks identical to AI and to Advanced.
- **Fix:** The row and the page lead with “Nothing charged on this computer”. The rules wait until there is a charge. Say “the most one charge may be” instead of “ceiling”. When there are charges, each app is a card with its total and that limit, as today.

### 13. Performance (the repaint test) is obsolete here

- **Severity:** Med
- **Where:** `before/desk-23-performance.png`, `before/desk-24-performance-measured.png`, `before/mob-23-performance.png`, `before/fat-11-performance.png`, `before/polish-desk-23-performance-measured.png`, `before/polish-phone-16-performance-measured.png`
- **What:** Advanced → Performance explains reused icons versus rebuilt ones, then a line of icon and cache counts in the same 14.4px gray system face as the help text, then **Repaint & measure**, another full-width blue button. The only monospace rule in the sheet is `.modal.wide textarea.mono` in `css/desktop.css`; this paragraph is `<p class="add-help mono">`, so the `mono` class does nothing here. Pressing the button repaints the Home Screen and rewrites the line (“14 icons in view · 14 reused, 0 rebuilt · cache holds 0 files, 13 images.”). “0 files” reads like missing files. Useful while tuning the desktop renderer. Not useful to someone setting their name, their text size, or their version. It sits between the connection test and Erase, so it is in the path to the dangerous control.
- **Fix:** Remove the section. Do not relocate it into System. If a developer still wants the counter, it belongs in a dev tool, not in this menu.

### 14. Storage is the one Advanced block that is already in plain words

- **Severity:** Low
- **Where:** `before/desk-16-advanced-storage.png`, `before/desk-25-protect-result.png`
- **What:** “Your desktop lives entirely in this browser. Using 3.9 MB of about 6.4 GB.” Plus how protection works, and a backup pointer. Keep this. “Not yet protected” reads like a security warning. In this browser the Protect button then changed to “The browser declined for now” and disabled itself (`before/confused-13-protect.png`). The Protect button should be the primary button on the Storage screen, and a decline should say nothing was lost and stay pressable.

## Proposed information architecture

Same contents, fewer places, one dangerous door.

**Settings** (the root)

| Group | Row | Was | Status line |
| --- | --- | --- | --- |
| You | Your name | Your name | The current name |
| Look | Background and text | Background, plus Text size | “Color, picture, and text size” |
| For apps | AI | AI models | “Not set up”, or how many abilities are set |
| For apps | Connected accounts | Third-party APIs | “None”, or the count |
| For apps | Payments | Payments | “Nothing charged on this computer” |
| This computer | System | Advanced settings | “Storage, updates, invite connection” |

**System**

| Row | Was | Notes |
| --- | --- | --- |
| Storage | Storage | Keep the usage line and Protect |
| Updates | Version | Running build, latest release, earlier versions folded |
| Invite connection | Connection service | Blank means the standard connection, and Test checks that |
| Erase this computer | Erase this computer, nested again | Own screen. Red row. Not a blue button |

**Remove**

- Performance, including Repaint & measure.

**Move**

- Background and Text size join one screen, Look. They already apply live and they are the same kind of choice.
- The account proxy leaves the first account screen.
- AI’s seven forms leave the root. The root only says whether AI is set up.

**Rename**

- Advanced settings → System
- Third-party APIs → Connected accounts
- Version → Updates
- Connection service → Invite connection
- AI models → AI

**Keep the behavior**

- Name still stays on this computer.
- Keys still stay in this browser and out of a shared backup.
- An account still saves only after a successful test.
- Erase still keeps the version channel, still offers a backup first, and still has no undo.
- Updates still do nothing until the person chooses. Roll back still exists. It stops looking like the main button.

## Direction A — stacked pages

Recommended. One column. Phone is the whole screen. Desktop is the same column in a sheet over the Home Screen, so the two sizes do not invent two products.

Root is groups of rows. A row opens the next page. Back returns. Done on the root closes. System is a second list: Storage, Updates, Invite connection, then a gap, then Erase in red. Updates shows Edge and v0.9.21, and “10 older releases” behind one row. Erase is its own page: the true warning, Back up first, then a red Erase without backup.

Files: `mockups/direction-a.html`, `mockups/settings.css`.

Shots: `after/a-desk-root.png`, `after/a-desk-look.png`, `after/a-desk-ai.png`, `after/a-desk-system.png`, `after/a-desk-updates.png`, `after/a-desk-erase.png`, `after/a-mob-root.png`, `after/a-mob-look.png`, `after/a-mob-ai.png`, `after/a-mob-accounts.png`, `after/a-mob-system.png`, `after/a-mob-erase.png`.

## Direction B — two panes

Same map, for a wide window. A list on the left, the chosen page on the right, so editing a name does not lose the list. Erase is not in that list. It is the last row on System, red, and it opens the same erase page as direction A. Under 700px wide, B becomes a full-screen list and then a full-screen page, with Back.

Files: `mockups/direction-b.html`.

Shots: `after/b-desk-you.png`, `after/b-desk-system.png`, `after/b-desk-ai.png`, `after/b-desk-erase.png`, `after/b-mob-root.png`, `after/b-mob-system.png`, `after/b-mob-erase.png`.

Use A if only one ships. Use B’s split only at desktop widths. Both remove Performance. Both use the Aurora tokens already on the Home Screen (`#e8ecf1`, white cards, `#0071e3`, danger `#c41e3a`). Rows are 56px. One filled blue button per screen. Danger is red and alone. The polish walk asked for a dark sheet so the controls would match the window chrome, and for one type family (the live buttons are Arial 13px beside system type at 15–16px). This proposal stays on the light Home Screen surface and spends the color on one blue fill per screen. Buttons in the mockups use the system face.

## Before / after

| Before | After | Change |
| --- | --- | --- |
| `before/desk-03-settings-top.png` | `after/a-desk-root.png` | Groups, status lines, System instead of a buried Advanced |
| `before/mob-03-settings-top.png` | `after/a-mob-root.png` | Full-screen sheet, sticky Done, 56px rows |
| `before/desk-06-ai-open.png` | `after/a-desk-ai.png` | Seven forms become a list of abilities |
| `before/mob-11-api-add-row.png` | `after/a-mob-accounts.png` | Stacked labeled fields, short copy |
| `before/desk-17-version.png` | `after/a-desk-updates.png` | Running and latest only; earlier versions folded; text actions |
| `before/desk-23-performance.png` | `after/a-desk-system.png` | Performance removed; System is three rows plus Erase |
| `before/desk-27-erase-open.png` | `after/a-desk-erase.png` | Blue erase bar becomes its own screen; warning matches the channel |
| `before/mob-28-erase-confirm.png` | `after/a-mob-erase.png` | Same erase screen on the phone |
| `before/desk-03-settings-top.png` | `after/b-desk-you.png` | Wide window keeps the section list beside the page |
| `before/mob-03-settings-top.png` | `after/b-mob-root.png` | Same list, full screen, Erase not on the root |

## How the shots were taken

- Server: `python3 -m http.server 8931` on this worktree, `127.0.0.1` only.
- Browser: Playwright Chromium, service workers blocked, one browser at a time, `nice -n 10`.
- Viewports: 1280×800 (`before/desk-*.png`) and 412×915 (`before/mob-*.png`).
- Extra walks: `before/confused-*.png`, `before/fat-*.png`, `before/a11y-*.png`, `before/polish-*.png`, plus `fat-measures.json`. Writeups: `persona-confused.md`, `persona-fatfinger.md`, `persona-polish.md`, `persona-a11y.md`.
- The GifOS menu row that opens Settings is 172×29 on the phone (`before/fat-01-menu.png`). The label is clear. The row is short.
- Opened and cancelled: Erase. Not clicked: Load edge, Use latest, Roll back, Re-pull, Update.
- Mockups rendered by Playwright from `mockups/direction-a.html` and `mockups/direction-b.html` into `after/`.
