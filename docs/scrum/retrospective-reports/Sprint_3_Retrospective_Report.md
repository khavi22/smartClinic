# Sprint 3 Retrospective Report

## Sprint Overview

Sprint 3 shifted the team's focus from infrastructure hardening toward feature delivery and user experience refinement. Key workstreams included the patient clinic search and filtering overhaul, staff onboarding and invitation workflows, patient queue management, admin dashboard improvements, and staff availability scheduling. The sprint was characterised by meaningful feature progress and growing TDD discipline, but was impacted by time pressure from academic commitments, a late-shifted client meeting, and recurring friction from uncoordinated database and UI changes made without team-wide sign-off. The absence of mid-sprint requirement changes — a first for the project — allowed the team to focus on quality, though delivery pace will need to increase in the next sprint to stay on schedule.

---

## What Went Well

- **Feature Breadth and Delivery:** The team delivered across multiple complex domains in a single sprint — clinic search filtering, staff invitation and approval workflows, patient queue management, admin profile locking, and staff availability scheduling — demonstrating growing capacity for parallel feature development.

- **Staff Onboarding Workflow:** The staff invitation lifecycle was cleanly implemented as a state machine (`pending → approved → rejected → removed`), with role enforcement via Firebase Custom Claims preventing privilege escalation and a branded email service handling all notification types.

- **TDD Adoption:** Multiple team members applied Test-Driven Development practices this sprint — writing tests before implementing methods. This produced more intentional, better-structured code and improved confidence in the service layer. Team members who had struggled with testing in Sprint 2 reported notable improvement in their test quality and reasoning.

- **Clinic Filtering UX Overhaul:** The patient clinic search interface was redesigned from dropdown-heavy forms to a chip-based, radio-button layout, improving interactivity and visual consistency. Filtering now supports facility type, province, district, region, and services offered.

- **Database Structure Simplification:** Services were migrated from subcollections to array fields within clinic documents, reducing query complexity and improving filter accuracy — a pragmatic structural improvement that simplified the codebase.

- **Queue Logic Design:** The patient queue system was thoughtfully designed with South African clinic realities in mind — a 15-minute priority window for booked patients before they revert to walk-in status, and deliberately under-booked slots to accommodate walk-in patients. Queues are stored as subcollections under clinics, with each day's queue stored separately.

- **Admin Profile Safety:** A locked clinic profile system was introduced, where fields are disabled by default and only become editable on explicit admin action, automatically re-locking after save. This reduces the risk of accidental data modification.

- **Full-Stack Flow Understanding:** Several team members articulated a clearer mental model of the end-to-end code flow (frontend → routes → controllers → services → Firestore), which directly improved the quality of their tests and implementations.

- **Collaborative User Story Ownership:** At least one user story was completed collaboratively with division of responsibilities across backend, UX, and diagramming — validating the Sprint 2 recommendation to move away from individual silos. The experience reinforced that shared ownership improves overall output quality.

---

## Areas for Improvement

- **Uncoordinated Database Schema Changes:** A developer modified the Firestore clinic data structure (from subcollections to an array field) without prior team communication, causing integration failures in frontend and backend branches that were still built against the old structure. This is a continuation of the schema alignment problem identified in Sprint 2 and requires a formal sign-off process.

- **Late-Stage Deployment Failures:** The NodeMailer email service failed unexpectedly after cloud deployment, causing significant last-minute stress and troubleshooting near the submission deadline. Deployment was not tested with sufficient lead time to absorb and resolve such failures.

- **Time Management and Academic Pressure:** The team was delayed in starting sprint work due to academic test commitments. While the team caught up, the compressed timeline created pressure that contributed to rushed decisions and late-breaking issues.

- **Monolithic Service Files:** Core service files — particularly the queue service — grew to an unmanageable size, becoming difficult to navigate, test, and maintain. Modularisation was not applied proactively.

- **UI–Logic Synchronisation Failures:** Redesigning filter inputs from dropdowns to chips and radio buttons broke underlying JavaScript event handlers and input label linkages, because frontend structural changes were not coordinated with the logic layer. Changes in form architecture require explicit cross-functional alignment.

- **Multi-Role Identity Conflict:** When a user attempted to transition from the Patient to Staff role using the same email address, the system failed to handle the case gracefully and required manual database intervention. No formal identity-switching mechanism exists.

- **Email Normalisation Gaps:** Inconsistent email casing in data inputs caused silent authentication and lookup failures (e.g., "invitation not found" errors). String normalisation was not applied uniformly at data ingestion points.

- **Client Meeting Delay:** The rescheduling of the client meeting to a later date has created a schedule risk. The team acknowledged it will need to increase delivery velocity in the next sprint to compensate.

---

## Action Items for Next Sprint

| Action Item | Reason | Related Backlog Area |
|---|---|---|
| Enforce a Pre-Implementation Sign-off for Database Schema Alterations | A developer unilaterally modified the Firestore clinic architecture from subcollections to an array field, breaking working frontend and backend branches that had not been updated. | Team Communication & Database Governance |
| Implement String Normalisation Middleware for Data Ingestion | Inconsistent character casing during data inputs introduced silent authentication and routing failures (e.g., email lookups throwing "invitation not found" exceptions). | Backend Services & Data Validation |
| Incorporate a 72-Hour Deployment Buffer Zone Prior to Sprint Review | Severe deployment delays and last-minute stress occurred when the NodeMailer service unexpectedly failed after deployment to the cloud provider. | Release Management / CI-CD Workflow |
| Deconstruct Monolithic Modules into Domain-Specific Classes | Critical service files (such as the queue service) scaled past stable thresholds, becoming large, complex, and unmaintainable. | Project Architecture & Refactoring |
| Create a Cross-Functional Task Alignment Matrix for UI Form Restructuring | Redesigning filter UI elements from dropdowns to chip selections broke underlying event-handling linkages and input labels because JavaScript hooks were not synced with the structural changes. | Frontend-Backend Logic Integration |
| Introduce a Multi-Role Identity Switching Architecture or Explicit Role Constraint | System validation failed when a single email account attempted to transition roles across collections (e.g., Patient to Staff), requiring manual database overwrites. | Identity & Access Control Layer |
| Establish Shared Core User Story Allocation Rules During Sprint Planning | Treating stories as single-developer silos increased downstream delivery lag, whereas collaborating in pairs accelerated TDD test creation and workflow analysis. | Agile Methodology / Backlog Management |

---

## Key Takeaways

Sprint 3 marked a notable maturation point for the team. TDD adoption deepened, feature delivery broadened, and at least one team member explicitly recognised the value of collaborative user story ownership — a direct carry-forward from Sprint 2's retrospective. The queue logic design, in particular, demonstrated contextual thinking about the real-world environment the product will serve.

The sprint's most consequential lesson reinforces a pattern from Sprint 2: **unilateral changes to shared data structures cause disproportionate disruption**. Whether it is a schema migration (Sprint 2) or a subcollection-to-array restructure (Sprint 3), the cost of not communicating architectural changes before implementation is consistently high. A formal pre-implementation sign-off process for database and structural changes is now a critical process requirement, not merely a recommendation.

Deployment reliability also surfaces as a new concern. The NodeMailer failure is a reminder that **deployment is not the end of the development process — it is the beginning of a verification phase** that requires time to complete. Building a buffer zone into sprint planning will reduce the risk of submission-deadline incidents.

Finally, the team has grown technically but must now grow in pace. With the client meeting delayed and the project timeline tightening, the next sprint must prioritise efficient delivery of outstanding user stories through the shared ownership and cross-functional alignment practices the team has been progressively building toward.
