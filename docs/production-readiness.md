# Vibress Studio release readiness

> **Planning update — 2026-11-06:** [World-class editor 9+ delivery plan](roadmaps/world-class-editor-9-plus-plan-2026-11-06.md) is the current proposed forward-looking program. The gate table below is a **historical 2026-11-05 assessment**, not a re-verification of Studio or Host after PRs #34/#130 merged. Recheck both current release SHAs, CI, unresolved Yjs/offline/a11y/performance gates and human sign-offs before any certification. The [2026-11-06 engineering audit](audits/world-class-editor-program-2026-11-06.md) records the deeper historical findings.

Reviewed 2026-11-05. Branch: `codex/studio-production-readiness-program`.
Verdict: **not certified; release approval pending**.

The [program implementation record](audits/studio-program-implementation-2026-11-05.md)
maps every engineering ticket, design deliverable and gate to implemented code,
automated evidence and remaining acceptance. It supersedes older test totals and
completion claims as the current record for this branch. The
[12-week PRD](roadmaps/product-quality-engineering-execution-plan-2026-11-05.md)
defines full acceptance criteria; the [release policy](release-policy.md) defines
distribution and rollback constraints.

## Gate status

| Gate | Current state |
| --- | --- |
| G0 Architecture | ADR-0001 and named runtime/package ownership await approval. |
| G1 Integrity | Local content-safety and synchronization regressions implemented; historical production fixtures and actual host persistence/conflicts still need acceptance. |
| G2 Security/reliability | Automated coverage/security regressions exist; independent review and final-candidate CI required. |
| G3 Design/accessibility | Three desktop engines and responsive recovery covered; real mobile, IME, screen-reader and design acceptance remain open. |
| G4 Performance | Reproducible browser frame proxies and comparison tooling added; accepted device/budget, INP and memory evidence remain open. |
| G5 Integration | Blocked by four persisted-core host differences and strict upstream Lexical declaration errors. Package rollback is scoped, not deployed-host rollback. |
| G6 Release | Independent engineering/security/design/product/release approvals and staged host rollout remain open. |

Green automated tests establish covered regressions. They do not establish a
9.2+/10 score, universal accessibility, absence of security bugs or production
approval. Earlier reports claiming certification or complete readiness are
historical assertions without independent sign-off.

## Release conditions

1. Pin candidate SHAs for both repositories, resolve ADR ownership, and execute
   shared historical fixtures and actual host save/reload/conflict workflows.
2. Pass the full `AGENT.md` verification sequence and strict clean installed
   consumer checks. Preserve failures in evidence; runtime-only checks cannot
   replace declaration correctness.
3. Obtain independent security, design, RTL/accessibility and product acceptance.
   Validate real devices, screen readers and host privacy/authorization controls.
4. Accept reproducible performance budgets and demonstrate a deployed rollback
   retaining the latest recoverable author content.
5. Record release-owner approval and expand a monitored host rollout only after
   content integrity and error metrics satisfy the accepted criteria.

Studio owns local editing, validation, rendering and recovery callbacks. The
host owns authentication, persistence, conflict policy, durable media, AI
authorization, collaboration and telemetry. No release, publication or
deployment is authorized by this document.

Not verified: manual WCAG 2.2 AA, real-device Arabic IME, Yjs interoperability and
deployed-host rollback. How to verify: execute the PRD browser/manual matrix and
host compatibility/rollback procedures, recording device, reviewer and source SHA.
