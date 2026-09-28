# A seven-day source-learning course

Status: implemented
Translation: current

[中文](2026-09-28-seven-day-learning.zh.md)

## Abstract

Lody's source and existing explanations span several runtimes, so a new reader needs a bounded route through responsibilities and failure behavior. The course follows a message through the local desktop, execution, persistence, display, and worktree recovery over seven days. It combines selected source readings, executable synthetic experiments, daily exercises, and a separate scored answer key. Experiments distinguish conceptual models from actual library and repository tests; completing them does not establish full desktop or cross-platform correctness.

## Decision and scope

The [course](../../../docs/learning/README.md) uses Chinese and assumes basic JavaScript/Git plus 2–3 hours per day. It includes a preparation check and optional deeper readings rather than requiring every learner to read all providers or the full execution service. It explains public local composition and labels draft intent separately from inspected implementation. No product guarantees, protocol, or runtime code change.

A directory-by-directory inventory would obscure the cross-module message lifecycle. An exhaustive framework tutorial would exceed the week. The chosen sequence teaches only the concepts needed for the next boundary and revisits them through failure scenarios. Answers are separate so learners can predict outcomes before checking them.

Day 1 imports real dependency-free platform helpers. Days 2, 3, and 5 use small boundary/cancellation/epoch models, explicitly not substitutes for production tests. Separate programs use the installed Effect and Loro libraries and a disposable Git repository. Existing suites cover history writes, local transport, windowed reads, dispatch decisions, and worktree GC. The final assignment extends an owning behavioral suite without inventing a defect or duplicating existing coverage.

## Evidence and related decisions

- Source baseline: `4f515900`. [Platform capabilities](../../../../packages/platform/src/capabilities.ts), [dispatch](../../../../apps/cli/src/session/session-dispatch-logic.ts), and [ConversationView](../../../../packages/components/src/lib/conversation-view/create-conversation-view-from-reader.ts) anchor the walkthrough.
- [Single HistoryWriter](../architecture/2026-09-07-single-history-writer.md), [windowed reader](../architecture/2026-09-10-windowed-reader-integration.md), and [dispatch coalescing](../bug-fix/2026-09-13-dispatch-check-coalescing.md) remain the owners of those earlier decisions; this course adds an educational route without superseding them.
- The existing [local data-plane explanation](../../../docs/cli-lib-local-loro-data-plane.md) described full Flock bundles. [Protocol](../../../../packages/shared/src/local-loro-data-plane.ts) and both transport ends use version-vector `exportJson(from)` deltas. The explanation now reflects that inspected implementation, including per-peer Flock versions. This corrects stale documentation, not protocol intent.

## Verification and limits

All seven example runs passed on Node 24.14.0. Five existing test files passed, totaling 113 tests: HistoryWriter, local transport regressions, ConversationView reader, dispatch logic, and worktree GC. Examples use synthetic input, explicit Promise barriers, and private temporary Git fixtures; they make no model calls.

After initializing the pinned submodules, `pnpm run docs check` passed with zero errors and 63 existing warnings. Formatting, typecheck, lint, i18n and code/platform/public-boundary checks passed. The public-boundary scanner matches a substring in Effect's documentation hostname; the course uses the official API source pinned to the installed Effect release instead, without changing the guard.

`pnpm check` initially hit sandbox data-directory permissions. Repeating it with a temporary `LODY_DATA_DIR` reached one existing failure in [speculative-worktree.test.ts](../../../../apps/cli/src/session/worktree/speculative-worktree.test.ts): the active-session recovery test expects no `isDurableSession` calls. The focused suite reproduces that failure (6 passed, 1 failed); its source and implementation are unchanged from the baseline. No real Agent conversation, desktop E2E, cold-open performance, or non-macOS acceptance was performed. Historical performance figures in linked notes apply only to their recorded conditions.
