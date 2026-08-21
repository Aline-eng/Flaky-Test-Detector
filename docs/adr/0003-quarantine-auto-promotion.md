# ADR 0003: Auto-promotion out of quarantine after N consecutive clean runs

## Status

Accepted (Sprint 3).

## Context

Once a test is quarantined, something has to eventually bring it back to `STABLE` — otherwise
quarantine is a one-way door, and every genuinely-fixed flaky test accumulates forever as a
manual cleanup chore. The detection engine (ADR 0001) already produces a fresh
`STABLE`/`FLAGGED`/`QUARANTINED` classification on every recompute, so the simplest option
would be to just let a test flow back out of quarantine the moment its Wilson-lower-bound
confidence score dips back under the quarantine threshold.

That's the wrong mechanism specifically for *demotion*, even though it's the right mechanism
for *promotion into* quarantine. The confidence score is computed over a sliding window, so
right after a test starts passing consistently, the window still contains its recent flaky
history — the score falls gradually, not immediately, and can wobble back above the threshold
on a single subsequent failure. Using the same score for both directions would let a test
flap in and out of quarantine as the window slides, which defeats the entire point of
quarantine (a merge-blocking test that flickers stable/quarantined/stable is exactly the
"noisy, can't trust it" experience quarantine exists to eliminate).

## Decision

Demotion out of quarantine uses a **separate, simpler signal**: `N` consecutive clean
(passed) runs recorded *after* the test entered quarantine, tracked from the
`QuarantineEvent` that quarantined it (see `server/src/quarantine/stateMachine.ts`). The
flip-rate/confidence score is not consulted at all while a test is quarantined — only the
clean-run streak decides promotion back to `STABLE`. This makes the two directions
intentionally asymmetric: entering quarantine is confidence-interval-driven (statistical,
looks at the whole window), leaving it is evidence-driven (direct, looks only at what's
happened since quarantine began).

`N` defaults to **10** (`QUARANTINE_CLEAN_RUNS_REQUIRED`, env-configurable). Reasoning for the
specific number:

- It needs to be large enough that a lucky short streak (2-3 passes, well within the noise
  a genuinely flaky test can produce by chance) doesn't trigger premature promotion. If a
  test's true flip rate is even a modest ~15% (roughly the default `FLAKINESS_FLAG_THRESHOLD`),
  the probability of 10 consecutive passes by chance alone is well under 20% — an intentionally
  demanding bar, since the cost of promoting a still-flaky test back into the merge-blocking
  path is a real regression in trust, whereas the cost of a few extra CI runs spent confirming
  a fix is small.
- It needs to be small enough that a genuinely fixed test doesn't sit needlessly quarantined
  for weeks on a low-traffic repo. 10 runs is achievable within days on most actively-developed
  repos' CI cadence, which keeps the manual-cleanup burden this ADR is trying to avoid from
  reappearing in a different form ("why is this fixed test still quarantined").
- It's the same order of magnitude as `FLAKINESS_MIN_RUNS` (default 6) — the minimum evidence
  the detection engine itself requires before making any claim — so the two thresholds are
  philosophically consistent: both encode "single-digit-to-low-double-digit runs" as the
  project's working definition of "enough evidence," rather than picking an arbitrarily
  different bar for demotion than for detection.

No formal statistical optimization produced this number — it's a judgment call, which is why
it's environment-configurable rather than hardcoded. A repo with very high CI throughput might
reasonably tighten it; a repo where CI runs a handful of times a day might loosen it.

## Consequences

- Quarantine status is not a pure function of the latest `FlakinessScore` — it depends on
  quarantine history (`QuarantineEvent`) too, which is why quarantine state lives in its own
  append-only log rather than being derived solely from the scores table.
- A test can remain classified `QUARANTINED` by the detection engine's own score while
  already being promoted back to `STABLE` by the state machine, if its clean-run streak
  completes before the sliding-window score fully recovers. This is expected, not a bug: the
  state machine's status is authoritative for merge-blocking behavior; the detection score is
  a diagnostic signal, not the source of truth for current quarantine state.
- `QUARANTINE_CLEAN_RUNS_REQUIRED` may need retuning once this project has real
  multi-week data from `typeorm/typeorm` to observe actual promotion latency against.
