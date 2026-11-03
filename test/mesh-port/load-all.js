// Requires every js/mesh file together; a duplicate Seat.unit / Seat.free name throws.
'use strict';
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', '..', 'js', 'mesh');
const seat = require(path.join(dir, 'seat.js'));
let n = 0;
for (const f of fs.readdirSync(dir).sort()) if (f.endsWith('.js')) { require(path.join(dir, f)); n++; }
console.log('load-all: ' + n + ' files, ' + Object.keys(seat.FREE).length + ' free fns, ' + Object.getOwnPropertyNames(seat.Seat.prototype).length + ' seat members');
