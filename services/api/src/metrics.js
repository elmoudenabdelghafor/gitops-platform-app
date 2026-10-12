const client = require('prom-client');

// Initialize default metric collection (CPU, Memory, event loop)
const register = new client.Registry();
client.collectDefaultMetrics({ register });

// Define custom HTTP request counter
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total count of HTTP requests processed',
  labelNames: ['method', 'path', 'status'],
  registers: [register]
});

// Define custom HTTP request duration histogram
const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'path', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register]
});

// Express middleware to track metrics
function metricsMiddleware(req, res, next) {
  const start = process.hrtime();

  res.on('finish', () => {
    // Normalise route path to avoid cardinality explosion
    const routePath = req.route ? req.baseUrl + req.route.path : req.path;
    const duration = process.hrtime(start);
    const durationInSeconds = duration[0] + duration[1] / 1e9;
    const status = res.statusCode ? res.statusCode.toString() : 'unknown';

    // Record metrics
    httpRequestsTotal.inc({
      method: req.method,
      path: routePath,
      status: status
    });

    httpRequestDurationSeconds.observe(
      {
        method: req.method,
        path: routePath,
        status: status
      },
      durationInSeconds
    );
  });

  next();
}

module.exports = {
  register,
  metricsMiddleware,
  httpRequestsTotal,
  httpRequestDurationSeconds
};
