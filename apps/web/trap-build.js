const { execSync } = require('child_process');
const fs = require('fs');

try {
    const out = execSync('npx.cmd next build', { encoding: 'utf8', stdio: 'pipe' });
    fs.writeFileSync('next-build-out.txt', "STDOUT\n" + out);
} catch (err) {
    fs.writeFileSync('next-build-out.txt', "ERROR\n" + err.message + "\nOUT:\n" + (err.stdout || '') + "\nERR:\n" + (err.stderr || ''));
}
