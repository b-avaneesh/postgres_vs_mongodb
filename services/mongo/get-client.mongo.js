const mongoose = require('mongoose');
const path = require('path');

require('dotenv').config({
  path: path.resolve(__dirname, '.env')
});

const MONGO_CONNECTION_STRING = process.env.MONGO_URL || process.env.MONGO_CONNECTION_STRING;
const DEFAULT_MAX_POOL_SIZE = Number(process.env.MONGO_MAX_POOL_SIZE || 100);
const DEFAULT_MIN_POOL_SIZE = Number(process.env.MONGO_MIN_POOL_SIZE || 10);
const DEFAULT_MAX_IDLE_TIME_MS = Number(process.env.MONGO_MAX_IDLE_TIME_MS || 30000);
const DEFAULT_SERVER_SELECTION_TIMEOUT_MS = Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 5000);
const DEFAULT_SOCKET_TIMEOUT_MS = Number(process.env.MONGO_SOCKET_TIMEOUT_MS || 45000);

let connectPromise = null;
let listenersRegistered = false;

function getConnectionOptions() {
    return {
        maxPoolSize: DEFAULT_MAX_POOL_SIZE,
        minPoolSize: DEFAULT_MIN_POOL_SIZE,
        maxIdleTimeMS: DEFAULT_MAX_IDLE_TIME_MS,
        serverSelectionTimeoutMS: DEFAULT_SERVER_SELECTION_TIMEOUT_MS,
        socketTimeoutMS: DEFAULT_SOCKET_TIMEOUT_MS,
        family: 4,
        autoIndex: true
    };
}

function logConnectionState(message, extra = {}) {
    console.log('[Mongo]', message, extra);
}

function registerConnectionListeners() {
    if (listenersRegistered) {
        return;
    }

    listenersRegistered = true;

    mongoose.connection.on('connected', () => {
        logConnectionState('connected', {
            host: mongoose.connection.host,
            database: mongoose.connection.name
        });
    });

    mongoose.connection.on('error', (err) => {
        console.error('[Mongo] connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
        logConnectionState('disconnected');
    });

    mongoose.connection.on('reconnected', () => {
        logConnectionState('reconnected');
    });
}

async function connectMongo() {
    if (!MONGO_CONNECTION_STRING) {
        throw new Error('Missing MongoDB connection string. Set MONGO_URL or MONGO_CONNECTION_STRING.');
    }

    if (mongoose.connection.readyState === 1) {
        return mongoose.connection;
    }

    if (connectPromise) {
        return connectPromise;
    }

    registerConnectionListeners();

    const options = getConnectionOptions();
    logConnectionState('initializing connection', {
        maxPoolSize: options.maxPoolSize,
        minPoolSize: options.minPoolSize,
        serverSelectionTimeoutMS: options.serverSelectionTimeoutMS,
        socketTimeoutMS: options.socketTimeoutMS
    });

    connectPromise = mongoose.connect(MONGO_CONNECTION_STRING, options)
        .then((client) => {
            logConnectionState('connection ready', {
                host: client.connection.host,
                database: client.connection.name,
                readyState: client.connection.readyState
            });
            return client.connection;
        })
        .catch((err) => {
            console.error('[Mongo] failed to connect:', err.message);
            connectPromise = null;
            throw err;
        });

    return connectPromise;
}

async function getClient() {
    const connection = await connectMongo();
    return connection.getClient();
}

async function closeMongoConnection(signal = 'shutdown') {
    if (mongoose.connection.readyState === 0) {
        return;
    }

    logConnectionState('closing connection', { signal });
    await mongoose.connection.close(false);
    connectPromise = null;
}

module.exports = {
    connectMongo,
    getClient,
    closeMongoConnection
};
