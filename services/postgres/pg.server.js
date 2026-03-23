const express = require('express');
const { getClient, isClientUp }= require('./get-client');
require('dotenv').config();

//environment variables
const { PG_PORT } = process.env;

const app = express();

app.use(
    express.json()
);


//setting up app
async function startServer(){
    await isClientUp();
    
    app.listen(PG_PORT, () => {
        console.log(`Running on PG_PORT ${PG_PORT}`)
    }); //on successful start - callback

    
}


startServer();