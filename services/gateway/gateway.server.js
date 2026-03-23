const express = require('express');
const path = require('path');

require('dotenv').config(
    { 
        path: path.resolve(__dirname,'.env')

    }
);


//environment variables
const { GATEWAY_PORT } = process.env;

const app = express();

app.use(
    express.json()
);


//setting up app
async function startServer(){
    
    app.listen(GATEWAY_PORT, () => {
        console.log(`Running on port ${GATEWAY_PORT}`)
    }); //on successful start - callback

    
}


startServer();