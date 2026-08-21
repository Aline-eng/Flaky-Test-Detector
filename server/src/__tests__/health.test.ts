import request from 'supertest';
import { createApp } from '../app';
import { createFakeTestsRepository } from '../api/__tests__/fakeTestsRepository';

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const app = createApp({ testsRepository: createFakeTestsRepository() });
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
