const { Pool } = require('pg');

// Your exact database configuration
const pool = new Pool({
    user: 'jareth1988',
    host: 'localhost',
    database: 'lifecycle_planning',
    password: 'labyrinth',
    port: 5432,
});

async function verify() {
    console.log('Testing database connection...\n');
    
    try {
        // Simple connection test
        const client = await pool.connect();
        console.log('✓ Connected to PostgreSQL successfully!');
        
        // Check current database
        const result = await client.query('SELECT current_database(), current_user, version()');
        console.log(`✓ Database: ${result.rows[0].current_database}`);
        console.log(`✓ User: ${result.rows[0].current_user}`);
        console.log(`✓ PostgreSQL Version: ${result.rows[0].version.split(' ')[1]}`);
        
        // List tables
        const tables = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        
        console.log(`\n✓ Found ${tables.rows.length} tables:`);
        tables.rows.forEach(t => console.log(`  - ${t.table_name}`));
        
        client.release();
        console.log('\n✓ Database is ready for use!');
        process.exit(0);
        
    } catch (err) {
        console.error('✗ Connection failed!');
        console.error(`Error: ${err.message}`);
        
        if (err.code === 'ECONNREFUSED') {
            console.log('\nPostgreSQL might not be running. Try these PowerShell commands:');
            console.log('  1. Check status: Get-Service -Name postgresql*');
            console.log('  2. Start service: Start-Service -Name postgresql*');
        } else if (err.code === '28P01') {
            console.log('\nAuthentication failed. Check username/password.');
        } else if (err.code === '3D000') {
            console.log('\nDatabase does not exist. Create it first (see instructions below).');
        }
        process.exit(1);
    } finally {
        await pool.end();
    }
}

verify();