const { execSync } = require('child_process');
const fs = require('fs');

try {
    console.log("Running eslint...");
    const output = execSync('npx eslint src', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    fs.writeFileSync('lint-res.txt', "SUCCESS\n" + output);
} catch (err) {
    fs.writeFileSync('lint-res.txt', "FAILED\n" + (err.stdout || "") + "\n" + (err.stderr || "") + "\n" + err.message);
}

try {
    console.log("Running tsc...");
    const output2 = execSync('npx tsc --noEmit', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    fs.writeFileSync('tsc-res.txt', "SUCCESS\n" + output2);
} catch (err) {
    fs.writeFileSync('tsc-res.txt', "FAILED\n" + (err.stdout || "") + "\n" + (err.stderr || "") + "\n" + err.message);
}
console.log("Done");
