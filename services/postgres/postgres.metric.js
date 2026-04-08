const client = require('prom-client');

// 1. Create a Registry to hold all metrics
const register = new client.Registry();

// 2. Add Default Metrics (CPU, Memory, Event Loop Lag)
// This is vital for seeing if Node.js itself is the bottleneck
client.collectDefaultMetrics({ register, prefix: 'pg_service_' });

// 3. Define the main Performance Metric
// We use a Histogram because it's the gold standard for Latency
const dbQueryTimer = new client.Histogram({
  name: 'pg_db_operation_duration_seconds',
  help: 'Latency of Postgres operations in seconds',
  labelNames: ['operation', 'status'], // 'status' helps track if failures are slower
  buckets: [0.05, 0.1, 0.5, 1, 2, 5]    // Time ranges in seconds
});

// 4. Register the metric
register.registerMetric(dbQueryTimer);

module.exports = {
  register,
  dbQueryTimer
};