const express = require('express');
const path = require('path');
const http = require('http');
const client = require('prom-client');

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);
const apiUrl = process.env.API_URL || 'http://localhost:8080';
const serviceVersion = process.env.SERVICE_VERSION || '1.0.0';

// Prometheus Metrics setup
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestsTotal = new client.Counter({
  name: 'frontend_http_requests_total',
  help: 'Total frontend HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register]
});

// JSON logger
function log(level, message, meta = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    service: 'shop-frontend',
    level,
    message,
    ...meta
  };
  process.stdout.write(JSON.stringify(entry) + '\n');
}

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const route = req.route ? (req.baseUrl || '') + req.route.path : 'unmatched';
    httpRequestsTotal.inc({
      method: req.method,
      route: route,
      status: String(res.statusCode)
    });
    log('info', 'HTTP Request', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - start
    });
  });
  next();
});

// 1. Probes
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'shop-frontend', version: serviceVersion });
});

app.get('/readyz', (req, res) => {
  res.status(200).json({ status: 'ready', service: 'shop-frontend' });
});

// 2. Metrics
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err);
  }
});

// 3. API Proxy to Backend
app.all('/api/*', (req, res) => {
  try {
    const targetUrl = new URL(req.originalUrl, apiUrl);
    const options = {
      hostname: targetUrl.hostname,
      port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
      path: targetUrl.pathname + targetUrl.search,
      method: req.method,
      headers: {
        ...req.headers,
        host: targetUrl.host
      }
    };

    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      log('error', 'API Proxy Error', { error: err.message, target: targetUrl.href });
      res.status(502).json({ error: 'BadGateway', message: 'Unable to reach backend API service' });
    });

    req.pipe(proxyReq);
  } catch (err) {
    res.status(500).json({ error: 'ProxyError', message: err.message });
  }
});

// 4. UI Dashboard
app.use(express.static(path.join(__dirname)));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

let server;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(port, '0.0.0.0', () => {
    log('info', 'Frontend Server listening', { port, apiUrl, version: serviceVersion });
  });

  const shutdown = () => {
    log('info', 'Shutting down frontend server...');
    if (server) server.close(() => process.exit(0));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

module.exports = app;
