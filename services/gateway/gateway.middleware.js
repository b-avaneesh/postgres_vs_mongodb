const path = require('path')
const proxy = require('express-http-proxy');
require('dotenv').config({
    path: path.resolve(__dirname,'.env')
})

/**
 * Routing Middleware - Proxies requests to the appropriate backend
 *
 * Routes to PostgreSQL or MongoDB based on:
 * 1. ?db=mongo or ?db=postgres query parameter (has priority)
 * 2. x-db: mongo or x-db: postgres header
 * 3. Defaults to PostgreSQL if neither is specified
 */
const routingMiddleware = (req, res, next) => {
    // Get database preference from query parameter or header
    const dbFromQuery = req.query.db;
    const dbFromHeader = req.get('x-db');
    const database = dbFromQuery || dbFromHeader || 'postgres';

    // Determine target backend
    const target = database === 'mongo'
        ? 'http://localhost:8000/'
        : 'http://localhost:7000/';

    console.log(`[Gateway Middleware] ${req.method} ${req.path} → ${target.replace('/', '')} (db=${database})`);

    // The proxy "hijacks" the response, so it never reaches
    // any code below this line if a target is found.
    proxy(target)(req, res, next);
};


module.exports = {
    routingMiddleware
}