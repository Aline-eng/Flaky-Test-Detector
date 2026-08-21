import { XMLParser } from 'fast-xml-parser';
import type { NormalizedTestResult } from './types';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  textNodeName: '_text',
});

interface RawTestCase {
  classname?: string;
  name: string;
  time?: string | number;
  failure?: unknown;
  error?: unknown;
  skipped?: unknown;
}

interface RawTestSuite {
  name?: string;
  testcase?: RawTestCase | RawTestCase[];
}

interface RawDocument {
  testsuites?: { testsuite?: RawTestSuite | RawTestSuite[] };
  testsuite?: RawTestSuite;
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function extractMessage(node: unknown): string | undefined {
  if (typeof node === 'string') return node;
  if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    if (typeof obj.message === 'string') return obj.message;
    if (typeof obj._text === 'string') return obj._text;
  }
  return undefined;
}

/**
 * Parses a JUnit XML report (either a bare <testsuite> root or a <testsuites> wrapper
 * around multiple <testsuite> elements) into normalized per-test results.
 */
export function parseJunitXml(xml: string): NormalizedTestResult[] {
  const doc = xmlParser.parse(xml) as RawDocument;

  const suites: RawTestSuite[] = doc.testsuites
    ? toArray(doc.testsuites.testsuite)
    : doc.testsuite
      ? [doc.testsuite]
      : [];

  const results: NormalizedTestResult[] = [];

  for (const suite of suites) {
    const suiteName = suite.name ?? 'unknown';

    for (const testcase of toArray(suite.testcase)) {
      const durationMs =
        testcase.time !== undefined ? Math.round(Number(testcase.time) * 1000) : undefined;

      let status: NormalizedTestResult['status'] = 'passed';
      let errorMessage: string | undefined;

      if (testcase.failure !== undefined) {
        status = 'failed';
        errorMessage = extractMessage(testcase.failure);
      } else if (testcase.error !== undefined) {
        status = 'errored';
        errorMessage = extractMessage(testcase.error);
      } else if (testcase.skipped !== undefined) {
        status = 'skipped';
      }

      results.push({
        suite: suiteName,
        name: testcase.name,
        filePath: testcase.classname,
        status,
        durationMs,
        errorMessage,
      });
    }
  }

  return results;
}
