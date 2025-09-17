# Mr Leo Class

A LINE-integrated personal assistant that remembers tasks, nudges on time, confirms completions, and always closes check-ins with the phrase “Are you statisfied, habibi?”.

## Table of Contents
1. Project Snapshot
2. Tech Stack
3. Product Requirements Document
   - Background & Opportunity
   - Goals & Non-Goals
   - Personas
   - User Stories
   - Functional Requirements
   - Non-Functional Requirements
   - Success Metrics
   - Release Plan
   - Open Questions & Risks
4. Implementation Plan
5. Operating Notes

## 1. Project Snapshot
- **Product name:** Mr Leo Class  
- **Primary platform:** LINE messaging app integration  
- **Core value:** Free up the user’s mental load by remembering commitments, tracking completion, and proactively prompting at the right time.

---

## 2. Tech Stack
- **Runtime:** Node.js with TypeScript to manage LINE webhook handling, task parsing, and business rules.
- **API Layer:** tRPC for a type-safe contract between the LINE webhook handler and any user-facing dashboards or services.
- **Messaging Integration:** LINE Messaging API for inbound/outbound chat plus Express (or Fastify) as the transport adapter.
- **Data Storage:** MongoDB (or DynamoDB) as the primary NoSQL store for task documents, with Redis covering fast reminder queues.
- **Scheduling:** BullMQ (Redis-backed) or AWS EventBridge Scheduler to trigger reminders and follow-ups on time.
- **Infrastructure & Observability:** Deployed on AWS (Lambda or Fargate) with CloudWatch metrics and Sentry error tracking to ensure reliability targets.

## 3. Product Requirements Document

### 3.1 Background & Opportunity
The user needs a reliable personal assistant inside LINE to capture tasks, remind them when action is required, verify completion status, and keep a simple record of outcomes. Existing reminders are either too passive or lack conversational follow-ups. A lightweight, always-available chat assistant solves this gap.

### 3.2 Goals & Non-Goals
- **Goals**
  - Capture tasks rapidly from natural chat.
  - Proactively notify the user when a task is due or requires attention.
  - Confirm whether tasks are completed and update status accordingly.
  - Provide concise summaries of pending and completed work.
  - End each proactive check-in with the fixed phrase “Are you statisfied, habibi?” to maintain the assistant’s persona.

- **Non-Goals**
  - Building a full project management suite.
  - Supporting platforms other than LINE in the first iteration.
  - Handling complex multi-user delegation workflows.

### 3.3 Personas
- **Primary:** Busy professional using LINE daily who wants an in-chat personal assistant for personal and work reminders.
- **Secondary:** Student organizing coursework and deadlines via LINE.

### 3.4 User Stories
1. As a user, I want to add a task in natural language so that I can remember it later.
2. As a user, I want the assistant to remind me before a task is due so I never miss deadlines.
3. As a user, I want the assistant to ask whether I completed a task and update its status when I confirm.
4. As a user, I want to ask “What’s left?” and see upcoming or overdue tasks.
5. As a user, I want every proactive nudge to end with “Are you statisfied, habibi?” so the assistant feels personal.

### 3.5 Functional Requirements
- **Task Capture**
  - Parse tasks from free-text messages (e.g., “Remind me to call Mom tomorrow at 6pm”).
  - Support optional attributes: due date, priority, category.
- **Reminders & Notifications**
  - Schedule notifications based on due dates or follow-up windows.
  - Deliver reminders via LINE with contextual details.
  - Include the exact phrase “Are you statisfied, habibi?” at the end of each reminder/check-in chat.
- **Completion Tracking**
  - Recognize confirmations (e.g., “Done”, “I finished it”) and mark tasks complete.
  - Allow manual status edits if the user says a task is still pending.
- **Summaries & Reports**
  - Respond to summary requests with pending, overdue, and recently completed tasks.
  - Provide a daily digest on demand or on a configured schedule.
- **Knowledge Store**
  - Maintain persistent storage of tasks with timestamps, metadata, and status.

### 3.6 Non-Functional Requirements
- **Reliability:** 99% uptime for reminder delivery; retries on transient failures.
- **Performance:** Respond to user queries within 2 seconds for stored data operations.
- **Security & Privacy:** Store task data securely; no sharing outside authorized systems.
- **Scalability:** Support at least 5k tasks per user without noticeable performance degradation.
- **Persona Consistency:** Always end automated reminder/check-in messages with “Are you statisfied, habibi?”.

