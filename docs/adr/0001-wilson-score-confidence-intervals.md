# ADR 0001: Wilson score confidence intervals instead of a raw failure-rate threshold

## Status

Accepted (Sprint 2).

## Context

The detection engine has to turn a test's run history into a single decision: is this test
flaky enough to flag, or quarantine? The obvious first approach is a naive threshold on the
failure rate — "if more than X% of the last N runs failed, flag it." Two problems make that
approach actively wrong for this use case, not just imprecise:

1. **A consistently broken test isn't flaky.** A test that fails 100% of the time on every
   run has a 100% failure rate but zero flip-flopping — it's just broken, and quarantining it
   would hide a real regression rather than surface a CI-noise problem. Flakiness is about
   _inconsistency_ (pass, fail, pass, fail, ...) on ostensibly the same code, not about
   failure frequency on its own. This is why the engine's primary signal is **flip rate** —
   the count of pass↔fail transitions divided by the number of consecutive-run pairs — not
   the raw failure percentage.

2. **A raw percentage doesn't know how much evidence it's built on.** "1 flip out of 2 runs"
   and "25 flips out of 50 runs" both compute to a 50% flip rate under a naive percentage, but
   they are not equally trustworthy. A test with only 2 runs in its window could have flipped
   once for any number of one-off reasons (a runner hiccup, a genuinely fixed bug, a fluke);
   treating that the same as a sustained 50% flip rate over 50 runs — and quarantining both
   identically — produces both false positives (new tests, low-traffic tests, or tests that
   just started running get quarantined on noise) and false negatives (a naive threshold has
   no principled way to be more lenient on thin data without an arbitrary minimum-sample
   cutoff bolted on separately).

## Decision

Score each test using the **Wilson score confidence interval**'s lower bound on the flip
rate, not the flip rate itself:

1. Compute `flips` (pass↔fail transitions) and `trials` (consecutive-run pairs, i.e.
   `nonSkippedRuns - 1`) over the sliding window.
2. Compute the Wilson score interval for the proportion `flips / trials` at 95% confidence
   (`z = 1.96`).
3. Use the interval's **lower bound** as the test's `confidenceScore`. This is the number
   compared against the `FLAKINESS_FLAG_THRESHOLD` / `FLAKINESS_QUARANTINE_THRESHOLD` env
   thresholds.

The Wilson interval was chosen over the alternative (simpler) Wald/normal-approximation
interval because Wilson stays well-behaved at small sample sizes and at proportions near 0 or
1 — exactly the regime a newly-observed or rarely-run test sits in — whereas the Wald interval
can produce nonsensical bounds (outside `[0, 1]`, or a zero-width interval at `p=0` or `p=1`)
in that same regime. Wilson requires no extra numerical safeguards for those edge cases.

Taking the **lower bound** specifically (rather than the point estimate or the upper bound)
means the engine is deliberately conservative: it only calls a test flaky once there's enough
evidence that even the _pessimistic_ end of the plausible-flip-rate range clears the
threshold. A test with a thin run history needs a much higher observed flip rate to cross the
same threshold than a test with a long history, because its interval is wider and its lower
bound sits further below its raw ratio. This produces the sample-size-aware behavior a naive
percentage threshold cannot: as evidence accumulates, the interval narrows and the lower bound
rises toward the true flip rate on its own, with no separate minimum-sample-size heuristic
required to avoid flagging noise. (A hard floor, `FLAKINESS_MIN_RUNS`, still exists as a
belt-and-suspenders guard — see the code comment in `server/src/detection/types.ts` — but the
Wilson lower bound is already doing most of that work statistically.)

## Consequences

- A test needs both a real flip pattern _and_ enough runs to back it up before it's flagged
  or quarantined — reduces false positives on new or low-traffic tests.
- The three-tier classification (`STABLE` / `FLAGGED` / `QUARANTINED`) is a pure function of
  one number (the confidence score) against two configurable thresholds, which keeps the
  classification logic simple even though the underlying statistic is more sophisticated than
  a raw percentage.
- The tradeoff is slower reaction time: a genuinely flaky test with very few runs so far will
  sit at `STABLE` longer than it would under a naive threshold, because the interval hasn't
  narrowed yet. This is treated as the right tradeoff for a system that quarantines tests and
  therefore has a real cost to false positives (a wrongly quarantined test stops blocking
  merges, silently hiding real failures).
- Thresholds (`FLAKINESS_FLAG_THRESHOLD`, `FLAKINESS_QUARANTINE_THRESHOLD`) and window
  parameters (`FLAKINESS_WINDOW_SIZE`, `FLAKINESS_WINDOW_MAX_AGE_DAYS`, `FLAKINESS_MIN_RUNS`)
  are all environment-configurable rather than hardcoded, since the right sensitivity depends
  on a repo's actual CI volume and risk tolerance — see `server/src/config/env.ts`.
