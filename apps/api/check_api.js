const http = require('http');

http.get('http://localhost:3001/tqc/ASSEMBLY', (res) => {
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        const json = JSON.parse(data);
        console.log(`Fetched ${json.length} records.`);
        json.slice(0, 10).forEach(r => {
            console.log(`- '${r.defectName}' -> ctqType: '${r.ctqType}'`);
        });
    });
}).on('error', (err) => {
    console.error("Error: " + err.message);
});
