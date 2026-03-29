const proxy = require('express-http-proxy');
const path = require('path');
require('dotenv').config({
    path: path.resolve(__dirname, '.env')
});

/**
 * Gateway Controller - Routes requests to PostgreSQL or MongoDB backend
 *
 * Routing Logic:
 * - Checks query parameter ?db=mongo or ?db=postgres (default: postgres)
 * - Also checks 'x-db' header for alternative routing method
 * - Proxies request to appropriate backend service
 */

const POSTGRES_HOST = 'http://localhost:7000';
const MONGO_HOST = 'http://localhost:8000';

/**
 * Middleware that determines target and proxies the request
 */
const routingMiddleware = (req, res, next) => {
    // Determine database from query param or header (default: postgres)
    const dbFromQuery = req.query.db;
    const dbFromHeader = req.get('x-db');
    const database = dbFromQuery || dbFromHeader || 'postgres';

    // Select target URL based on database
    const target = database === 'mongo' ? MONGO_HOST : POSTGRES_HOST;

    console.log(`[Gateway] Routing ${req.method} ${req.path} to ${target} (db=${database})`);

    // Proxy the request to the target backend
    proxy(target)(req, res, next);
};

/**
 * Health check endpoint - doesn't need proxying
 */
const healthCheck = (req, res) => {
    res.status(200).json({
        status: 'Gateway is operational',
        timestamp: new Date().toISOString(),
        backends: {
            postgres: POSTGRES_HOST,
            mongo: MONGO_HOST
        }
    });
};

/**
 * Endpoint info - provides available endpoints
 */
const endpointInfo = (req, res) => {
    res.status(200).json({
        message: 'Medical Database Comparison - Gateway',
        baseUrl: '/gateway',
        primaryEndpoints: {
            'POST /patients': 'Add a new patient record',
            'POST /doctors': 'Add a new doctor profile',
            'POST /appointments': 'Book a new appointment',
            'GET /patients/:id': 'Retrieve a specific patient\'s profile and history',
            'PUT /appointments/:id': 'Update appointment status',
            'DELETE /patients/:id': 'Remove a patient and associated records'
        },
        analyticalEndpoints: {
            'GET /analytics/revenue-report': 'Generates revenue reports by doctor or department',
            'GET /analytics/doctor-workload': 'Returns patient counts per doctor',
            'GET /analytics/medication-trends': 'Analyzes the frequency of specific prescriptions'
        },
        systemEndpoints: {
            'POST /system/seed': 'Triggers bulk-load data (e.g., ?count=5000)',
            'POST /system/reset': 'Clears the database'
        },
        transactionalEndpoints: {
            'POST /appointments/complete-checkout': 'Mark done, issue prescription, create bill (atomic transaction)'
        },
        routingOptions: {
            'query parameter': 'Append ?db=mongo or ?db=postgres to endpoint URL',
            'header': 'Add header x-db: mongo or x-db: postgres',
            'default': 'postgres (if not specified)'
        },
        examples: [
            'POST /gateway/patients?db=mongo',
            'GET /gateway/analytics/revenue-report?db=postgres',
            'POST /gateway/appointments?db=mongo (with x-db header: postgres override)'
        ]
    });
};

module.exports = {
    routingMiddleware,
    healthCheck,
    endpointInfo
};