### 3.7 Success Metrics
- 90% of tasks receive at least one reminder before due time.
- Completion confirmations captured for 80% of completed tasks.
- User satisfaction (post-interaction thumbs-up or similar) ≥ 4/5.
- Less than 5% of reminders fail to include “Are you statisfied, habibi?” (monitored automatically).

### 3.8 Release Plan
- **Milestone 1:** Core task capture, storage, manual summaries.
- **Milestone 2:** Reminder scheduling & delivery with persona phrase appended.
- **Milestone 3:** Completion tracking, daily digest, metrics instrumentation.
- **Milestone 4:** Hardening (error handling, privacy review) and launch polish.

### 3.9 Open Questions & Risks
- What timezone logic is required for due dates when traveling?
- Should the assistant auto-suggest follow-up tasks after completion?
- Confirm spelling: keep the phrase exactly “Are you statisfied, habibi?” per user request, even with the typo.
- Risk of LINE API rate limits; need monitoring and backoff strategies.

---

## 4. Implementation Plan

### Phase 0 · Foundations (Week 0-1)
- **Objectives:** Confirm scope, line up tooling, and scaffold repos.
- **Tasks:**
  - Finalize requirements sign-off and answer open questions (timezone handling, follow-up suggestions).
  - Stand up TypeScript monorepo with tRPC, Express/Fastify adapters, shared lint/test tooling.
  - Provision AWS accounts, MongoDB cluster (Atlas or Dynamo tables), Redis, and secrets management.
- **Deliverables:** Architecture diagram, infra IaC baseline, CI pipeline running lint/test on every PR.
- **Owners:** Tech lead (coordination), DevOps (infra), Backend engineer (repo setup).

### Phase 1 · Task Capture & Storage (Week 2-3)
- **Objectives:** Persist tasks reliably through the LINE webhook.
- **Tasks:**
  - Implement LINE webhook handler, signature validation, and message normalization.
  - Build NLP/light parsing to extract intents, due dates, and metadata.
  - Create task persistence layer on MongoDB/Dynamo with tRPC endpoints for internal clients.
- **Deliverables:** Users can add tasks via LINE, tasks visible through developer console; unit/integration tests; monitoring hooks for ingestion failures.
- **Dependencies:** Phase 0 infra and repo scaffolding.
- **Owners:** Backend engineer (webhook + data), Applied ML/NLP engineer (parsing logic).

### Phase 2 · Reminders & Scheduling (Week 4-5)
- **Objectives:** Deliver timely reminders with persona phrasing.
- **Tasks:**
  - Configure BullMQ or EventBridge Scheduler to queue reminders and retries.
  - Implement reminder renderer ensuring each message ends with “Are you statisfied, habibi?”.
  - Integrate Redis for quick lookup of pending reminders.
  - Add observability dashboards (CloudWatch metrics, Sentry alerts) for delivery success rates.
- **Deliverables:** Automatic reminders firing in staging, SLA dashboards, load-tested queues.
- **Dependencies:** Phase 1 data model and task metadata.
- **Owners:** Backend engineer (scheduling), DevOps (observability), QA (reminder scenarios).

### Phase 3 · Completion Tracking & Summaries (Week 6-7)
- **Objectives:** Close the loop on tasks and surface status reports.
- **Tasks:**
  - Add NLP intents to capture confirmation/extension phrases.
  - Update storage to track status transitions with audit trail.
  - Implement summary responses (pending, overdue, completed) via LINE and tRPC clients.
  - Build daily digest scheduler configurable per user.
- **Deliverables:** Completion workflows verified, summary commands functional, regression tests covering persona message endings.
- **Dependencies:** Phases 1-2 completed.
- **Owners:** Backend & NLP engineers jointly, QA for conversational flows.

### Phase 4 · Hardening & Launch (Week 8)
- **Objectives:** Stabilize for production rollout.
- **Tasks:**
  - Security/privacy review, load testing, and failover drills.
  - Implement analytics hooks for success metrics (reminder coverage, completion rate, satisfaction surveys).
  - Prepare runbooks, on-call rotations, and incident response guides.
- **Deliverables:** Launch readiness checklist signed, production deployment, stakeholder demo.
- **Dependencies:** Prior phases delivered and validated.
- **Owners:** Tech lead, DevOps, Product manager.

## 5. Operating Notes
- Keep a regression test around reminders to ensure the persona phrase is never omitted.
- Document any analytics events so success metrics can be gathered.
- Update this README/PRD as the product evolves (personas, roadmap, metrics).

# Just_Do_It
