const http = require('http');

http.get('http://localhost:3001/api/rqc/recent-inspections', (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        const json = JSON.parse(data);
        console.log(JSON.stringify(json, null, 2));
    });
}).on('error', (err) => {
    console.error('Error:', err.message);
});
