const fs = require('fs');
const path = require('path');

function getFiles(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            results = results.concat(getFiles(fullPath));
        } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
            results.push(fullPath);
        }
    });
    return results;
}

const files = getFiles('d:/CTQ AUDIT SYSTEM/apps/web/src');
let changed = 0;
let log = '';

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    let patched = false;

    const reThen = /\.then\(\s*([a-zA-Z0-9_]+)\s*=>\s*\1\.json\(\)\s*\)/g;
    if (reThen.test(content)) {
        content = content.replace(reThen, '.then($1 => $1.text().then(t => t ? JSON.parse(t) : null))');
        patched = true;
    }

    const reAwait = /await\s+([a-zA-Z0-9_]+)\.json\(\)/g;
    if (reAwait.test(content)) {
        if (!file.includes('api-client.ts')) {
            content = content.replace(reAwait, `await $1.text().then(t => t ? JSON.parse(t) : null)`);
            patched = true;
        }
    }

    if (patched) {
        fs.writeFileSync(file, content, 'utf8');
        changed++;
        log += 'Patched: ' + file + '\n';
    }
}
log += 'Total files patched: ' + changed + '\n';
fs.writeFileSync('d:/CTQ AUDIT SYSTEM/apps/web/patch_log.txt', log);
