import { snapToShiftAngles } from '../interaction/InteractionController';

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`[FAIL] ${msg}`);
    process.exit(1);
  }
  console.log(`[PASS] ${msg}`);
}

console.log('--- RUNNING DRAWING SHIFT SNAP TEST SUITE ---');

const p1 = { x: 100, y: 200 };

// 1. Horizontal right (near 0 degrees)
const snapRight = snapToShiftAngles(p1.x, p1.y, 300, 205);
assert(snapRight.isHorizontal === true, 'Horizontal right snap isHorizontal is true');
assert(snapRight.isVertical === false, 'Horizontal right snap isVertical is false');
assert(snapRight.y === p1.y, 'Horizontal right snap y exactly equals p1.y');

// 2. Horizontal left (near 180 degrees)
const snapLeft = snapToShiftAngles(p1.x, p1.y, 10, 195);
assert(snapLeft.isHorizontal === true, 'Horizontal left snap isHorizontal is true');
assert(snapLeft.isVertical === false, 'Horizontal left snap isVertical is false');
assert(snapLeft.y === p1.y, 'Horizontal left snap y exactly equals p1.y');

// 3. Vertical down (near 90 degrees)
const snapDown = snapToShiftAngles(p1.x, p1.y, 104, 400);
assert(snapDown.isVertical === true, 'Vertical down snap isVertical is true');
assert(snapDown.isHorizontal === false, 'Vertical down snap isHorizontal is false');
assert(snapDown.x === p1.x, 'Vertical down snap x exactly equals p1.x');

// 4. Vertical up (near -90 degrees)
const snapUp = snapToShiftAngles(p1.x, p1.y, 96, 50);
assert(snapUp.isVertical === true, 'Vertical up snap isVertical is true');
assert(snapUp.isHorizontal === false, 'Vertical up snap isHorizontal is false');
assert(snapUp.x === p1.x, 'Vertical up snap x exactly equals p1.x');

// 5. Diagonal 45 degrees
const snapDiag = snapToShiftAngles(p1.x, p1.y, 200, 302);
assert(snapDiag.isHorizontal === false, 'Diagonal snap isHorizontal is false');
assert(snapDiag.isVertical === false, 'Diagonal snap isVertical is false');

console.log('\nAll Drawing Shift Snap Tests Passed Successfully!');
