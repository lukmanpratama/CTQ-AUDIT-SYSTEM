const { Client } = require('pg');

const client = new Client({
    host: '127.0.0.1',
    port: 5433,
    user: 'ctqaudit',
    password: 'ctqaudit_pass',
    database: 'ctqaudit_db',
    ssl: false
});

async function main() {
    try {
        await client.connect();
        console.log('Connected to database');

        const check = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'tqc_report' AND column_name = 'usp_classification'
        `);

        if (check.rows.length > 0) {
            console.log('Column usp_classification already exists!');
        } else {
            await client.query(`ALTER TABLE tqc_report ADD COLUMN usp_clas ification VARCHAR(100)`);
            console.log('SUCCESS: Column usp_classification added!');
        }

        const cols = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'tqc_report' ORDER BY ordinal_position
        `);
        console.log('Columns:', cols.rows.map(r => r.column_name).join(', '));
    } catch (e) {
        console.error('ERROR:', e.message);
    } finally {
        await client.end();
    }
}

main();
