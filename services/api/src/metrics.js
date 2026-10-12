const client = require('prom-client');

// Initialize Prometheus registry and default metric collection
const register = new client.Registry();
client.collectDefaultMetrics({ register });

// Define HTTP request counter with normalized 'route' label to prevent cardinality bloat
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total count of HTTP requests processed',
  labelNames: ['method', 'route', 'status'],
  registers: [register]
});

// Define HTTP request duration histogram
const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request latency in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [register]
});

// Express middleware tracking route-level metrics
function metricsMiddleware(req, res, next) {
  const endTimer = httpRequestDurationSeconds.startTimer();

  res.on('finish', () => {
    // Normalize route to template pattern to prevent high cardinality
    const route = req.route ? (req.baseUrl || '') + req.route.path : 'unmatched';
    const labels = {
      method: req.method,
      route: route,
      status: String(res.statusCode)
    };

    httpRequestsTotal.inc(labels);
    endTimer(labels);
  });

  next();
}

module.exports = {
  register,
  metricsMiddleware,
  httpRequestsTotal,
  httpRequestDurationSeconds
};
