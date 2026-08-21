import request from 'supertest';
import { createApp } from '../../app';
import { createFakeTestsRepository } from './fakeTestsRepository';
import type { TestDetail, TestListItem } from '../testsRepository';

const TOKEN = 'test-dashboard-token'; // matches server/src/test-setup.ts

const LIST_ITEM: TestListItem = {
  id: 'test-1',
  repo: 'o/r',
  suite: 'unit',
  name: 'flaky it',
  latestScore: {
    status: 'FLAGGED',
    confidenceScore: 0.2,
    flipRate: 0.3,
    computedAt: new Date('2026-01-01'),
  },
  quarantineStatus: 'FLAGGED',
};

const DETAIL: TestDetail = {
  ...LIST_ITEM,
  filePath: 'test/flaky.test.ts',
  firstSeenAt: new Date('2025-01-01'),
  runs: [],
  scoreHistory: [],
  quarantineHistory: [],
};

function buildApp() {
  const repository = createFakeTestsRepository({
    listByRepo: { 'o/r': [LIST_ITEM] },
    detailById: { 'test-1': DETAIL },
  });
  return { app: createApp({ testsRepository: repository }), repository };
}

describe('GET /api/tests', () => {
  it('rejects requests without a bearer token', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/api/tests').query({ repo: 'o/r' });
    expect(res.status).toBe(401);
  });

  it('rejects requests with the wrong token', async () => {
    const { app } = buildApp();
    const res = await request(app)
      .get('/api/tests')
      .query({ repo: 'o/r' })
      .set('Authorization', 'Bearer wrong-token');
    expect(res.status).toBe(401);
  });

  it('requires a repo query parameter', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/api/tests').set('Authorization', `Bearer ${TOKEN}`);
    expect(res.status).toBe(400);
  });

  it('lists tests for the given repo', async () => {
    const { app } = buildApp();
    const res = await request(app)
      .get('/api/tests')
      .query({ repo: 'o/r' })
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('flaky it');
  });
});

describe('GET /api/tests/:id', () => {
  it('returns 404 for an unknown test id', async () => {
    const { app } = buildApp();
    const res = await request(app)
      .get('/api/tests/does-not-exist')
      .set('Authorization', `Bearer ${TOKEN}`);
    expect(res.status).toBe(404);
  });

  it('returns the full test detail', async () => {
    const { app } = buildApp();
    const res = await request(app)
      .get('/api/tests/test-1')
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('test-1');
    expect(res.body.filePath).toBe('test/flaky.test.ts');
  });
});

describe('POST /api/tests/:id/quarantine', () => {
  it('rejects an invalid body', async () => {
    const { app } = buildApp();
    const res = await request(app)
      .post('/api/tests/test-1/quarantine')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ status: 'NOT_A_STATUS' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown test id', async () => {
    const { app } = buildApp();
    const res = await request(app)
      .post('/api/tests/does-not-exist/quarantine')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ status: 'STABLE', reason: 'confirmed fixed' });
    expect(res.status).toBe(404);
  });

  it('applies a manual override and records the reason', async () => {
    const { app, repository } = buildApp();
    const res = await request(app)
      .post('/api/tests/test-1/quarantine')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ status: 'STABLE', reason: 'confirmed fixed by PR #42' });

    expect(res.status).toBe(201);
    expect(repository.overrides).toEqual([
      { testId: 'test-1', status: 'STABLE', reason: 'confirmed fixed by PR #42' },
    ]);
  });
});
