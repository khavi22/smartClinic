# Sprint 1 Retrospective Report

## Sprint Overview

This sprint focused on delivering core infrastructure for the SmartClinic web application, spanning user authentication, appointment management, clinic search, backend architecture, and clinic availability. The team made meaningful progress across all feature areas, successfully integrating Firebase, building out Express-based MVC structures, and delivering a dynamic availability UI. However, the sprint also surfaced consistent challenges around planning discipline, inter-developer communication, and testing practices — themes that form the basis of improvement targets for the next sprint.

---

## What Went Well

- **End-to-End Feature Delivery:** All major feature areas — authentication, booking, cancellation, rescheduling, clinic search, and availability — were implemented and integrated within the sprint, demonstrating strong individual ownership and technical capability.

- **Firebase Integration:** Authentication with Google Sign-In, Firestore data storage, real-time availability updates, and session persistence were all successfully implemented across multiple workstreams, reflecting growing team-wide confidence with the Firebase ecosystem.

- **Dynamic UI Improvements:** The clinic availability page was successfully migrated from a static, hardcoded design to a real-time, Firebase-backed system. A responsive custom calendar, card-based layout, and semantic HTML improved the user experience significantly.

- **Problem-Solving Under Constraint:** When the Healthsites API proved inaccessible for client-side use, the team pivoted to the Google Places API without losing the core feature. This showed adaptability and collaborative problem-solving under real-world constraints.

- **Modular Code Architecture:** Breaking rendering logic into discrete functions (e.g., `renderCalendar()`, `renderSlots()`) and beginning the shift to MVC patterns improved debuggability and laid structural groundwork for the next sprint.

- **Debugging and Self-Directed Learning:** Several team members independently diagnosed and resolved complex issues — including asynchronous Firebase race conditions, HTTP method mismatches, and Express routing errors — demonstrating growing technical maturity.

- **User Experience Considerations:** Small but impactful UX improvements — such as loading spinners, disabling past time slots, and the "Use My Location" geolocation feature — improved the perceived quality of the product.

---

## Areas for Improvement

- **Planning Before Coding:** Multiple team members encountered integration issues (cancelled appointment filtering, missing module imports, routing mismatches) that could have been avoided with upfront API and data flow design. Coding ahead of a clear schema caused rework across the backend and frontend.

- **Testing Practices:** Testing was conducted too late in the development cycle. Azure deployment failures and Firestore security rule issues (causing repeated incorrect redirects) were only discovered during integration, when they were expensive to fix.

- **Communication and Naming Conventions:** Poor coordination around naming conventions caused a significant refactoring effort between team members working on related backend modules. The lack of shared standards created unnecessary friction at integration points.

- **Authentication and Routing Architecture:** Ad-hoc routing logic and race conditions in Firebase authentication state caused unintended redirects and login detection bugs. Authentication guards were implemented reactively rather than by design.

- **MVC Architecture Adherence:** Business logic and database calls were placed directly in route handlers in places, making the codebase harder to debug and extend. A consistent "dumb controller" MVC pattern was not enforced from the outset.

- **Siloed Working Patterns:** Team members largely worked in isolation, which led to duplicated research efforts, inflexible task handoffs, and downstream delays when dependent features were not ready. Shared ownership of user stories was lacking.

- **External API Risk Management:** Development on the clinic search feature stalled for over a day waiting for Healthsites API approval — an integration that was ultimately blocked for client-side use. This risk was not identified or mitigated in sprint planning.

- **Daily Scrum Effectiveness:** Standups did not consistently surface blockers or provide meaningful time estimates, reducing the team's ability to intervene early when members were stuck on isolated research tasks or were absent.

---

## Action Items for Next Sprint

| Action Item | Reason | Related Backlog Area |
|---|---|---|
| Establish a Shared Component & Naming Conventions Matrix | Poor coordination around naming conventions caused integration inconsistencies and forced significant refactoring between overlapping tasks. | Team Collaboration & Code Integration |
| Design API & Data Flow Schemas Prior to Development | Filtering mismatches (e.g. cancelled appointments being hidden) and routing errors occurred because data flows were not agreed upon before coding began. | Backend Architecture & Estimation |
| Implement Earlier and Isolated Endpoint / Security Rule Testing | Testing happened too late, surfacing Azure deployment failures and Firestore security issues only during integration. | Quality Assurance / Testing Process |
| Create Middleware & Centralised Route Guards | Ad-hoc routing logic and Firebase auth race conditions caused unintended redirects and authentication detection failures. | Security & Authentication |
| Enforce a "Dumb Controller" MVC Architecture Refactor | Placing database and business logic directly in route handlers made code tightly coupled and difficult to debug or extend. | Project Architecture / MVC Workflow |
| Transition from Individual Silos to Shared User Story Ownership | Working in isolation led to duplicated research, rigid task handoffs, and downstream delays across dependent features. | Agile Practices / Backlog Management |
| Conduct Pre-Sprint Technical Proof-of-Concepts for External Integrations | Development stalled waiting for Healthsites API access that was fundamentally blocked for client-side use — a risk that could have been identified earlier. | Risk Management & Spike Tasks |
| Pivot Daily Scrums to Focus on Blockers and Time Commitments | Team members spent excessive time on isolated research without surfacing blockers, reducing the team's ability to intervene and causing meeting absences. | Daily Standup / Team Accountability |

---

## Key Takeaways

The team delivered functional outcomes across all sprint feature areas, which reflects strong individual initiative and technical growth. The most significant lesson from this sprint is that **upfront planning — for APIs, data models, security rules, and naming conventions — saves substantially more time than it costs**. Issues that required hours of debugging (routing errors, authentication loops, cancelled appointment filtering) were largely downstream symptoms of starting implementation before the data contract was clear.

A second recurring theme is the cost of **siloed working**. While independent ownership drove delivery, it also created unnecessary friction at integration points and left individual blockers unresolved for too long. Moving toward shared user story ownership and more accountable standups will improve the team's ability to identify and remove blockers early.

Finally, the team demonstrated genuine **resilience and adaptability** — pivoting from a blocked API, refactoring architecture mid-sprint, and resolving complex async and deployment issues. These capabilities, channelled through better planning and communication structures, position the team well for a stronger next sprint.
