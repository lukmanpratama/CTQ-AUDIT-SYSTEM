const { spawnSync } = require('child_process');
const fs = require('fs');

console.log("Running TSC...");
const eslint = spawnSync('npx.cmd', ['eslint', 'src/features/rqc-inline/components/RqcInlineClient.tsx'], { encoding: 'utf-8' });
fs.writeFileSync('lint-out.txt', "STDOUT:\n" + eslint.stdout + "\nSTDERR:\n" + eslint.stderr);

const tsc = spawnSync('npx.cmd', ['tsc', '--noEmit'], { encoding: 'utf-8' });
fs.writeFileSync('tsc-out.txt', "STDOUT:\n" + tsc.stdout + "\nSTDERR:\n" + tsc.stderr);

console.log("Done");
