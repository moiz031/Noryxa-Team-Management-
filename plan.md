# Production Completion Plan

## Current status

- Core authentication, admin/employee roles, organization, projects, tasks, reports, leave, feed, notifications, Storage foundations, Realtime foundations, RLS, and additive migrations exist.
- Batch 5 automation and later additive hardening migrations are applied to the linked live Supabase project.
- Storage metadata/object workflows now validate uploader-scoped paths, object existence, and bounded sizes across documents, avatars, tasks, and daily reports; signed downloads and coordinated cleanup are implemented.
- Authenticated full-system security verification passed, including project/task/notification/feed/Storage isolation, role escalation prevention, leave approval protection, Realtime notification delivery, and automation idempotency.
- Typecheck and production build pass; ESLint passes with existing warnings.
- Dedicated no-refresh Realtime E2E now passes task, report, leave request/approval, mention notification, and notification read-state delivery after authorized fixtures and publication coverage were corrected.

## Staged execution

1. **Live verification gate**
   - Confirm Supabase CLI login/link and migration status.
   - Run migration dry-run, then apply only if clean.
   - Verify project-root `.env.local` variable names without printing values.
   - Run authenticated RLS, route, Storage, Realtime, and Batch 5 automation checks.
   - Fix only genuine, test-proven defects.

2. **Core workflow completion**
   - Employee activation and profile workflows.
   - Functional admin/employee dashboards.
   - Departments and project/client workflow gaps.
   - Reports, attendance, leave, announcements, notifications, and activity-center UI/API gaps.

3. **Storage and operations hardening**
   - Complete document, avatar, report, project, company, SOP, and template file lifecycles.
   - Add schedule/holiday/leave-aware attendance and automation behavior.
   - Complete task/project authorization and activity consistency audits.

4. **Platform capabilities**
   - Secure global search.
   - Analytics/performance data and transparent scorecards.
   - Organization settings, bounded admin exports, API hardening, rate limiting, and database performance review.

5. **Quality and production gates**
   - Add real unit/integration/E2E/security tests with isolated fixtures.
   - Harden audit logs, observability, privacy/data minimization, backup/recovery documentation, and API/database contracts.
   - Reconcile the feature matrix and run the final production-readiness gate.

6. **Explicitly deferred**
   - Final UI/UX redesign, visual QA, deployment, billing, and external delivery providers remain out of scope until the technical gates pass.

## Latest verification result

- Live migration dry-run: PASS, database up to date.
- Authenticated RLS/full-system security: PASS.
- Strict authenticated Realtime E2E: PASS.
- Typecheck: PASS.
- Production build: PASS.
- ESLint: PASS with existing warnings.
- Protected route verification: PASS.
- UI/front-end design batches remain intentionally deferred.

## Approval gate

No application code or schema changes should be made until the live verification gate is observable and approved. Any schema change must be additive, dry-run reviewed, and applied without reset or destructive edits.
