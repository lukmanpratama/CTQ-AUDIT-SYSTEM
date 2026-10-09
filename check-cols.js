const { Client } = require('pg');
const client = new Client('postgresql://ctqaudit:ctqaudit_pass@127.0.0.1:5433/ctqaudit_db?sslmode=disable');
client.connect().then(() => client.query('SELECT * FROM tqc_report LIMIT 1'))
    .then(res => console.log('COLUMNS:', Object.keys(res.rows[0] || {})))
    .catch(e => console.error(e))
    .finally(() => client.end());
