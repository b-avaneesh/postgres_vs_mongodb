const mongoose = require('mongoose');
const path = require('path');

require('dotenv').config({
  path: path.resolve(__dirname, '.env')
});

const { MONGO_CONNECTION_STRING } = process.env;

let isConnected = false;

async function connectMongo(){
    if (isConnected) {
        return mongoose.connection;
    }

    try {
        const client = await mongoose.connect(MONGO_CONNECTION_STRING);

        isConnected = true;

        console.log(
            'Connected to MongoDB:',
            client.connection.host,
            client.connection.name
        );

        return client;
    } catch (err) {
        console.error("MongoDB connection error:", err.message);
        process.exit(1);
    }
}

async function getClient(){
    return connectMongo(); 
}

module.exports = {
    getClient
};