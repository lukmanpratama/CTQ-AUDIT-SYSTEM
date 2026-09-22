const net = require('net');

const server = net.createServer();

server.once('error', function (err) {
    if (err.code === 'EADDRINUSE') {
        console.log('Port 3001 is STILL in use');
    }
});

server.once('listening', function () {
    console.log('Port 3001 is free');
    server.close();
});

server.listen(3001);
