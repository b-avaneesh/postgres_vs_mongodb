const { Pool } = require('pg');
const path = require('path')
require('dotenv').config({
    path: path.resolve(__dirname, '.env')
});

// Create the pool once. It handles multiple clients under the hood.
const pool = new Pool({
    host: process.env.PG_HOST,
    port: process.env.PG_PORT,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DATABASE,

    //Helps with "forcibly closed" issues:
    idleTimeoutMillis: 30000, 
    connectionTimeoutMillis: 2000,
});

// isClientUp logic replacement.
async function query(text, params) {
    const start = Date.now();
    try {
        
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        console.log('Executed query', { text, duration, rows: res.rowCount });
        return res;

    } catch (err) {
        console.error('Database query error:', err);
        throw err;
    }
}

module.exports = {
    query // Export a generic query function instead
};