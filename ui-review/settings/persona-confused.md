I opened Settings from the GifOS menu. I have not used this before. I clicked through the sheet, including every Advanced section. I did not press Re-pull, Use latest, or Roll back. On the erase question I pressed Cancel.

1. Save is off the screen, and it does not mean one thing.
What I saw: The window opened on my name (the box was empty), a black color square, "Use a picture…", Reset, text size, and three closed rows: AI models, Third-party APIs, and Payments. Save and Close were not on the screen. Advanced settings was just past the bottom. I clicked the dark area around the window and the window vanished. I typed a name and pressed Close. The name was gone when I came back. I typed it again and pressed Save. Then it stayed. Other changes did not wait for Save. I set the text to 120% and pressed Close. It was still 120% when I reopened Settings. I picked a green background and pressed Close. The color square was still green. I filled in an AI address and pressed Test. That did not keep it. Save did. I filled in a third-party API and pressed the big Save. When I came back, that form was gone.
Why it confuses me: I thought Save meant "keep what I just did" and Close, or clicking the dark area, meant "never mind." Some things stick before I ask. Some things only stick if I can find Save. One thing only sticks if I press a different button, Test & save.
Severity: High
Fix: Keep Save and Close pinned to the bottom so they are always visible. Make the button say what it keeps ("Save name"). On background and text size, say "This changes right away." If I click the dark area with an unsaved name, ask before throwing it away.
Screenshots: confused-02-top.png, confused-19-perf.png

2. The color square does not match the screen, and both resets say only "Reset".
What I saw: The square was nearly black. The screen behind the window is light grey. Nothing next to it says "Color". "Use a picture…" opened a file window. After I picked a picture, Settings looked the same. Nothing said the picture was on. I then picked pink and pressed the Reset beside the picture button. The square stayed pink, so I could not tell if Reset worked. There is a second Reset under Text size. Same word.
Why it confuses me: I don't know what color I have, whether my picture worked, or which Reset undoes which thing.
Severity: Med
Fix: Label the square "Color". When I have not picked one, say "Default" instead of showing black. After a picture is chosen, show its name and a small preview. Name the buttons "Reset background" and "Reset text size". When background is reset, put the square back to Default too.
Screenshots: confused-02-top.png, confused-04-ai.png

3. Bigger text broke the names on the home screen, and Close left it that way.
What I saw: I pressed A+ until it said 150%. The note says this changes icon labels, menus, and this window. The names on the home screen split in the middle. "Welcome.gif" turned into "Welcome." with "gif" on the next line. "Camera.gif" turned into "Camera.gi" and "f". Save was even further down. I pressed Close. The big text stayed. I had to come back and press the text-size Reset, not the other Reset.
Why it confuses me: I was trying to read better. I made the names harder to read. Closing the window, which I thought meant cancel, did not put them back.
Severity: High
Fix: Don't let a larger size split icon names onto two lines. One Reset on this row, labeled "Reset text size". If Close will not undo the size, say "Text size is already changed" next to the buttons.
Screenshot: confused-03-text-big.png

4. AI models is a wall of words, then seven empty forms.
What I saw: A paragraph about OpenAI-compatible endpoints, a Provider app, a Providers folder, the "ai ability", keys, a shared computer backup, and browser/CORS. Then the same blank form seven times: Smartest text LLM, Cheapest text LLM, Text → speech, Speech → text, Text → image, Image → video, Text → video. Each one says "Your own endpoint (URL + key)", asks for a base URL, an API key, and a model, and has a Test button. I pressed Test on all seven. Each one said "Set a base URL first." I don't know what a base URL is or where a key comes from. I typed an address and pressed Test. It said "can't reach (network or CORS blocked)." I don't know what CORS means or what to fix. The eye on the key box has no word on it.
Why it confuses me: If an app told me to set this up, I would not know which row to use, or whether empty boxes mean something is broken.
Severity: High
Fix: Put this behind a line that says "Only if an app asks for AI." Replace the paragraph with "Paste the address and key from your AI provider. Apps here cannot see the key." Drop endpoint, CORS, LLM, and ability. If the boxes are empty, say "You can leave this blank" instead of Test. Name the rows in plain words, like "Best writing model" and "Read text out loud".
Screenshot: confused-05-ai-test.png

5. Third-party APIs is a long warning, then a form the bottom Save ignores.
What I saw: A paragraph of about 150 words. It names Deepgram, a trading API, a WebSocket, a CORS proxy, an honesty note, and a Worker in a repo (cors-proxy/). Then a form: a short name (the example is "deepgram"), a base URL, and a menu of Bearer (Authorization: Bearer …), Token, Basic, Custom header, or Query parameter. I don't know which of those a normal key is. "Custom header" was cut off ("x-api-ke"). Inside the row is another Advanced, not the same as Advanced settings. It asks for a "Custom CORS proxy URL". Test & save with the form empty said "give it a short name", then "add the base URL". I filled the form and pressed the Save at the bottom of Settings. The form was gone when I came back. A trash can with no word on it removed the row at once and did not ask.
Why it confuses me: I thought the big Save button saved this. The real rule, that it only saves if a test works, is buried in the paragraph. The form is written like a programmer's notes.
Severity: High
Fix: Two sentences: "Add a name, the site's address, and the key. Press Test & save. The Save button at the bottom does not save this." Start on Bearer and hide the other choices under "This key is different." Move the proxy talk into that inner Advanced as one line: "Only if the site blocks this browser." Ask before the trash can deletes a key that was saved. Don't say repo or Worker.
Screenshot: confused-09-api-advanced.png

