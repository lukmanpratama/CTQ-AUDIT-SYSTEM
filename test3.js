const http = require('http');
http.get('http://127.0.0.1:3001/rqc/headers', (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
        require('fs').writeFileSync('out.json', data);
        console.log('done, length:', data.length);
    });
});
