# ADR-0002: Preserve persisted data and separately admit editable content

- Date: 2026-11-05
- Status: Implemented for branch review; architecture/release sign-off pending
- Scope: STU-201–205, STU-301–303; schema `vibress-studio` v1

Persisted validation must not strip future envelope, editor or node fields.
Migration retains the original JSON representation, normalizes legacy card
types, checks resource budgets, and rejects foreign schemas/non-JSON values
with recoverable errors. No document version is changed.

Editing has a stricter boundary: the pinned Lexical runtime can edit only known
node versions, fields and placements it can serialize. Unknown node fields are
preserved for recovery and rendering, but block editing when Lexical would drop
them. Built-in interactive card payloads are validated without applying Zod's
defaults or stripping fields from the stored payload. Malformed captions retain
their separate explicit recovery behavior. Plugin code remains trusted/in-process.

The editor retains accepted envelope metadata in outgoing snapshots. Invalid
roots never become empty documents. Incoming invalid data pauses the mounted
editor and outgoing callbacks, preserving its draft/history. Recovery export is
host-owned and receives the rejected source plus current raw editor state.

Lexical 0.13 compatibility code restores supported legacy numeric formats and
missing text defaults, plus inherited element properties omitted by table/row
imports. Outgoing table direction uses the same descendant fallback as public
rendering. This does not certify every multilingual editing scenario.

Resource defaults remain the existing 5 MiB / 50,000-node / depth-64 policy.
`maxStringBytes` adds an opt-in smaller text/attribute budget; real publishing
samples and operational budgets still need owner acceptance. Failures never
truncate content. Hosts must retain original input and manage saves in flight.

Alternatives rejected: globally replacing unknown nodes, coercing malformed
fields, applying card-schema defaults to persisted payloads, or silently
substituting an empty editor. Those approaches can discard user data.

Compatibility risk: inputs previously admitted but lossy in Lexical now enter
recovery. This is deliberate and needs review against real historical fixtures
before rollout. Host runtime parity is not implied by shared schema/version.

Rollback requires no migration, but reinstates the fixed defects. In particular,
older runtimes may strip unknown envelope metadata; do not enable editing after
rollback without the host's compatibility/recovery check.
