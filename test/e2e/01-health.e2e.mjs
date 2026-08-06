import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { api, expectStatus, unwrap } from './helpers.mjs';

describe('Health & infrastructure', () => {
  test('GET /api/health/fast responds ok', async () => {
    const res = await api('/api/health/fast');
    expectStatus(res, 200, 'health/fast');
    const d = unwrap(res.body);
    assert.equal(d.status, 'ok');
    assert.ok(d.timestamp, 'timestamp present');
  });

  test('GET /api/health reports database connected', async () => {
    const res = await api('/api/health');
    expectStatus(res, 200, 'health');
    const d = unwrap(res.body);
    assert.equal(d.services.database, true, `database unhealthy: ${JSON.stringify(d.details?.database)}`);
  });

  test('GET /api/health reports email transport reachable', async () => {
    const res = await api('/api/health');
    const d = unwrap(res.body);
    assert.equal(d.services.email, true, `email unhealthy: ${JSON.stringify(d.details?.email)}`);
  });

  test('GET /api/health overall status is healthy', async () => {
    const res = await api('/api/health');
    const d = unwrap(res.body);
    assert.equal(d.status, 'healthy', `status=${d.status} services=${JSON.stringify(d.services)}`);
  });

  test('GET / responds', async () => {
    const res = await api('/');
    assert.ok([200, 404].includes(res.status), `root returned ${res.status}`);
  });

  test('unknown route returns a structured 404', async () => {
    const res = await api('/api/definitely-not-a-route');
    expectStatus(res, 404, 'unknown route');
    assert.equal(res.body.success, false);
    assert.equal(res.body.statusCode, 404);
    assert.ok(res.body.path, 'error carries request path');
  });
});
