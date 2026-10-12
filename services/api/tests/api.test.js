const request = require('supertest');

describe('Shop API Endpoints', () => {
  let app;

  beforeEach(() => {
    // Reset modules to allow env var variation
    jest.resetModules();
  });

  test('GET /healthz returns 200 and healthy status', async () => {
    app = require('../src/index');
    const res = await request(app).get('/healthz');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('version');
  });

  test('GET /readyz returns 200 in standalone mode', async () => {
    app = require('../src/index');
    const res = await request(app).get('/readyz');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ready');
  });

  test('GET /metrics exposes Prometheus metrics with normalized route label', async () => {
    app = require('../src/index');
    // Generate a hit to register metric
    await request(app).get('/healthz');
    const res = await request(app).get('/metrics');
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain('http_requests_total');
    expect(res.text).toContain('route="/healthz"');
    expect(res.text).toContain('http_request_duration_seconds');
  });

  test('GET /api/products returns products list', async () => {
    app = require('../src/index');
    const res = await request(app).get('/api/products');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.products)).toBe(true);
    expect(res.body.products.length).toBeGreaterThan(0);
  });

  test('Fault injection is disabled by default (returns 404 for /api/fault)', async () => {
    delete process.env.ENABLE_FAULT_INJECTION;
    app = require('../src/index');
    const res = await request(app).post('/api/fault').send({ enabled: true });
    expect(res.statusCode).toBe(404);
  });

  test('Fault injection returns 500 when ENABLE_FAULT_INJECTION=true', async () => {
    process.env.ENABLE_FAULT_INJECTION = 'true';
    app = require('../src/index');
    const res = await request(app).get('/api/products?fault=true');
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('InternalServerError');
    delete process.env.ENABLE_FAULT_INJECTION;
  });
});
