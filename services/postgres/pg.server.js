// const express = require('express');
// const { getClient, isClientUp }= require('./get-client.postgres');
// const { getRecord } = require('./postgres.controller');

const path = require('path')
require('dotenv').config({
    path: path.resolve(__dirname, '.env')
});


const express = require('express');
const { getRecord } = require('./postgres.controller');
const postgresRoutes = require('./postgres.routes');

const app = express();
app.use(express.json());
app.use(express.static(path.resolve(__dirname, '../../frontend')));
app.get('/', (_req, res) => {
    res.sendFile(path.resolve(__dirname, '../../frontend/login.html'));
});

const PORT = process.env.PG_SERVER_PORT || 7000;

async function startServer() {
    // Mount routes - home is localhost:7000/
    app.use('/', postgresRoutes);

    app.listen(PORT, () => {
        console.log(`Postgres Server running on port ${PORT}`);
    });

    // Test a record fetch immediately
    await getRecord();
}

startServer();
