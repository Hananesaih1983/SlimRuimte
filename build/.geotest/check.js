const g = require('./geometry.js');
const t = require('./types.js');
const d = require('./device.js');

let pass = 0, fail = 0;
function ok(name, cond, extra='') {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name + ' ' + extra); }
}

const wall = (id, length, height=2.6, doors=[], windows=[]) =>
  ({ id, label: t.WALL_LABELS[id], length, height, doors, windows });

// --- the LiDAR mock fixture, which must validate and match the spec numbers ---
const mockWalls = [
  wall('N', 4.20, 2.60, [], [{width:1.20,height:1.40,offsetFromLeft:1.50}]),
  wall('E', 3.40, 2.60, [{width:0.90,height:2.10,offsetFromLeft:0.60}], []),
  wall('S', 4.20, 2.60, [], [{width:1.20,height:1.40,offsetFromLeft:2.50}]),
  wall('W', 3.40, 2.60, [], []),
];
console.log('\n[mock fixture]');
const fp = g.computeFootprint(mockWalls);
ok('width 4.20', fp.width === 4.20, JSON.stringify(fp));
ok('depth 3.40', fp.depth === 3.40, JSON.stringify(fp));
ok('height 2.60', fp.height === 2.60, JSON.stringify(fp));
ok('area 14.28', fp.area === 14.28, 'got ' + fp.area);
ok('perimeter 15.20', fp.perimeter === 15.20, 'got ' + fp.perimeter);
ok('mock validates clean', g.roomCloses(mockWalls), JSON.stringify(g.validateWalls(mockWalls)));

// --- 5cm opposing-wall tolerance: the boundary is what matters ---
console.log('\n[5cm tolerance]');
ok('exactly 5cm apart passes', g.opposingWallsMatch(4.20, 4.25));
ok('4cm apart passes',         g.opposingWallsMatch(4.20, 4.24));
ok('6cm apart fails',         !g.opposingWallsMatch(4.20, 4.26));
ok('floating point 5cm passes', g.opposingWallsMatch(3.40, 3.45), 'classic fp trap');
ok('missing wall not yet failing', g.opposingWallsMatch(4.20, undefined));

const skewed = [wall('N',4.20), wall('E',3.40), wall('S',4.40), wall('W',3.40)];
const skewIssues = g.validateWalls(skewed).filter(i => i.severity==='error');
ok('20cm mismatch rejected', skewIssues.length > 0);
ok('uses the exact spec error copy',
   skewIssues.some(i => i.message === 'De tegenoverliggende muren verschillen meer dan 5cm. Controleer je meting.'),
   JSON.stringify(skewIssues.map(i=>i.message)));
ok('room does not close', !g.roomCloses(skewed));

// --- opening containment ---
console.log('\n[openings]');
const overflow = [
  wall('N', 4.20, 2.60, [], [{width:1.20,height:1.40,offsetFromLeft:3.50}]), // 4.70 > 4.20
  wall('E',3.40), wall('S',4.20), wall('W',3.40),
];
ok('opening past wall end rejected', !g.roomCloses(overflow),
   JSON.stringify(g.validateWalls(overflow).map(i=>i.message)));

const tooTall = [
  wall('N', 4.20, 2.60, [{width:0.90,height:3.00,offsetFromLeft:0.60}], []),
  wall('E',3.40), wall('S',4.20), wall('W',3.40),
];
ok('opening taller than wall rejected', !g.roomCloses(tooTall));

const flush = [
  wall('N', 4.20, 2.60, [], [{width:1.20,height:1.40,offsetFromLeft:3.00}]), // exactly 4.20
  wall('E',3.40), wall('S',4.20), wall('W',3.40),
];
ok('opening flush to wall end allowed', g.roomCloses(flush),
   JSON.stringify(g.validateWalls(flush).map(i=>i.message)));

// --- missing / out of range walls ---
console.log('\n[bounds]');
ok('missing walls rejected', !g.roomCloses([wall('N',4.2), wall('S',4.2)]));
ok('0.2m wall rejected (min 0.5)', !g.roomCloses([wall('N',0.2),wall('E',3.4),wall('S',0.2),wall('W',3.4)]));
ok('60m wall rejected (max 50)',  !g.roomCloses([wall('N',60),wall('E',3.4),wall('S',60),wall('W',3.4)]));
ok('NaN length rejected', !g.roomCloses([wall('N',NaN),wall('E',3.4),wall('S',4.2),wall('W',3.4)]));

// --- averaging behaviour ---
console.log('\n[averaging]');
const avg = g.computeFootprint([wall('N',4.20),wall('E',3.40),wall('S',4.24),wall('W',3.40)]);
ok('averages opposing pair (4.20/4.24 -> 4.22)', avg.width === 4.22, 'got ' + avg.width);

// --- parseWall hardening (untrusted JSON) ---
console.log('\n[parseWall]');
ok('rejects bad id', g.parseWall({id:'X',length:4,height:2.6}) === null);
ok('rejects non-numeric length', g.parseWall({id:'N',length:'abc',height:2.6}) === null);
ok('rejects null', g.parseWall(null) === null);
const p = g.parseWall({id:'N',length:'4.204',height:2.6,doors:'nope',windows:[{width:1,height:1,offsetFromLeft:0}]});
ok('coerces + rounds to cm', p && p.length === 4.20, JSON.stringify(p));
ok('drops malformed doors array', p && Array.isArray(p.doors) && p.doors.length === 0);
ok('keeps valid windows', p && p.windows.length === 1);
ok('backfills label', p && p.label === 'Noord');
const p2 = g.parseWall({id:'E',length:3.4,height:2.6,windows:[{width:'x',height:1,offsetFromLeft:0},{width:1,height:1,offsetFromLeft:0.5}]});
ok('drops only the bad opening', p2 && p2.windows.length === 1, JSON.stringify(p2 && p2.windows));

// --- device detection ---
console.log('\n[device detection]');
const UA = {
  iphone17: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iphone12era: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_1 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
  iphoneOld: 'Mozilla/5.0 (iPhone; CPU iPhone OS 12_1 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 15_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.2 Mobile/15E148 Safari/604.1',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36',
  win: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
};
ok('iOS 17 iPhone -> lidar primary',  d.detectDeviceCapability(UA.iphone17).lidarLikely);
ok('iOS 14.1 iPhone -> lidar primary', d.detectDeviceCapability(UA.iphone12era).lidarLikely);
ok('iOS 12 iPhone -> manual primary', !d.detectDeviceCapability(UA.iphoneOld).lidarLikely);
ok('iPad OS 15 -> lidar primary',     d.detectDeviceCapability(UA.ipad).lidarLikely);
ok('parses iPad "CPU OS 15_2"',       d.detectDeviceCapability(UA.ipad).iosMajorVersion === 15,
   'got ' + d.detectDeviceCapability(UA.ipad).iosMajorVersion);
ok('parses iPhone version 17',        d.detectDeviceCapability(UA.iphone17).iosMajorVersion === 17);
ok('Mac -> manual primary',          !d.detectDeviceCapability(UA.mac).lidarLikely);
ok('Android -> manual primary',      !d.detectDeviceCapability(UA.android).lidarLikely);
ok('Windows -> manual primary',      !d.detectDeviceCapability(UA.win).lidarLikely);
ok('null UA -> manual primary',      !d.detectDeviceCapability(null).lidarLikely);
ok('empty UA -> manual primary',     !d.detectDeviceCapability('').lidarLikely);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
