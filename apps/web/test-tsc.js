const { spawnSync } = require('child_process');
const fs = require('fs');

console.log("Running TSC...");
const tsc = spawnSync('npx.cmd', ['tsc', '--noEmit'], { encoding: 'utf-8' });

fs.writeFileSync('tsc-out-raw.txt', "STDOUT:\n" + tsc.stdout + "\nSTDERR:\n" + tsc.stderr);
console.log("Done");
