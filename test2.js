const http = require('http');
const payload = JSON.stringify({ pictureBase64: 'TEST' });
const req = http.request({
    hostname: 'localhost',
    port: 3001,
    path: '/api/ctq-setup/models/2/picture',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
    }
}, (res) => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => console.log('STATUS:', res.statusCode, 'BODY:', data));
});
req.on('error', console.error);
req.write(payload);
req.end();
