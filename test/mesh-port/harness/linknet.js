'use strict';
// linknet.js: installs the link physics (link.js), time (time.js) and net (net.js) units into a fabric.
//   const fab = createFabric(...); const ln = require('./linknet.js').install(fab);
//   ln.lever(['link', '3', '4', 'half'])   // the sim's lever words (state change only)
// Order: link first (time and net read fab.link).
const link = require('./link.js'), time = require('./time.js'), net = require('./net.js');
function install(fab) {
  const l = link.install(fab); const t = time.install(fab); const n = net.install(fab);
  const lever = (tk) => {
    const op = tk[0];
    if (op === 'link') l.linkLever(tk); else if (op === 'radio') l.radioLever(tk);
    else if (['freeze', 'tickslow', 'hide', 'reloadnew', 'resume', 'doordark', 'verdicts'].includes(op)) t.lever(tk);
    else if (['netgroups', 'island', 'netjoin', 'netmove', 'netcut', 'netlift'].includes(op)) n.lever(tk);
    else throw new Error('linknet: no lever ' + op);
  };
  return { link: l, time: t, net: n, lever };
}
module.exports = { install };
