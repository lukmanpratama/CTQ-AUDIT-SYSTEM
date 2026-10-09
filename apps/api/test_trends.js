const fs = require('fs');
const fetch = require('node-fetch') || (typeof global !== 'undefined' ? global.fetch : null);
async function run() {
    try {
        const res = await fetch('http://localhost:3001/rqc/trends');
        const text = await res.text();
        fs.writeFileSync('response.txt', 'STATUS: ' + res.status + '\nDATA:\n' + text);
    } catch (e) {
        fs.writeFileSync('response.txt', 'ERROR: ' + e.message);
    }
    process.exit(0);
}
run();
