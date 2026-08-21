import { countFlips, type RunOutcome } from '../flipRate';

describe('countFlips', () => {
  const cases: Array<{ name: string; outcomes: RunOutcome[]; expected: number }> = [
    { name: 'empty sequence', outcomes: [], expected: 0 },
    { name: 'single run', outcomes: ['pass'], expected: 0 },
    { name: 'all passes', outcomes: ['pass', 'pass', 'pass'], expected: 0 },
    { name: 'all failures', outcomes: ['fail', 'fail', 'fail'], expected: 0 },
    { name: 'one flip', outcomes: ['pass', 'fail'], expected: 1 },
    {
      name: 'alternating every run',
      outcomes: ['pass', 'fail', 'pass', 'fail'],
      expected: 3,
    },
    {
      name: 'one flip buried in a stable run of failures',
      outcomes: ['fail', 'fail', 'pass', 'pass'],
      expected: 1,
    },
    {
      name: 'flip, flip back',
      outcomes: ['pass', 'pass', 'fail', 'pass'],
      expected: 2,
    },
  ];

  it.each(cases)('$name -> $expected flips', ({ outcomes, expected }) => {
    expect(countFlips(outcomes)).toBe(expected);
  });
});
