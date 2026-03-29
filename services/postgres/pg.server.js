// const express = require('express');
// const { getClient, isClientUp }= require('./get-client.postgres');
// const { getRecord } = require('./postgres.controller');

const path = require('path')
require('dotenv').config({
    path: path.resolve(__dirname, '.env')
});

// //environment variables
// const { PG_SERVER_PORT } = process.env;

// const app = express();

// app.use(
//     express.json()
// );


// //setting up app
// async function startServer(){
//     await isClientUp();
    
//     app.listen(PG_SERVER_PORT, () => {
//         console.log(`Running on PG_PORT ${PG_SERVER_PORT}`)
//     }); //on successful start - callback

//     await getRecord();
    
// }


// startServer();

const express = require('express');
const { getRecord } = require('./postgres.controller');
const postgresRoutes = require('./postgres.routes');

const app = express();
app.use(express.json());

const PORT = process.env.PG_SERVER_PORT || 7000;

async function startServer() {
    // Mount routes
    app.use('/', postgresRoutes);

    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });

    // Test a record fetch immediately
    await getRecord();
}

startServer();