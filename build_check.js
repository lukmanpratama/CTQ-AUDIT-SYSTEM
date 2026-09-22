const { execSync } = require('child_process');
const fs = require('fs');

try {
    const out = execSync('npm run build -w apps/api', { encoding: 'utf-8' });
    fs.writeFileSync('build_out.txt', out);
} catch (e) {
    fs.writeFileSync('build_out.txt', 'ERROR:\n' + e.stdout + '\n' + e.stderr);
}
