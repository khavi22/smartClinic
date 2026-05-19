# SmartClinic — Sprint 3 Backlog Plan

## 1. Sprint Meta & Team Configuration

* **Project:** SmartClinic
* **Sprint 3 Duration:** 20 April 2026 to 11 May 2026 (3 Weeks)
* **Status:** 🟢 Complete (100% Velocity Achieved, 15/15 Points, 28 Tasks Closed)
* **Sprint Goal:** Implement active daily operations and clinical personnel management, enabling administrators to search/filter clinics, register staff assignments, and track individual personnel availability, while empowering clinic staff to modify real-time patient status queues and adjust scheduling slots.
* **Total Points Completed:** 15 Story Points (Plus Non-Estimated and Storyless Tasks)

### Active Team Members
* **Sinothando Msiya** (Scrum Master)
* **Mulweli Nanngambi** (Development Team Member)
* **Mahlatse Maredi** (Development Team Member)
* **Gontse Maledu** (Development Team Member)
* **Thapelo Tlowana** (Development Team Member)
* **Khavisani Maluleke** (Product Owner)

---

## 2. Sprint Assumptions & Operational Rules

### In-Clinic Queue Operations
* **Patient Queue Lifecycle:** Once checked-in, patients cycle through structured database queue states managed by staff: `Waiting`, `Called`, `In Consultation`, `Completed`, and `No-Show(Missed)`.
* **Real-Time Updates:** Live screen dashboards and client-side notifications read from active check-in data to output updated estimated wait times and queue positions dynamically.

### Facility Locators & Mapping
* **Clinic Availability Assumption:** Clinics added to the system through Google Maps integration are assumed to be operational and available for service delivery.
* **Booking Permissions:** Once a clinic is selected and stored in the database, patients are permitted to view and book appointments at that clinic through the platform.
* **Geographical Filtering:** Patients discover clinics by filtering geographically using Province, District, and Municipality.

---

## 3. Sprint 3 Backlog Table & Balanced Task Allocation

*Tasks have been balanced across our 6 developers to keep our workloads stable while executing critical queue and staff roster models.*

| User Story | Description | Technical Subtasks | Owner | Points | Status |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **#48: Clinic Management** | As an admin, I want to edit and manage my clinic's contact details facility profile, so that patients are presented with accurate up-to-date information. | • Task 48.1: Design Admin console interfaces for general facility profile configuration.<br>• Task 48.2: Build API services for fetching, editing, and overwriting pre-seeded clinic contact details.<br>• Task 48.3: Configure database locks preventing redundant modifications of shared regional resources. | Khavisani,<br>Gontse | 4 | `Closed` |
| **#54: Filter clinics** | As a patient, I want to search and filter clinics based on location, distance, and available services, so that I can easily discover the nearest facility offering the treatment I need. | • Task 54.1: Develop advanced search UI incorporating geolocational sorting and service capability tags.<br>• Task 54.2: Build high-performance firestore query parameters to handle complex indexing on regional medical facility lists. | Gontse,<br>Mahlatse | 8 | `Closed` |
| **#70: Staff assignment** | As an admin, I want to assign clinic staff members to my clinic, so that our clinical resources are optimally deployed to handle the daily patient flow. | • Task 70.1: Build administrator dashboard assignment view mapping registered staff accounts to clinic rooms/services.<br>• Task 70.2: Develop relational schema establishing dynamic assignments between personnel IDs, department clinics, and calendar days.<br>• Task 70.3: Program validation controllers checking for duplicate daily schedules across distinct medical centers. | Mahlatse | 5 | `Closed` |
| **#72: Update Patient Status** | As a clinic staff member, I want to update patient queue statuses in real time as they transition through care, so that the shared waiting room displays remains synchronized and wait-time statistics are calculated accurately. | • Task 72.1: Design staff-facing live queue board control panel showing patient checklists.<br>• Task 72.2: Implement real-time transactional socket pipelines (Websockets/SSE) propagating state changes dynamically.<br>• Task 72.3: Build database logic automatically calculating average wait times whenever patient rows transition to Completed. | Thapelo,<br>Mulweli | 7 | `Closed` |
| **#73: Add or Reschedule Patients** | As a clinic staff member, I want to manually override, add, or reschedule patient booking slots in the schedule roster, so that I can accommodate immediate clinical emergencies and administrative changes. | • Task 73.1: Build quick-action interface modals allowing clinic coordinators to manually override active patient calendars.<br>• Task 73.2: Establish administrative slot management API protecting clinical schedules against resource conflicts. | Thapelo,<br>Mulweli | 5 | `Closed` |
| **#74: Set Staff Availability** | As a clinic staff member, I want to update my active duty hours, so that the queue routing engine does not assign patients to me when I am unavailable. | • Task 74.1: Develop active availability slider controls mapping personnel shift statuses (Duty, Break, Absent).<br>• Task 74.2: Build logic automatically redirecting routing calls away from clinicians currently marked inactive. | Gontse,<br>Khavisani | 5 | `Closed` |
| **Storyless Tasks** | Performance Testing | • Task 91.1: Run latency profiles under simulated concurrent API calls on queue state modifications.<br>• Task 91.2: Perform stress-tests simulating simultaneous South African regional searches on pre-seeded directory databases. | Mulweli,<br>Khavisani | 0 | `Closed` |

