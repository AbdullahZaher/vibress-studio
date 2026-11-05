# Changelog

## Unreleased — production readiness program

- Preserve active drafts/history on rejected external document updates; add
  host-owned recovery export and Arabic/English recovery messages.
- Preserve envelope metadata, reject invalid roots/foreign schemas/non-JSON
  values, and separate persisted validation from safe editor admission.
- Validate built-in card inputs and add configurable string limits and versioned
  publishing fixtures. Retain unknown data for recovery.
- Guard pending media operations after unmount and superseded replacements;
  replace simulated upload tests with actual React/Lexical component scenarios.
- Version and validate trusted plugin registration, snapshot ownership and
  document unsupported toolbar capabilities accurately.
- Extend desktop browser checks to Chromium, Firefox and WebKit; fix card
  selection, keyboard access and block-hover context handling.
- Add clean tarball consumers, a scoped previous-artifact rollback exercise,
  immutable host-core comparison and reproducible browser workloads.

Release blockers include strict Lexical declaration checking, host compatibility
differences and independent/manual acceptance. No production-readiness score,
public release, deployed rollback or host-runtime replacement is claimed.
