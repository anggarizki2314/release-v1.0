import { bucketStart } from './electron/data/aggregate';

const t1 = 1609459200; // Jan 1 2021 00:00:00
const t2 = 1609459260; // 1 minute later
const t3 = 1609459320; // 2 minutes later
const t4 = 1609459200 + 21600; // 6 hours later

console.log("H6 buckets:");
console.log(bucketStart(t1, 'H6'));
console.log(bucketStart(t2, 'H6'));
console.log(bucketStart(t3, 'H6'));
console.log(bucketStart(t4, 'H6'));

console.log("\n6H buckets:");
console.log(bucketStart(t1, '6H'));
console.log(bucketStart(t2, '6H'));
console.log(bucketStart(t3, '6H'));
console.log(bucketStart(t4, '6H'));
