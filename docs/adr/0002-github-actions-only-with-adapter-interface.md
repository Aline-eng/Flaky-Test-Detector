# ADR 0002: GitHub Actions only for v1, behind a CI provider adapter interface

## Status

Accepted (Sprint 1).

## Context

Flaky test detection is a CI-observability problem, and CI systems vary widely in how they
expose run history: GitHub Actions, CircleCI, GitLab CI, Jenkins, and Buildkite all have
different APIs, different pagination models, different artifact-download mechanics, and
different (or absent) native JUnit XML support. Building against all of them at once — or
building an abstraction speculative enough to cover CI systems this project doesn't actually
ingest from — would slow down every other sprint without adding value a single-provider v1
doesn't already need.

At the same time, hardcoding Octokit calls directly into the detection/quarantine/dashboard
layers would make the ingestion boundary invisible and turn "add a second provider later"
into a rewrite instead of an addition.

## Decision

v1 ingests from **GitHub Actions only**, via Octokit, but the ingestion layer sits behind a
narrow `CiProviderAdapter` interface (`server/src/ingestion/types.ts`):

```ts
interface CiProviderAdapter {
  fetchRunsSince(params: FetchRunsParams): AsyncGenerator<NormalizedJobRun>;
}
```

`GithubActionsAdapter` is the only implementation. It normalizes GitHub's run/job/artifact
shapes into provider-agnostic `NormalizedJobRun` / `NormalizedTestResult` types before
anything downstream (the ingestion orchestrator, the Prisma store, the detection engine) ever
sees them. Everything downstream of `fetchRunsSince` — idempotent upserts, flip-rate scoring,
quarantine transitions, the dashboard — depends only on the normalized types, never on
Octokit or GitHub Actions' API shapes directly.

No second provider is implemented in v1. This isn't "build the abstraction and hope it fits
later" speculation — the interface is deliberately minimal (one method) because a single real
implementation is the only evidence available right now for what the boundary should look
like. A second provider, if one is ever added, is expected to reveal where the interface
needs to grow (e.g. CircleCI's artifact model differs enough from GitHub's that
`tryFetchJunitResultsForJob`'s per-job artifact-matching heuristic in
`GithubActionsAdapter` is explicitly GitHub-shaped, not part of the shared interface).

## Consequences

- Adding a second CI provider means writing a new `CiProviderAdapter` implementation and
  nothing else changes in `ingestRepo`, the detection engine, or the dashboard.
- The interface is intentionally not validated against a second real provider, so some
  reshaping is likely if one is ever added — accepted as the right cost given the
  alternative (guessing at the right shape with zero second data point).
- All GitHub-Actions-specific concerns (rate-limit backoff, JUnit-artifact-to-job matching
  heuristics, run/job pagination) live inside `GithubActionsAdapter` and
  `server/src/lib/octokitClient.ts`, not leaked into shared code.
