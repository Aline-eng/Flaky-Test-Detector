import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseJunitXml } from '../junitParser';

const fixturePath = path.join(__dirname, '..', '__fixtures__', 'sample-junit.xml');
const fixtureXml = readFileSync(fixturePath, 'utf-8');

describe('parseJunitXml', () => {
  it('parses every testcase across all testsuites', () => {
    const results = parseJunitXml(fixtureXml);
    expect(results).toHaveLength(4);
  });

  it('marks a clean testcase as passed with its duration in milliseconds', () => {
    const results = parseJunitXml(fixtureXml);
    const passed = results.find((r) => r.name === 'creates a user');

    expect(passed).toEqual({
      suite: 'UserRepository',
      name: 'creates a user',
      filePath: 'test/UserRepository.test.ts',
      status: 'passed',
      durationMs: 512,
      errorMessage: undefined,
    });
  });

  it('marks a <failure> testcase as failed and captures the message', () => {
    const results = parseJunitXml(fixtureXml);
    const failed = results.find((r) => r.name === 'rejects a duplicate email');

    expect(failed?.status).toBe('failed');
    expect(failed?.errorMessage).toBe('expected 409 but got 200');
  });

  it('marks an <error> testcase as errored and captures the message', () => {
    const results = parseJunitXml(fixtureXml);
    const errored = results.find((r) => r.name === 'times out on a slow connection');

    expect(errored?.status).toBe('errored');
    expect(errored?.errorMessage).toBe('connect ETIMEDOUT');
  });

  it('marks a <skipped> testcase as skipped', () => {
    const results = parseJunitXml(fixtureXml);
    const skipped = results.find((r) => r.name === 'soft-deletes a user');

    expect(skipped?.status).toBe('skipped');
  });

  it('returns an empty array for a document with no testsuite elements', () => {
    expect(parseJunitXml('<somethingElse></somethingElse>')).toEqual([]);
  });

  it('parses a bare <testsuite> root without a <testsuites> wrapper', () => {
    const xml = `<testsuite name="Solo"><testcase classname="a.ts" name="works" time="0.01" /></testsuite>`;
    const results = parseJunitXml(xml);

    expect(results).toEqual([
      {
        suite: 'Solo',
        name: 'works',
        filePath: 'a.ts',
        status: 'passed',
        durationMs: 10,
        errorMessage: undefined,
      },
    ]);
  });
});
