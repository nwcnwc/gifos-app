'use strict';
// doTick order with stub seats: spawn+join, then the bus (recv then wake), then tick() over the swapped active set.
const assert = require('assert');
const { createFabric } = require('./fabric.js');
const fab = createFabric({});
const log = [];
fab.lv.SEED0 = 7; fab.JOINMODE = 'burst';
fab.initSim(3, 0);
for (let t = 0; t < 1; t++) { /* burst: all spawn at tick 0 */ }
const { Seat } = require('../../../js/mesh/seat.js');
Seat.prototype.join = function () { log.push('join' + this.id); fab.f.wake(this.id); };
Seat.prototype.tick = function () { log.push('tick' + this.id); };
Seat.prototype.recv = function (m) { log.push('recv' + this.id + ':' + m.t); fab.f.wake(this.id); };
fab.doTick();   // tick 0: spawn 0,1,2 (join wakes them), no bus, then active := {0,1,2}
assert.deepStrictEqual(log, ['join0', 'join1', 'join2', 'tick0', 'tick1', 'tick2']);
log.length = 0; fab.w.TICK = 1;
const m = require('../../../js/mesh/msg.js').newMsg('GREETERS'); m.to = 2; m.from = -1; fab.busPush(1, m);
const m2 = require('../../../js/mesh/msg.js').newMsg('GREETERS'); m2.to = 0; m2.from = -1; fab.busPush(1, m2);
fab.doTick();   // delivery in push order wakes 2 then 0; ticks run in wake order
assert.deepStrictEqual(log, ['recv2:GREETERS', 'recv0:GREETERS', 'tick2', 'tick0']);
assert.strictEqual(fab.bus.size, 0);
log.length = 0; fab.w.TICK = 2; fab.fabricKill(2, 5); fab.doTick();   // a killed seat is not ticked, a woken-by-nobody seat is not either
assert.deepStrictEqual(log, []);
console.log('fabric-tick PASS');
