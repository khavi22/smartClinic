# SmartClinic — Scrum Daily Stand-Up & Sprint Review Log

## Sprint 1

### Daily Stand-Up 1: Focus & Design Blueprinting
* **What was discussed:** The team initiated the sprint by prioritizing the core user stories required for a minimal viable product (MVP). Discussions centered on establishing the base UI style guide, selecting an accessible medical color palette (teal and dark gray slates), and standardizing the global look and feel of the web application.
* **Blockers Identified:** Lack of a shared boilerplate directory structure.

### Daily Stand-Up 2: Core Feature Task Allocation
* **What was discussed:** Individual user story ownership was formally assigned to establish accountability for foundational workflows:
  * **Sinothando (Mzothando):** User Story #24 — Clinic Directory & Name Search.
  * **Mahlatse:** User Story #25 — View Clinic Availability & Time Slots.
  * **Khavisani:** User Story #26 — Appointment Cancellation & Rescheduling Frontends.
  * **Martin:** User Story #27 — View Existing Bookings Dashboard.
  * **Gontse:** User Story #29 — Third-Party Google Authentication Integration.
  * **Thapelo:** User Story #28 — Foundational Booking Engine & Firestore Schemas.
* **Blockers Identified:** Initial ambiguity around Firestore subcollection querying limits vs. flat-map root definitions.

### Daily Stand-Up 3: Middleware & Routing Synchronization
* **What was discussed:** Developers responsible for building the initial Express server architecture walk-through demonstrated the dynamic routing pipelines and core file trees to the team. Interdependent branches synced on handling asynchronous Firebase token retrieval hooks.
* **Blockers Identified:** Asynchronous race conditions where authentication state was not fully initializing before client-side dashboard lookups executed.

### Daily Stand-Up 4: Code Hardening & Deployment Preparation
* **What was discussed:** Final branch merges onto the `main` code branch were executed. The team systematically addressed merge conflicts in shared layout templates and reconciled estimated point logs inside the Taiga workspace.
* **Blockers Identified:** Azure deployment runtime errors caused by missing web app environment configurations and incorrect root index mapping handlers.

### Sprint Review & Presentation Prep (In-Person)
* **What was discussed:** The team conducted a comprehensive end-to-end user acceptance walkthrough of the appointment lifecycle on a local staging environment. Slidedecks and live demo paths were structured for the upcoming client presentation.

---

## Sprint 2

### Daily Stand-Up 1: Retrospective Evaluation & Backlog Setup
* **What was discussed:** Evaluated Sprint 1 process failures, specifically focusing on the lack of automated test coverage and late-stage branch integration friction. A short training guide on advanced Taiga issue tracking was distributed to standardize workflow reporting.
* **Blockers Identified:** Mismatched local testing environments causing branch synchronization lags.

### Daily Stand-Up 2: Authorization & Administrative Matrix Allocation
* **What was discussed:** Swapped feature domains to promote team cross-skilling and allocated roles for secure access governance:
  * **Thapelo & Martin:** Administrative Registration & Verification Code generation pipelines.
  * **Khavisani & Sinothando (Mzothando):** Clinic Staff secure registration forms and login panels.
  * **Gontse & Mahlatse:** Manage Clinic Operating Hours logic and secure Admin Profile Deletion methods.
* **Blockers Identified:** Divergent assumptions on whether clinic staff profiles should sit in the master user document collection or dedicated subcollections.

### Daily Stand-Up 3: System Modeling & Architecture Mapping (In-Person)
* **What was discussed:** The team met to map out the formal 4+1 Architectural View Model and 3-Tier Layered Architecture blueprints. Code implementation was executed concurrently with structural modeling:
  * **Thapelo:** Activity Diagrams (System Workflows)
  * **Khavisani:** Sequence Diagrams (Authentication Flows)
  * **Gontse:** Conceptual Data Diagram (Firestore Architecture)
  * **Sinothando (Mzothando):** State & Use Case Diagrams (Clinic Operational Lifecycles)
  * **Mahlatse:** Deployment Diagram (Azure Cloud Infrastructure Mapping)
  * **Martin:** Class Diagram (Domain Models and Controllers)
* **Blockers Identified:** CommonJS (`require`) module structure in backend Jest execution environment clashing with browser-native ES Modules (`import`).

### Daily Stand-Up 4: Version Control Cleanup & Validation
* **What was discussed:** Final pull requests were pushed to GitHub. Addressed branch merge conflicts stemming from concurrent edits to Firestore rules. Cleaned up tracked workspace environments.
* **Blockers Identified:** Generated Jest `/coverage` folders were accidentally committed into version control, breaking clean pull request lines. Mitigated by updating the master `.gitignore` file.

