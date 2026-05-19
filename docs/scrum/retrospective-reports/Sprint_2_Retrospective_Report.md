# Sprint 2 Retrospective Report

## Sprint Overview

Sprint 2 focused on hardening the SmartClinic backend, implementing security controls, achieving meaningful test coverage, and formalising the system's architecture. The team delivered significant progress across Role-Based Access Control (RBAC), service layer separation, unit testing, admin dashboard development, and project management tooling. However, the sprint was notably disrupted by a mid-sprint database schema migration — moving from a single unified users collection to three separate collections — which forced widespread refactoring across authentication, frontend logic, and tests. Testing infrastructure maturity and cross-team architectural alignment emerge as the sprint's central improvement themes.

---

## What Went Well

- **Backend Architecture Refactoring:** The team successfully separated business logic into a dedicated service layer (`firebaseService.js`), keeping controllers slim and focused on request/response handling. This "dumb controller" pattern was agreed upon and implemented, making the codebase more readable and testable.

- **Security and RBAC Implementation:** Firebase Custom Claims were implemented during registration to embed user roles directly into ID tokens, preventing client-side role spoofing. Server-side ownership verification was added to the clinic hours update flow, ensuring only authorised admins can modify clinic data.

- **Test Coverage Milestone:** The team achieved 80%+ coverage of the service layer using Jest, with Firestore and Firebase Admin successfully mocked for fast, isolated unit tests. Coverage reporting was configured and initial steps toward GitHub Actions integration were completed.

- **Admin Dashboard Delivery:** The admin dashboard frontend was designed and implemented, including an operating hours management card allowing admins to configure and toggle daily schedules. The dashboard was later extended to dynamically fetch and display the clinic name from Firestore.

- **Architecture Decision — 3-Tier Model:** The team formally agreed on a 3-tier architecture (Firestore as data layer, Express controllers as logic layer, HTML/JS as client layer), matching the natural structure that had evolved and providing clear separation of concerns for future development.

- **Project Management Tooling:** Taiga was configured for the sprint, the backlog was populated, and a short internal training session improved team-wide adoption and sprint tracking visibility.

- **Advanced Availability Logic:** A capacity system (`MAX_CAPACITY_PER_SLOT = 10`) and complex slot filtering respecting dynamic operating hours (including closed days and custom open/close times) were successfully implemented.

- **Testing Knowledge Growth:** Multiple team members who had limited prior testing experience developed substantive Jest skills — including mocking external services, structuring test suites with `describe()`/`it()`, writing edge case coverage, and understanding the distinction between controller-level and service-level test responsibilities.

---

## Areas for Improvement

- **Late Database Schema Decisions:** The mid-sprint migration from a single `users` collection to three separate collections (`patients`, `admins`, `staff`) caused significant refactoring across authentication logic, frontend code, and tests. The cost of this change was high because it was made after implementation had already begun against the original structure.

- **Module System Incompatibilities:** Developers lost meaningful velocity managing the conflict between Jest's CommonJS module system and the browser's ES Module syntax. This was not anticipated in sprint planning and required workarounds (e.g., separating logic into `.cjs` files).

- **Version Control Discipline:** Generated artefacts such as Jest's `/coverage` folder were accidentally committed to the repository, causing branch conflicts and requiring cleanup. A consistent `.gitignore` strategy was not enforced from the outset.

- **Test Coverage Starting Late:** Initial test coverage was low across service files and controllers. Testing was added reactively toward the end of the sprint rather than being integrated progressively during development, reducing the quality-assurance value of the tests.

- **Scope Confusion Between Test Layers:** Some team members were initially unclear about where testing responsibilities lay — specifically, which logic belongs in frontend tests versus backend controller tests versus service-layer tests. This caused misdirected effort before the boundaries were clarified.

- **Frontend–Backend Isolation:** Frontend developers had limited visibility into the backend data model and service structure, which contributed to the impact of the schema migration and made it harder to write meaningful integration-aware tests. A need for cross-skilling was identified.

- **Firebase Mocking Overhead:** Setting up reliable mocks for Firestore's nested collection/document/query/snapshot structure required substantial boilerplate before tests could run, reducing the team's early testing velocity.

- **Architectural Alignment Gaps:** Core structural decisions — such as the user collection model — were not locked in before implementation began, resulting in duplicated work when the consensus shifted. The team acknowledged a need for upfront design freezes on foundational data schemas.

---

## Action Items for Next Sprint

| Action Item | Reason | Related Backlog Area |
|---|---|---|
| Establish a Design Freeze on Database Schemas Prior to Development | The mid-sprint migration from a single user collection to three separate collections forced painful authentication and logic refactoring across the team. | Data Architecture & Backend Service Layer |
| Standardise Environment Configurations for CommonJS and ES Modules | Developers lost velocity handling local environment compilation conflicts between Jest (CommonJS) and browser imports (ES Modules). | CI/CD & Testing Infrastructure |
| Add a `.gitignore` Rule Checklist Before Initial Code Commits | Generated system files (such as Jest `/coverage` folders) were accidentally tracked and committed, disrupting Git branches and PR cleanups. | Version Control & Git Workflow |
| Enforce Automated Code Coverage Threshold Guards in GitHub Actions | Initial code coverage was critically low in core services and controllers, requiring reactive testing additions at the end of the sprint. | Quality Assurance / DevOps |
| Separate Test Suites Explicitly by Logic and Behaviour Responsibilities | Developers initially struggled with test scope, confusing frontend logic boundaries with isolated backend controller and service layer boundaries. | Unit Testing Process |
| Cross-Skilling Rotation: Assign Frontend Developers to Backend Tasks | Frontend developers expressed a need to take on backend tasks to gain full-system understanding and write meaningful tests from the start of each sprint. | Team Resource Allocation & Agile Practices |

---

## Key Takeaways

The team made substantial technical progress in Sprint 2, transitioning the SmartClinic backend from a proof-of-concept toward a production-ready system with layered security, a clean service architecture, and foundational test coverage. The 3-tier architecture agreement and RBAC implementation represent important steps toward a maintainable and secure product.

The sprint's most costly lesson was that **foundational data model decisions must be finalised before any implementation begins**. The schema migration from a unified users collection to role-specific collections was the right long-term choice, but its timing — mid-sprint — multiplied its cost significantly. A design freeze protocol for data schemas will prevent this pattern from recurring.

A second clear theme is that **testing must be a first-class activity from day one of each sprint**, not a catch-up exercise at the end. Enforcing coverage thresholds in CI, separating test responsibilities clearly by layer, and resolving the CommonJS/ES Module configuration conflict upfront will all raise the baseline quality of future sprints.

Finally, the team's investment in knowledge-sharing — from Taiga training to cross-skilling ambitions — reflects a healthy awareness that siloed expertise creates fragility. Rotating frontend developers into backend tasks in the next sprint will strengthen collective ownership and improve the team's ability to maintain consistency across the full stack.
