const request = require('supertest');
const app = require('../src/server');

describe('Shop Frontend Endpoints', () => {
  test('GET /healthz returns 200 and ok status', async () => {
    const res = await request(app).get('/healthz');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('GET /readyz returns 200 and ready status', async () => {
    const res = await request(app).get('/readyz');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ready');
  });

  test('GET /metrics exposes Prometheus metrics', async () => {
    const res = await request(app).get('/metrics');
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain('frontend_http_requests_total');
  });

  test('GET / serves HTML index page', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain('GitOps Cloud Shop');
  });
});
