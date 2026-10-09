const fs = require('fs');
async function run() {
    try {
        const fetch = require('node-fetch');
        const res = await fetch('http://localhost:3001/rqc/trends');
        const text = await res.text();
        fs.writeFileSync('output_test.txt', 'STATUS: ' + res.status + '\nDATA:\n' + text);
    } catch (err) {
        fs.writeFileSync('output_test.txt', 'FETCH ERROR: ' + err.message);
    }
}
run();
