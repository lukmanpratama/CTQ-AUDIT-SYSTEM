const http = require('http');

const endpoints = [
    '/api/master/areas',
    '/api/master/processes',
    '/api/master/defects',
    '/api/master/users',
    '/api/master/pos',
    '/api/ctq-setup/models'
];

endpoints.forEach(path => {
    http.get({
        hostname: 'localhost',
        port: 3001,
        path: path
    }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            if (res.statusCode !== 200) {
                console.error(`[ERROR 3001 ${res.statusCode}] ${path}:`, data.substring(0, 100));
            } else {
                console.log(`[OK 3001] ${path}`);
            }
        });
    }).on('error', (err) => {
        console.error(`[CRITICAL] failed to connect to 3001 ${path}:`, err.message);
    });
});
