const { exec } = require('child_process');
const fs = require('fs');
exec('npx tsc --noEmit', { cwd: 'd:\\CTQ AUDIT SYSTEM\\apps\\api' }, (error, stdout, stderr) => {
    fs.writeFileSync('tsc_errors.txt', (stdout || '') + '\n' + (stderr || ''));
});
