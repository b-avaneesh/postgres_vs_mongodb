const express = require('express');
const { getClient }= require('./get-client.mongo.js');
const mongoRoutes = require('./mongo.routes');
const path = require('path');

require('dotenv').config({
  path: path.resolve(__dirname, '.env')
});

//environment variables
const { MONGO_SERVER_PORT } = process.env;


//setting up app
const app = express();
app.use(
    express.json()
);


async function startServer(){
    await getClient();

    // Mount routes
    app.use('/', mongoRoutes);

    app.listen(MONGO_SERVER_PORT, () => {
        console.log(`Running on MONGO_PORT ${MONGO_SERVER_PORT}`)
    }); //on successful start - callback


}


startServer();