// capabilities.multiplayer defaults on. JSON false is the only opt-out.
// The function under test is lifted from js/runtime.js so it cannot drift.
// The page gates are source checks: a solo Invite, the mesh lane, and the
// guest watch path that returns before bootClientBus.
//
//   node test/unit/multiplayer-optout.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const rootDir = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail !== undefined ? ' — ' + detail : '')); }
}

function fnBody(src, head) {
  const at = src.indexOf(head);
  if (at < 0) return '';
  const open = src.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); if (i < 0) return ''; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2) + 1; if (i <= 0) return ''; continue; }
    if (c === '"' || c === "'" || c === '`') {
      for (i++; i < src.length && src[i] !== c; i++) if (src[i] === '\\') i++;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return src.slice(at, i + 1);
  }
  return '';
}

const runtime = fs.readFileSync(path.join(rootDir, 'js', 'runtime.js'), 'utf8');
const runHtml = fs.readFileSync(path.join(rootDir, 'run.html'), 'utf8');
const llms = fs.readFileSync(path.join(rootDir, 'llms.txt'), 'utf8');
const about = fs.readFileSync(path.join(rootDir, 'about.html'), 'utf8');
const desktop = fs.readFileSync(path.join(rootDir, 'js', 'desktop.js'), 'utf8');
const samples = fs.readFileSync(path.join(rootDir, 'js', 'sample-apps.js'), 'utf8');

const fnSrc = fnBody(runtime, 'function multiplayerOn(manifest)');
check('multiplayerOn is in the runtime', fnSrc.indexOf('return caps.multiplayer !== false') > 0, fnSrc.slice(0, 80));
const multiplayerOn = vm.runInNewContext(fnSrc + '\nmultiplayerOn');

check('null stays on', multiplayerOn(null) === true);
check('empty manifest stays on', multiplayerOn({}) === true);
check('empty capabilities stay on', multiplayerOn({ capabilities: {} }) === true);
check('true stays on', multiplayerOn({ capabilities: { multiplayer: true } }) === true);
check('zero stays on', multiplayerOn({ capabilities: { multiplayer: 0 } }) === true);
check('the string false stays on', multiplayerOn({ capabilities: { multiplayer: 'false' } }) === true);
check('JSON false opts out', multiplayerOn({ capabilities: { multiplayer: false } }) === false);
check('JSON false opts out beside other caps', multiplayerOn({ capabilities: { db: true, multiplayer: false } }) === false);
check('the runtime exports multiplayerOn', runtime.indexOf('multiplayerOn, SYSTEM_HEADER') > 0);

const hosted = runtime.slice(runtime.indexOf('const share = multiplayerOn(manifest)'));
check('becomeHost asks multiplayerOn', hosted.indexOf('const share = multiplayerOn(manifest)') === 0);
check('the mesh lane is handed out only when sharing', hosted.indexOf('if (share) hosted.attachStageBus = attachStageBus') > 0);
check('the old always-on lane return is gone', runtime.indexOf('attachStageBus: attachStageBus') < 0);
check('a view-only app offers no lead switch', hosted.indexOf('leadCount: share ? leadTargets.length : 0') > 0);

const invite = fnBody(runHtml, 'function inviteFromSolo()');
check('a solo invite refuses until sharing is on', invite.indexOf('soloShare !== true') > 0 && invite.indexOf('soloShare !== true') < invite.indexOf('getFile'));
const paint = fnBody(runHtml, 'function paintInviteSlot()');
check('a solo header shows Invite only when sharing is on', paint.indexOf('show = soloShare === true') > 0);
check('a v1 solo app learns the flag from the manifest hook', runHtml.indexOf('if (ROOM.solo && soloShare === null) applySoloShare(manifest)') > 0);

const mount = fnBody(runHtml, 'function mountClientApp(app)');
const watchAt = mount.indexOf("appMode = 'watch'");
const busAt = mount.indexOf('bootClientBus');
check('a guest watch return is before the client bus', watchAt > 0 && busAt > watchAt);
check('watch mode does not open the app pane first', mount.indexOf('showAppPane') > watchAt);
const reconcile = fnBody(runHtml, 'function reconcileApp()');
check('a gone watch mark does not clear a client pane', reconcile.indexOf("appMode === 'watch'") > 0);

check('the author guide documents the opt-out', llms.indexOf('capabilities.multiplayer') > 0 && llms.indexOf('Set false to opt out') > 0);
check('about no longer says Invite is in any app', about.indexOf('Invite</b> in any app') < 0 && about.indexOf('multiplayer": false') > 0);
check('the builder prompt documents the opt-out', desktop.indexOf('2c. MULTIPLAYER OPT-OUT') > 0 && desktop.indexOf('"multiplayer": True') > 0);
check('the welcome card no longer says open any app and press Invite', samples.indexOf('Open any app and press') < 0 && samples.indexOf('An app can turn that off') > 0);
check('the meeting sheet tells the truth about an opt-out', runHtml.indexOf('An app that turns multiplayer off still opens on the host') > 0);

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