### Sprint Review & Presentation Prep (In-Person)
* **What was discussed:** Formally validated the cryptographic Access Verification Code pipeline. Prepared the functional application demonstration highlighting administrative governance features for the client review panel.

---

## Sprint 3

### Daily Stand-Up 1: Architecture Alignment & Task Distribution
* **What was discussed:** Reflected on Sprint 2's data refactoring hurdles and established task assignments targeting daily clinical workforce operations:
  * **Khavisani:** Clinic Profile Management & Admin Locking Controls.
  * **Gontse:** Advanced Multi-Filter Clinic Search (Chip-based UX elements).
  * **Mahlatse:** Pending Staff Assignment Registries and Nodemailer workflows.
  * **Sinothando (Mzothando):** Real-time Staff Availability Calendars.
  * **Thapelo:** Core Queue State Updates (Moving patients from waiting to consultation).
  * **Martin:** Manual Walk-in Ingestion Engines.
* **Blockers Identified:** Risk of breaking upstream components due to changing how clinic metadata fields map to the database layer.

### Daily Stand-Up 2: Workflow Assumptions Validation
* **What was discussed:** Each developer presented their technical assumptions and mock interaction patterns for their assigned user stories to ensure zero cross-module feature failure. Operational constraints and default data values were compiled and logged in Taiga.
* **Blockers Identified:** Unilateral restructuring of a clinic document subcollection to flat array arrays caused temporary parsing failures on sibling user stories.

### Daily Stand-Up 3: Cross-Functional Progress & Dependency Check
* **What was discussed:** Conducted an intermediate review of each feature's development progress. Verified that all technical documentation, component architecture diagrams, and TDD method tests matched current code implementations.
* **Blockers Identified:** Codebase bloat within the shared core queue controller, making the primary service file increasingly complex and difficult to isolate for unit tests.

### Daily Stand-Up 4: Integration Freeze & Pull Request Audits
* **What was discussed:** Frozen feature development to focus entirely on code review and database state reconciliation. Re-synced frontend event list bindings with the newly rewritten chip filter UI elements.
* **Blockers Identified:** Inconsistent character casing during lookup strings caused silent auth drops and "invitation not found" data mismatches. Standardized via input string lowercase normalization middleware.

### Sprint Review & Presentation Prep (In-Person)
* **What was discussed:** Evaluated live data streams for staff check-ins and mock-tested the staff approval process. Consolidated structural proof points for the client demonstration event.

---

## Sprint 4

### Daily Stand-Up 1: Advanced Predictive Features & Analytics Allocation
* **What was discussed:** Distributed tasks for the final production iteration, focusing on data reporting pipelines and predictive analytics layers:
  * **Thapelo:** In-Clinic Real-Time Virtual Queue Lifecycles.
  * **Khavisani:** Automated Proximity Queue Turn Email Alerts.
  * **Gontse:** Staff Utilisation Analytics Engine & PDF Reporting Engine.
  * **Sinothando (Mzothando):** Live Patient Queue Position & Rolling Wait Duration Displays.
  * **Mahlatse:** Onboarding Portals & Flask Gradient Boosting Wait-Time Machine Learning Engine.
  * **Martin:** Rescheduling Integrity Pipelines.
* **Blockers Identified:** Severe lack of live historical queue logs in the development database environment, stalling ML predictor initialization.

### Daily Stand-Up 2: Diagram Designations & Security Alignment
* **What was discussed:** Assigned architectural system diagrams for final compilation. Addressed core session security rules across administrative endpoints.
* **Blockers Identified:** Support team sessions experienced unexpected logouts due to standard Firebase JWT token expiration during active portal use. Mitigated by implementing automated session token refresh interceptors.

### Daily Stand-Up 3: Integrity Testing & Component Scope Check
* **What was discussed:** Monitored pipeline testing velocity and resolved cross-module functional regressions. 
* **Blockers Identified:** A global frontend state function (`setClinicFormEditable`) introduced a DOM manipulation conflict, unintentionally disabling a teammate's newly added queue capacity UI slider. Solved by explicitly scoping DOM selectors to localized module wrappers.

### Daily Stand-Up 4: Production Code Freeze & Deployment Freeze
* **What was discussed:** Executed the final code freeze. Automated scripts verified test coverage metrics. Deployed the application components onto production cloud servers and ran integration verification tests.
* **Blockers Identified:** The Flask ML prediction microservice crashed during initial deployment due to the cold-start data missing blocker. Resolved by integrating a synthetic dataset bootstrapping generation engine directly inside the microservice runtime.

### Sprint Review & Presentation Prep (In-Person)
* **What was discussed:** Verified the live cloud links, confirmed successful generation of the PDF analytics dashboard reports, and conducted dry runs of the final platform walkthrough to ensure preparation for academic submission.