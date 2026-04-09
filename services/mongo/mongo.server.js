const express = require('express');
const { connectMongo, closeMongoConnection } = require('./get-client.mongo.js');
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
    await connectMongo();

    // Mount routes
    app.use('/', mongoRoutes);

    app.listen(MONGO_SERVER_PORT, () => {
        console.log(`Mongo running Running on MONGO_PORT ${MONGO_SERVER_PORT}`)
    }); //on successful start - callback
}

async function shutdown(signal) {
    try {
        await closeMongoConnection(signal);
        process.exit(0);
    } catch (err) {
        console.error(`[Mongo] shutdown error during ${signal}:`, err.message);
        process.exit(1);
    }
}

process.on('SIGINT', () => {
    shutdown('SIGINT');
});

process.on('SIGTERM', () => {
    shutdown('SIGTERM');
});

startServer().catch((err) => {
    console.error('[Mongo] failed to start server:', err.message);
    process.exit(1);
});
