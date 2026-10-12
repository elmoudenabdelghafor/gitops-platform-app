const request = require('supertest');
const app = require('../src/index');

describe('Shop API Endpoints', () => {
  test('GET /healthz returns 200 and healthy status', async () => {
    const res = await request(app).get('/healthz');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('version');
  });

  test('GET /readyz returns 200 in standalone mode', async () => {
    const res = await request(app).get('/readyz');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ready');
  });

  test('GET /metrics exposes Prometheus metrics', async () => {
    // Generate a hit to register metric
    await request(app).get('/healthz');
    const res = await request(app).get('/metrics');
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain('http_requests_total');
    expect(res.text).toContain('http_request_duration_seconds');
  });

  test('GET /api/products returns products list', async () => {
    const res = await request(app).get('/api/products');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.products)).toBe(true);
    expect(res.body.products.length).toBeGreaterThan(0);
  });

  test('GET /api/products?fault=true triggers simulated 500 error', async () => {
    const res = await request(app).get('/api/products?fault=true');
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('InternalServerError');
  });
});
