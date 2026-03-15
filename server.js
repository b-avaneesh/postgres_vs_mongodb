const express = require('express');
const { getClient, isClientUp }= require('./postgres/get-client');
require('dotenv').config();

//environment variables
const { PORT } = process.env;

const app = express();

app.use(
    express.json()
);


//setting up app
async function startServer(){
    await isClientUp();
    
    app.listen(PORT, () => {
        console.log(`Running on port ${PORT}`)
    }); //on successful start - callback


}


startServer();