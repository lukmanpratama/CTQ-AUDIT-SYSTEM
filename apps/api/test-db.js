const { Client } = require('pg');
const client = new Client({
    connectionString: 'postgresql://ctqaudit:ctqaudit_pass@127.0.0.1:5433/ctqaudit_db'
});

client.connect()
    .then(() => {
        console.log('Connected to PostgreSQL successfully!');
        return client.query('SELECT 1 as val');
    })
    .then(res => {
        console.log('Query Result:', res.rows);
        return client.end();
    })
    .catch(err => {
        console.error('Error connecting to PostgreSQL:', err);
        process.exit(1);
    });
