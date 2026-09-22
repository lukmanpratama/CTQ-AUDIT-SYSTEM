fetch('http://127.0.0.1:3001/rqc/headers').then(r => r.json()).then(d => console.log(JSON.stringify(d).substring(0, 2000)))
