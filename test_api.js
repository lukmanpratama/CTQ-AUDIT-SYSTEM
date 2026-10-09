const http = require('http');
// Just test the endpoint
const payload = JSON.stringify({
    qtyChecking: 20,
    defects: []
});
const req = http.request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/rqc/headers/some-id/areas/some-area/processes/some-process/inspections',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': payload.length
    }
}, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log('Status:', res.statusCode, 'Body:', data));
});
req.on('error', e => console.error(e));
req.write(payload);
req.end();
