fetch('http://localhost:3001/api/ctq-setup/models').then(async r => console.log(r.status, await r.json())).catch(console.error);
