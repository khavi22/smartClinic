# Sprint 4 Retrospective Report

## Sprint Overview

Sprint 4 marked the final major feature delivery phase of the SmartClinic project, combining bug fixes from earlier sprints with the introduction of advanced capabilities: a machine learning wait-time prediction microservice, admin reporting dashboards, staff utilisation analytics, automated email notifications, a walk-in patient queue workflow, and enhanced clinic onboarding. The sprint demonstrated significant technical ambition and delivered functional end-to-end features, but was characterised by recurring integration failures stemming from insufficient code review practices, inconsistent implementation standards, and the continued cost of retrofitting tests after feature completion. Cross-cutting reflections from multiple team members converge on a shared lesson: software quality is determined as much by communication and system thinking as by individual coding ability.

---

## What Went Well

- **Machine Learning Microservice Delivery:** A Flask-based wait-time prediction microservice was successfully deployed, featuring a Gradient Boosting regression model, cyclical trigonometric time encoding for hour-of-day and weekday features, and a hybrid dual-pathway prediction engine that switches between historical ML predictions and live queue telemetry depending on the clinic's current state.

- **Synthetic Data Bootstrapping:** A synthetic data generation pipeline was implemented inside the ML microservice to resolve cold-start failures when insufficient Firestore queue history exists. This ensured the prediction engine could initialise reliably in first-deployment scenarios — a pragmatic and production-aware engineering solution.

- **Admin Reporting Suite:** Two administrative reports — appointment no-show rate and average wait time — were delivered as standalone pages with a reusable fetch–filter–aggregate–render pattern. The shared architecture meant the second report was largely an extension of the first, validating the soundness of the design.

- **Staff Utilisation Dashboard:** A detailed analytics dashboard was built by aggregating nested Firestore queue subcollections, attributing patient interactions to individual staff members via `addedBy` and `updatedBy` fields, and cross-referencing scheduled availability. The report surfaces workload metrics and is exportable as both CSV and styled PDF via jsPDF with autotable.

- **Email Notification System:** Automated Nodemailer email notifications were implemented for appointment confirmations and cancellations. Critically, the email logic was wrapped in its own `try/catch` block so that a failed email dispatch never blocks an appointment from being saved — a deliberate defensive programming decision reflecting production-quality thinking.

- **Walk-In Queue Workflow:** The walk-in patient feature was redesigned so that a staff member adds the patient directly rather than allowing remote self-registration — mirroring real emergency walk-in handling and preventing patients from inflating queue sizes without attending. A Nodemailer notification confirms the patient's time slot on addition.

- **Per-Clinic Slot Capacity Feature:** A configurable slot capacity slider was implemented across service, controller, and frontend layers, with the field added to `createClinic` defaults to ensure new clinics always carry an explicit value.

- **JWT Token Refresh Architecture:** The admin onboarding portal was refactored to dynamically request a fresh Firebase ID token before every secured API request, resolving intermittent authorisation failures caused by token expiry during active sessions.

- **Object-Oriented Frontend Architecture:** The administrator onboarding portal frontend was redesigned using a class-based pattern, improving component state isolation, error handling consistency, and overall maintainability.

- **Queue Position and Wait-Time Logic:** Patient queue position calculation was correctly implemented using `createdAt` ordering, with a collaborative refinement that replaced a naive fixed-duration model with one combining the patient's appointment start time against the cumulative service duration of patients ahead in queue.

- **TDD Workflow Improvement:** Multiple team members applied TDD more deliberately this sprint than in previous ones, reporting improved code structure and confidence in their implementations as a result.

---

## Areas for Improvement

- **Insufficient Code Review Before Merging:** A `setClinicFormEditable` function using broad DOM selectors was merged to main without review and silently disabled form inputs across modules — including a teammate's slot capacity slider — making a working feature appear broken post-merge. This is a direct consequence of inadequate pull request review practices and insufficiently scoped DOM manipulation.

- **Inconsistent Feature Implementations Across the Codebase:** Appointment rescheduling was implemented two different ways in the same system — one approach deleted and recreated the document, while the other patched the existing record in place. This inconsistency introduced avoidable bugs and reflected a lack of agreed-upon implementation standards before development began.

- **Analytics Metrics Sourced from Incorrect Data:** The average wait time report calculated its metric from the static `serviceDuration` field on appointment documents — measuring scheduled slot length rather than actual patient wait time. The correct data source (`estimatedWaitTime` in the queue subcollection) was identified retrospectively. This reflects an insufficient data modelling phase before feature implementation.

