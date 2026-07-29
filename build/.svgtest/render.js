// Map the "@/*" path alias onto the compiled output tree.
const path = require('path');
const Module = require('module');
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request.startsWith('@/')) {
    request = path.join(__dirname, request.slice(2));
  }
  return origResolve.call(this, request, ...rest);
};

const { renderToStaticMarkup } = require('react-dom/server');
const { createElement } = require('react');
const { RoomDiagramSVG } = require('./components/scan/RoomDiagramSVG.js');
const { WALL_LABELS } = require('./lib/scan/types.js');

let pass = 0, fail = 0;
function ok(name, cond, extra='') {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name + ' :: ' + extra); }
}
const wall = (id, length, height=2.6, doors=[], windows=[]) =>
  ({ id, label: WALL_LABELS[id], length, height, doors, windows });

function render(props) { return renderToStaticMarkup(createElement(RoomDiagramSVG, props)); }

// 1. The mock room, full data
const mockWalls = [
  wall('N', 4.20, 2.60, [], [{width:1.20,height:1.40,offsetFromLeft:1.50}]),
  wall('E', 3.40, 2.60, [{width:0.90,height:2.10,offsetFromLeft:0.60}], []),
  wall('S', 4.20, 2.60, [], [{width:1.20,height:1.40,offsetFromLeft:2.50}]),
  wall('W', 3.40, 2.60, [], []),
];
console.log('\n[full mock room]');
const full = render({ walls: mockWalls });
ok('no NaN coordinates', !full.includes('NaN'), full.slice(0,400));
ok('no undefined attrs', !full.includes('undefined'));
ok('renders an svg', full.startsWith('<svg'));
ok('labels all four walls',
   ['Noord','Oost','Zuid','West'].every(l => full.includes(l)));
ok('shows measured lengths', full.includes('4.20 m') && full.includes('3.40 m'));
ok('has accessible label', full.includes('role="img"') && full.includes('aria-label'));
ok('door produces a gap: east wall drawn in 2 pieces',
   (full.match(/<line/g) || []).length >= 5,
   'line count ' + (full.match(/<line/g)||[]).length);
ok('window drawn in window colour', full.includes('#60A5FA'));

// 2. Highlighted wall
console.log('\n[highlight]');
const hi = render({ walls: mockWalls, highlightedWall: 'N' });
ok('highlight colour present', hi.includes('#3B82F6'));
ok('other walls stay gray', hi.includes('#E5E7EB'));
const noHi = render({ walls: mockWalls, highlightedWall: null });
ok('no highlight -> no blue wall stroke', !noHi.includes('stroke="#3B82F6"'));

// 3. Blank walls (NaN lengths) - the wizard's initial state
console.log('\n[in-progress wizard: NaN lengths]');
const blank = [wall('N',NaN),wall('E',NaN),wall('S',NaN),wall('W',NaN)];
const blankOut = render({ walls: blank, highlightedWall: 'N' });
ok('NaN lengths do not leak into SVG', !blankOut.includes('NaN'), blankOut.slice(0,500));
ok('falls back to a drawable room', blankOut.includes('<rect'));
ok('labels without bogus numbers', blankOut.includes('Noord') && !blankOut.includes('Noord NaN'));

// 4. Partially measured (one axis known)
console.log('\n[partially measured]');
const partial = [wall('N',4.20),wall('E',NaN),wall('S',NaN),wall('W',NaN)];
const partialOut = render({ walls: partial, highlightedWall: 'E' });
ok('no NaN', !partialOut.includes('NaN'), partialOut.slice(0,400));
ok('shows the known wall length', partialOut.includes('4.20 m'));

// 5. Degenerate / hostile inputs
console.log('\n[hostile inputs]');
ok('empty wall array renders', (() => { const o = render({walls:[]}); return o.startsWith('<svg') && !o.includes('NaN'); })());
ok('zero length renders', !render({walls:[wall('N',0),wall('E',0),wall('S',0),wall('W',0)]}).includes('NaN'));
const neg = render({walls:[wall('N',-4),wall('E',3.4),wall('S',4.2),wall('W',3.4)]});
ok('negative length does not produce NaN', !neg.includes('NaN'));

// door wider than wall -> clamped, must not NaN or invert
const wide = [wall('N',4.20,2.60,[{width:99,height:2.1,offsetFromLeft:0}],[]),wall('E',3.4),wall('S',4.2),wall('W',3.4)];
ok('oversized door clamped, no NaN', !render({walls:wide}).includes('NaN'));
// offset beyond wall end
const beyond = [wall('N',4.20,2.60,[],[{width:1.2,height:1.4,offsetFromLeft:99}]),wall('E',3.4),wall('S',4.2),wall('W',3.4)];
ok('offset past wall end handled', !render({walls:beyond}).includes('NaN'));
// NaN inside an opening
const nanOpening = [wall('N',4.20,2.60,[{width:NaN,height:2.1,offsetFromLeft:NaN}],[]),wall('E',3.4),wall('S',4.2),wall('W',3.4)];
ok('NaN opening dropped, no NaN in output', !render({walls:nanOpening}).includes('NaN'));

// 6. Multiple + overlapping doors on one wall (merge logic)
console.log('\n[overlapping doors]');
const overlap = [
  wall('N',4.20,2.60,[{width:1.0,height:2.1,offsetFromLeft:0.5},{width:1.0,height:2.1,offsetFromLeft:1.0}],[]),
  wall('E',3.4),wall('S',4.2),wall('W',3.4),
];
const overlapOut = render({walls: overlap});
ok('overlapping doors merged without NaN', !overlapOut.includes('NaN'));
ok('still renders wall segments', overlapOut.includes('<line'));

// 7. props-based doors/windows override
console.log('\n[doors/windows overrides]');
const overrideOut = render({
  walls: [wall('N',4.20),wall('E',3.4),wall('S',4.2),wall('W',3.4)],
  doors: { E: [{width:0.9,height:2.1,offsetFromLeft:0.6}] },
  windows: { N: [{width:1.2,height:1.4,offsetFromLeft:1.5}] },
});
ok('override windows render', overrideOut.includes('#60A5FA'));
ok('override produces no NaN', !overrideOut.includes('NaN'));

// 8. very long / very wide rooms scale sanely
console.log('\n[extreme aspect ratios]');
const longRoom = render({walls:[wall('N',50),wall('E',0.5),wall('S',50),wall('W',0.5)]});
ok('50m x 0.5m room renders', !longRoom.includes('NaN') && longRoom.includes('<rect'));
// all coordinates must stay inside the 0..340 viewBox
const coords = [...longRoom.matchAll(/(?:x|y|x1|y1|x2|y2)="(-?[\d.]+)"/g)].map(m=>parseFloat(m[1]));
ok('all coords finite', coords.every(Number.isFinite));
ok('coords within viewBox bounds', coords.every(c => c >= -20 && c <= 360),
   'min ' + Math.min(...coords) + ' max ' + Math.max(...coords));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
