const { execSync } = require('child_process');
const fs = require('fs');

try {
    console.log("Running next build...");
    const output = execSync('npm run build', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    fs.writeFileSync('build-res.txt', "SUCCESS\n" + output);
} catch (err) {
    fs.writeFileSync('build-res.txt', "FAILED\n" + (err.stdout || "") + "\n" + (err.stderr || "") + "\n" + err.message);
}
console.log("Done");