*Note: `N/E` denotes items that were Non-Estimated but fully completed.*

---

## 4. Acceptance Criteria

Structured verification scenarios using the Given-When-Then format to validate Sprint 3 deliverables.

### User Story #70: Staff assignment
* **Scenario 1: Successful Staff Assignment to a Clinic**
  * **Given** that an administrator is securely logged in and viewing the staff management panel for `"Hillbrow Clinic"`,
  * **When** they enter a staff member’s email address and approve their registration request,
  * **Then** the system links the staff member account to `"Hillbrow Clinic"`, grants clinic staff access permissions, and displays a successful assignment notification on the admin dashboard.
* **Scenario 2: Preventing Duplicate Clinic Assignments**
  * **Given** that a staff member is already assigned to `"Hillbrow Clinic"`,
  * **When** the administrator attempts to assign the same staff member to `"Yeoville Clinic"` using the same email address,
  * **Then** the system rejects the assignment request and displays an alert: `"Staff member is already assigned to Hillbrow Clinic."`

### User Story #72: Update Patient Status
* **Scenario 1: Live Cascade of Patient Status Transitions**
  * **Given** that a patient is currently listed in the `"Hillbrow Clinic"` queue with status `Waiting`,
  * **When** the assigned clinician updates the patient's record to `In Consultation` via their active queue control panel,
  * **Then** the system triggers a real-time websocket update, instantly changing the patient's row on the clinic monitoring display and sending an alert to the patient's phone.
* **Scenario 2: Automated Wait Time Analytics Processing**
  * **Given** that a patient's consultation row has successfully completed,
  * **When** the staff member clicks `"Mark as Completed"` in the workspace,
  * **Then** the database updates the state to `Completed`, saves the current time, calculates the patient's total wait time (check-in time to start-of-consultation time), and logs the metric to the clinic statistics repository.

### User Story #74: Set Staff Availability
* **Scenario 1: Staff Member Sets Daily Working Hours**
  * **Given** that Dr. Maredi is assigned to `"Hillbrow Clinic"` and has access to the staff scheduling dashboard,
  * **When** they set their daily working hours to `08:00 AM - 16:30 PM` and save the schedule,
  * **Then** the system records the availability period, updates the staff schedule for that day, and confirms the changes with a success notification.
* **Scenario 2: Preventing Patient Assignment Outside Staff Working Hours**
  * **Given** that Dr. Maredi’s working hours are set to `08:00 AM - 16:30 PM`,
  * **When** a patient attempts to book or join a queue slot at `17:00 PM` with Dr. Maredi,
  * **Then** the system marks the time as unavailable and prompts the patient to select a valid time within the staff member’s working hours.