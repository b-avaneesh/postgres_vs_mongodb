const express = require('express');
const path = require('path');

require('dotenv').config(
    { 
        path: path.resolve(__dirname,'.env')

    }
);
//environment variables
const { GATEWAY_PORT, GATEWAY_HOME } = process.env;

//creating app
const app = express();

//parses using json format
app.use(
    express.json()
);
//home directory for gateway
app.use(GATEWAY_HOME, require("./gateway.routes.js"));



//setting up app
async function startServer(){
    
    app.listen(GATEWAY_PORT, () => {
        console.log(`Running on port ${GATEWAY_PORT}`)
    }); //on successful start - callback

    
}


startServer();