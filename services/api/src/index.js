const express = require('express');
const Redis = require('ioredis');
const logger = require('./logger');
const { register, metricsMiddleware } = require('./metrics');

const app = express();
const port = parseInt(process.env.PORT || '8080', 10);
const redisHost = process.env.REDIS_HOST;
const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
const serviceVersion = process.env.SERVICE_VERSION || '1.0.0';

let redisClient = null;
let redisConnected = false;
const faultEnabled = process.env.ENABLE_FAULT_INJECTION === 'true';
let faultModeActive = faultEnabled && process.env.FAULT_MODE === 'true';

// Initialize Redis if configured
if (redisHost) {
  logger.info('Connecting to Redis', { host: redisHost, port: redisPort });
  redisClient = new Redis({
    host: redisHost,
    port: redisPort,
    lazyConnect: true,
    retryStrategy(times) {
      const delay = Math.min(times * 100, 3000);
      return delay;
    }
  });

  redisClient.connect().then(() => {
    redisConnected = true;
    logger.info('Connected to Redis successfully');
  }).catch((err) => {
    logger.warn('Initial Redis connection failed', { error: err.message });
  });

  redisClient.on('connect', () => { redisConnected = true; });
  redisClient.on('error', (err) => {
    redisConnected = false;
    logger.error('Redis error', { error: err.message });
  });
}

// Global middlewares
app.use(express.json());
app.use(metricsMiddleware);

// JSON Access Logger Middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info('HTTP Request', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - start,
      userAgent: req.get('user-agent') || 'unknown'
    });
  });
  next();
});

// 1. Liveness Probe
app.get('/healthz', (req, res) => {
  res.status(200).json({
    status: 'ok',
    version: serviceVersion,
    uptimeSeconds: Math.floor(process.uptime())
  });
});

// 2. Readiness Probe
app.get('/readyz', async (req, res) => {
  if (redisClient) {
    try {
      await redisClient.ping();
      return res.status(200).json({ status: 'ready', redis: 'connected' });
    } catch (err) {
      return res.status(503).json({ status: 'unready', redis: 'disconnected', error: err.message });
    }
  }
  // If Redis is not configured, API is ready standalone
  return res.status(200).json({ status: 'ready', mode: 'standalone' });
});

// 3. Prometheus Metrics Endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err);
  }
});

// 4. Products API Endpoint
app.get('/api/products', async (req, res) => {
  // Fault simulation check (gated by ENABLE_FAULT_INJECTION for dev/staging environments)
  if (faultEnabled && (faultModeActive || req.query.fault === 'true')) {
    logger.warn('Fault mode triggered on /api/products');
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Simulated fault for canary analysis and alerting'
    });
  }

  const products = [
    { id: 1, name: 'Cloud Native Laptop Sticker', price: 4.99, inStock: true },
    { id: 2, name: 'GitOps Continuous Delivery Mug', price: 14.50, inStock: true },
    { id: 3, name: 'Kubernetes Cluster Hoodie', price: 49.99, inStock: true },
    { id: 4, name: 'DevSecOps Hard Hat Keychain', price: 7.25, inStock: false }
  ];

  // Attempt cache retrieval if Redis is active
  if (redisConnected && redisClient) {
    try {
      const cached = await redisClient.get('products:all');
      if (cached) {
        return res.json({ source: 'cache', version: serviceVersion, products: JSON.parse(cached) });
      }
      await redisClient.set('products:all', JSON.stringify(products), 'EX', 60);
    } catch (e) {
      logger.warn('Failed to read/write cache', { error: e.message });
    }
  }

  res.json({ source: 'database', version: serviceVersion, products });
});

// 5. Fault Toggle Endpoint (gated behind ENABLE_FAULT_INJECTION)
app.post('/api/fault', (req, res) => {
  if (!faultEnabled) {
    return res.status(404).json({
      error: 'NotFound',
      message: 'Fault injection is disabled in this environment'
    });
  }
  const { enabled } = req.body || {};
  faultModeActive = Boolean(enabled);
  logger.warn('Fault mode toggled', { active: faultModeActive });
  res.json({ faultModeActive });
});

// Root information endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'shop-api',
    version: serviceVersion,
    endpoints: ['/healthz', '/readyz', '/metrics', '/api/products']
  });
});

let server;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(port, '0.0.0.0', () => {
    logger.info('Shop API started', { port, version: serviceVersion });
  });

  const shutdown = () => {
    logger.info('Shutting down gracefully...');
    if (server) {
      server.close(() => {
        if (redisClient) redisClient.disconnect();
        logger.info('Server closed');
        process.exit(0);
      });
    }
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

module.exports = app;
