const { execSync } = require('child_process');
const fs = require('fs');

try {
    const out = execSync('docker logs --tail 250 ctqaudit_api', { encoding: 'utf-8' });
    fs.writeFileSync('docker_logs2.txt', out);
} catch (e) {
    fs.writeFileSync('docker_logs2.txt', 'ERROR:\n' + (e.stdout || '') + '\n' + (e.stderr || ''));
}
