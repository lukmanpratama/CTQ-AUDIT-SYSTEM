const fs = require('fs');
const path = require('path');

function getFiles(d) {
    let f = [];
    for (const i of fs.readdirSync(d, { withFileTypes: true })) {
        if (i.name === 'node_modules' || i.name === '.next') continue;
        const p = path.join(d, i.name);
        if (i.isDirectory()) f.push(...getFiles(p));
        else if (p.endsWith('.tsx') || p.endsWith('.ts') || p.endsWith('.js')) f.push({ p, m: fs.statSync(p).mtimeMs });
    }
    return f;
}

const files = getFiles('d:/CTQ AUDIT SYSTEM/apps/web');
files.sort((a, b) => b.m - a.m);
fs.writeFileSync('d:/CTQ AUDIT SYSTEM/apps/web/recent_files_output.txt', files.slice(0, 20).map(f => new Date(f.m).toISOString() + ' ' + f.p).join('\n'));