6. I look like I'm on a broken version, and the buttons to change it are blue.
What I saw: Under Advanced, Version starts with "Edge build", "build 0", a RUNNING mark, and a button that says Re-pull. The next row is v0.9.21, marked LATEST, with a blue Use latest button. Then older rows, each with a blue Roll back. There are 11 rows. I opened the Edge notes. They said this is an unreleased build at the site root, it is not archived, and I can't pin one or roll back to a specific one. I don't know what edge, pin, site root, or build 0 means. Build 0 sounds like a mistake. I did not press those buttons. I was afraid they would take me off this page. I opened the notes on one numbered version. They were a list of changes about things I have not used. They did not tell me whether to press Use latest.
Why it confuses me: RUNNING and LATEST are on two different rows, so I think I am on the wrong one. The button that looks like the right fix is the one I am afraid of.
Severity: High
Fix: One line at the top: "You are on the newest try-out build. You don't have to change anything here." Hide Re-pull, Use latest, and Roll back behind "Show other versions", and say what each one will do before it can be pressed ("This loads a different GifOS. Your files stay."). Don't show "build 0" with no plain meaning. Don't open Advanced onto a long list of old changes.
Screenshot: confused-14-version.png

7. Test connection says nothing is set, while the box shows an address.
What I saw: The note says this is the little service that introduces people when I share an invite, and to leave it blank unless I run my own. It says the default is wss://relay.gifos.app. The box shows that same address in grey. I left it as it was and pressed Test connection. It said "Nothing to test — no address is set." I don't know what wss means, what an invite is, or whether sharing is broken.
Why it confuses me: The note, the text in the box, and the test result don't agree. Grey text looks like a value that is already there.
Severity: High
Fix: If blank means "use the normal one", show "Using the normal connection" and let Test check that address. Don't put a grey address in an empty box. Say "This is how a shared invite finds people. Most people should leave it alone."
Screenshot: confused-21-erase.png

8. Erase looks like the other blue buttons, and the two warnings don't match.
What I saw: At the bottom of Advanced, a red heading, "Erase this computer". The note says it wipes the whole computer stored in this browser, then reinstalls a fresh one on the same version channel I am already using (edge, the live release, or a pinned snapshot). The button under that note is blue, the same blue as Save, Test connection, and Repaint & measure. It says "Erase this computer…". I pressed it. Settings disappeared. A new box asked "Erase this entire computer?" Its note says it reinstalls a fresh computer on the latest version from gifos.app. That is not what the page before said. The big blue button is "Back up first, then erase". The red one is "Erase without backup". Cancel is the pale button. I pressed Cancel. I landed on the home screen, not back in Settings. For a second I thought the erase had already started.
Why it confuses me: "Entire computer" sounds like my real computer, not this website. The button my eye goes to is the blue one, and it still leads to erasing. The two screens disagree about which version I would end up on.
Severity: High
Fix: Make this button red, and name it "Erase GifOS data in this browser…". Use the same sentence both times: what is deleted, and that I stay on the version I have now. Don't make "Back up first, then erase" the big blue button. After Cancel, put me back in Settings. Say "This does not touch the rest of your computer."
Screenshots: confused-21-erase.png, confused-22-erase-confirm.png

9. "Not yet protected" sounds like I am in danger, then the button gives up.
What I saw: "Your desktop lives entirely in this browser. Using 17.2 MB of about 6.5 GB. Not yet protected. GifOS asks automatically; browsers grant it once a site is used a bit. You can also keep a backup GIF." I pressed "Protect this Home Screen now". The button turned into "The browser declined for now — it grants this once the site is used more" and would not press again. I still don't know what I was being protected from.
Why it confuses me: "Not yet protected" sounds like a security problem. The failure doesn't say whether my stuff is safe.
Severity: Med
Fix: Say "This browser can clear a site it rarely opens, to free disk space. This one is not marked 'keep' yet." If the browser says no, leave a button I can try later, and add "Nothing was lost." Don't use the word Protect.
Screenshot: confused-14-version.png

10. Performance looks like a score I failed.
What I saw: "How the last repaint of your Home Screen went. Reused icons are reused as-is (fast); rebuilt ones changed. Mostly useful for spotting a slow, oversized desktop." The line said "14 icons in view · 11 reused, 3 rebuilt · cache holds 0 files, 13 images." I pressed Repaint & measure. It changed to "14 reused, 0 rebuilt". Nothing said if that was better. "0 files" sounds like my files are missing. The button is the same blue as Save.
Why it confuses me: I think I am supposed to do something about these numbers. I don't know what repaint, reused, rebuilt, or cache means.
Severity: Med
Fix: Take this out of Settings, or title it "Only if the screen feels slow" and say "These numbers are not a score. Your files are not missing." Don't use the same blue as Save.
Screenshot: confused-19-perf.png

11. Payments spends a long note to say nothing was charged.
What I saw: A paragraph about what apps have charged, a verified author, my card and wallet, sharing an app's GIF, payments being final, "forgetting" a purchase, and a ceiling. Under that: "No app has charged anything yet." I don't know what a ceiling is. I had not paid anyone.
Why it confuses me: I got worried that apps can take money before I have done anything. The useful sentence is the last one.
Severity: Med
Fix: Lead with "No app has charged anything yet." Hide the rest until there is a charge. When there is one, say "the most one charge may be" instead of "ceiling".
Screenshot: confused-14-version.png

What I expected instead: A short page with my name, the background, and text size. One Save that keeps those, and one Close that puts them back. Keys, versions, the connection, speed numbers, and erasing would sit in a separate place that says I can skip it, with buttons that do not look like Save. Erase would say it only clears this website's data in this browser, in one question, with Cancel easy to see.
