'use strict';
// pclaws-mutants.js: planted faults for the mutation check. PCLAWS_MUTANT=<name> node pclaws-check.js ... compiles js/mesh/pclaws.js
// with one source edit (the file on disk is never changed); the check must go red on every one.
const fs = require('fs'), path = require('path'), Module = require('module');
const M = path.join(__dirname, '..', '..', '..', 'js', 'mesh');
const MUTANTS = {
  // L16.3: a knock takes a slot outside the reserve: one more knock is let in
  'knock-cap-off-by-one': ['S.DOORK[to] >= pcBudget(to, E.PB_KNOCKS)', 'S.DOORK[to] > pcBudget(to, E.PB_KNOCKS)'],
  // L16: the cool-down doubles per door a limit closed; here it never doubles
  'cool-never-doubles': ['K.L16_COOL * (1 << Math.min(c[1] - 1, 4))', 'K.L16_COOL * (1 << 0)'],
  // L14.1: the offer is declined when the pcs held are past the budget; here it is never declined for the budget
  'uptake-never-declines': ['if (linkHeld(x) > pcBudget(x, E.PB_CLASS))', 'if (linkHeld(x) > pcBudget(x, E.PB_CLASS) + 100000)'],
  // L17: a lost peer may be dialled again once its hold ends; here one tick late
  'dialheld-late': ['return T() >= g;', 'return T() > g;'],
  // L22.2: the far end's standing ask is used up when I answer it with the close; here it stays and answers again
  'l222-ask-not-spent': ['L.farAsk[d] = -1000000; L.nnAsk[d] = T(); close2.push', 'L.nnAsk[d] = T(); close2.push'],
};
function install(name) {
  const mu = MUTANTS[name]; if (!mu) throw new Error('unknown mutant ' + name + ' (' + Object.keys(MUTANTS).join(', ') + ')');
  const fn = path.join(M, 'pclaws.js'); const src = fs.readFileSync(fn, 'utf8');
  if (!src.includes(mu[0])) throw new Error('mutant ' + name + ': the text to change is not in pclaws.js');
  const m = new Module(fn, module); m.filename = fn; m.paths = Module._nodeModulePaths(M);
  m._compile(src.replace(mu[0], mu[1]), fn); m.loaded = true; require.cache[fn] = m;
}
module.exports = { MUTANTS, install };