- **State-Dependent Mutations Without Pre-Fetch Guards:** The email notification service attempted to read appointment document details after a deletion pipeline had already completed, causing silent failures. A pre-fetch hook pattern — reading required state before any destructive operation — was not enforced.

- **Retrofitting Tests Onto Completed Features:** Several team members explicitly acknowledged that writing tests after implementation was significantly harder than writing them upfront, and that tightly coupled code exposed during the testing phase required rework. TDD was applied more than in previous sprints but not consistently enough to prevent these issues.

- **Mock Maintenance Overhead:** Adding a new Firestore call inside `createAppointment` (to read `slotCapacity`) caused cascading test failures in existing mocks that did not account for the new call. This highlighted the need to maintain mocks that accurately reflect the actual call graph, not just the immediate test path.

- **Data Architecture Mismatches in Reporting:** Multiple reporting features encountered friction because the Firestore structure did not match the data shape needed for analytics. This pattern — identified across no-show rates, wait times, and staff utilisation — points to the persistent absence of a deliberate data modelling phase that accounts for reporting use cases, not just transactional ones.

- **Communication Gaps on Implementation Standards:** The rescheduling inconsistency, the DOM selector incident, and the email-after-deletion failure all share a root cause: implementation decisions were made in isolation without team-wide agreement on approach. Documentation and pre-implementation alignment remain insufficient.

---

## Action Items for Next Sprint

| Action Item | Reason | Related Backlog Area |
|---|---|---|
| Establish Scope-Specific CSS/DOM Component Isolation Rules | A global function (`setClinicFormEditable`) unintentionally targeted broad DOM elements across modules, stripping out and breaking a teammate's merged slot capacity slider. | UI Component Engineering & Code Reviews |
| Consolidate Appointment State Management and Rescheduling Logic | Discrepancies in the codebase led to conflicting implementations of the rescheduling feature — one section deleted and recreated documents while another patched fields directly. | Backend Refactoring & Design Standards |
| Implement Synthetic Data Bootstrapping Pipelines for ML Engines | Insufficient live Firestore queue history caused cold-start initialisation crashes in the Gradient Boosting regression models during deployment. | Machine Learning Microservice Layer |
| Shift Analytics Metrics from Base Schedules to Active Queue Subcollections | The average wait time report mistakenly calculated metrics from static booking `serviceDuration` fields rather than the live `estimatedWaitTime` fields in the nested clinic queue subcollection. | Data Architecture & Performance Reporting |
| Enforce a Pre-Fetch Hook Rule for State-Dependent Mutation Pipelines | Silent execution faults emerged during automated email dispatches because the email service attempted to read document details after deletion pipelines had already completed. | Backend Service Layer & Notification Broker |
| Enforce Upstream TDD Code Coverage Minimums Before Feature Handoffs | Relying on retrofitting unit tests onto tightly coupled, completed features created excessive friction and increased delivery lag at the end of the sprint. | Quality Assurance / Test-Driven Development |
| Incorporate Automated Session Interceptors for Long-Lived JWT Lifecycles | Administrators experienced intermittent authorisation failures during active sessions because Firebase JWT tokens expired while the browser session remained open. | Identity & Access Management (IAM) |

---

## Key Takeaways

Sprint 4 delivered the most technically sophisticated features of the project — a machine learning microservice, analytics dashboards, and a hybrid wait-time prediction engine — and saw several team members produce their most complete and polished end-to-end implementations. The email notification system, staff utilisation dashboard, and synthetic data bootstrapping pipeline each reflect genuine production-awareness that was not present in earlier sprints.

The sprint's clearest lesson, expressed independently by multiple team members in their final project reflections, is that **the most persistent bugs were not about syntax or logic — they were about misunderstood system connections**. The DOM selector incident, the rescheduling inconsistency, and the email-after-deletion failure all trace back to a single root cause: features were built and merged in isolation, without sufficient agreement on how modules interact with shared state.

Two technical debts also crystallise clearly at this stage. First, **Firestore data architecture has repeatedly not accounted for reporting needs**, forcing workarounds or inaccurate metrics in multiple features across sprints. Future projects should model data with both transactional and analytical read patterns in mind from the start. Second, **TDD discipline, while improving, was not applied consistently enough** to prevent the mock maintenance overhead and coupling issues that slowed testing in the final sprint.

The team's collective reflection across Sprint 4 — and the project as a whole — demonstrates meaningful growth in full-stack reasoning, system-level debugging, and awareness of the non-technical dimensions of software development. These are the foundations for stronger engineering practice in future work.
