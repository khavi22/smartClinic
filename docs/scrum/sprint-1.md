# SmartClinic — Sprint 1 Backlog Plan

## 1. Sprint Meta & Team Configuration

* **Project:** SmartClinic
* **Sprint 1 Duration:** 13 April 2026 to 20 April 2026 (1 Week)
* **Status:** Sprint 1 Complete (100% Velocity Achieved, 22/22 Points, 30 Tasks Closed)
* **Sprint Goal:** Establish the system's foundational architecture by implementing secure patient authentication, setting up the South African clinic locator directory, and delivering the complete end-to-end patient appointment scheduling lifecycle (viewing, booking, viewing existing, rescheduling, and cancelling).
* **Total Points Completed:** 22 Story Points (Plus Non-Estimated and Storyless Tasks)

### Active Team Members
* **Sinothando Msiya** (Scrum Master)
* **Mulweli Nanngambi** (Development Team Member)
* **Mahlatse Maredi** (Development Team Member)
* **Gontse Maledu** (Development Team Member)
* **Thapelo Tlowana** (Development Team Member)
* **Khavisani Maluleke** (Product Owner)

---

## 2. Sprint Assumptions & Rules

### Clinic Directory & Core Datasets
* **South African Health Facility Seed Data:** Official facility directories are seeded into the database from authenticated government facility registries to prevent fake entries.
* **Default Operational Models:** Pre-seeded clinics operate with basic service capacities and schedule bounds default settings, laying the groundwork for admin custom adjustments in Sprint 2.

### Appointment Rules & Availability Boundaries
* **Booking Constraints:** Patients can only book appointments for future operational dates. Past-date booking is strictly blocked at the validation layer.
* **Booking Uniqueness:** The database enforces transaction locking rules on exact clinic service slots to protect against duplicate checkouts.

---

## 3. Sprint 1 Backlog Table & Balanced Task Allocation

*Tasks are retroactively mapped to team members to keep active resource allocations consistent and transparent across the project history.*

| User Story | Description | Technical Subtasks | Owner | Points | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **#3: Viewing Availability** | As a patient, I want to view clinic availability, so that I can choose an open slot that fits my schedule. | • Task 3.1: Design clinic availability UI grid component.<br>• Task 3.2: Implement backend API endpoint to fetch available time slots.<br>• Task 3.3: Set up database indexes on availability tables for performance.<br>• Task 3.4: Write unit tests for date/time slot conflict logic.<br>• Task 3.5: Connect frontend calendar component to API endpoint.<br>• Task 3.6: Perform UI responsiveness testing for mobile browsers. | Mahlatse | 8 | Closed |
| **#11: Finding Clinic** | As a patient, I want to search and find local clinics using a directory based on real South African health facility data, so that I can locate my nearest facility. | • Task 11.1: Seed database with official SA health facility datasets.<br>• Task 11.2: Build backend search and filtering API (by location).<br>• Task 11.3: Create clinic directory list and search bar UI view.<br>• Task 11.4: Implement geolocational sorting for nearest clinic lookups. | Sinothando | 5 | Closed |
| **#1: Appointment Booking** | As a patient, I want to book an appointment at a selected clinic for a specific health service, so that I can secure a time to see a healthcare professional. | • Task 1.1: Build appointment booking form UI wrapper.<br>• Task 1.2: Create appointments schema in database with constraints.<br>• Task 1.3: Develop POST API endpoint for creating a booking transaction.<br>• Task 1.4: Implement basic backend locking to prevent double-booking.<br>• Task 1.5: Wire up booking form validation and success/error states.<br>• Task 1.6: Run integration tests for booking verification workflow. | Thapelo | 8 | Closed |
| **#19: Rescheduling** | As a patient, I want to reschedule an existing appointment, so that I can change my visit time if my availability changes. | • Task 19.1: Create "Change Date/Time" action and patch modal UI. | Mulweli | 1 | Closed |
| **#20: Cancel Appointment** | As a patient, I want to cancel an appointment, so that my slot is freed up for other community members. | • Task 20.1: Create "Cancel Booking" safety confirmation dialog UI. | Khavisani | 1 | Closed |
| **#29: Third-Party Login** | As a patient, I want to log in using a third-party identifier provider, so that I can securely access the scheduling system without creating another set of credentials. | • Task 29.1: Configure external OAuth2 / identity provider integration.<br>• Task 29.2: Create patient user profile in DB upon initial auth success.<br>• Task 29.3: Build login landing page UI and handle session tokens.<br>• Task 29.4: Implement route guards to protect authenticated patient views. | Gontse | 5 | Closed |
| **#32: Viewing Bookings** | As a patient, I want to view my existing bookings, so that I can keep track of my upcoming clinic visits. | • Task 32.1: Design "My Bookings" patient dashboard layout interface.<br>• Task 32.2: Create API endpoint to fetch future appointments by user ID. | Mulweli | 2 | Closed |
| **Storyless Tasks: Repo Setup & Architecture** | N/A | • #38: Set up initial project repository, CI/CD pipelines, and base deployment architecture. | Khavisani | 0 | Closed |

---

## 4. Acceptance Criteria

Structured verification scenarios using the Given-When-Then format to validate Sprint 1 deliverables.

### User Story #1: Appointment Booking
* **Scenario 1: Successful Booking on a Valid Future Date**
  * **Given** that the patient is securely logged in and is viewing the booking form for "Hillbrow Community Health Centre" under the service "Child Immunization",
  * **When** the patient selects an available future date `2026-06-15` and time slot `10:00 AM`, and clicks "Confirm Booking",
  * **Then** the system creates a record with status `Confirmed`, reserves the slot, navigates the user to their dashboard, and displays a success message.
* **Scenario 2: Prevention of Past-Date Booking**
  * **Given** that the patient attempts to manually modify inputs or force a past date selection,
  * **When** the patient selects a date in the past and submits the form,
  * **Then** the system rejects the submission, displays an error stating *"Appointments cannot be scheduled for past dates"*, and prevents database write operations.
* **Scenario 3: Concurrency Conflict (Double-Booking Prevention)**
  * **Given** that two patients are viewing the final checkout screen at the exact same time for the absolute last remaining slot at `11:00 AM`,
  * **When** Patient A submits their booking a fraction of a second before Patient B,
  * **Then** Patient A's booking succeeds, and Patient B's submission is rejected with a message stating *"This time slot has just been filled. Please select an alternate time"*.

### User Story #3: Viewing Availability
* **Scenario 1: Display of Real-Time Free Slots**
  * **Given** that a clinic has an allocated threshold of 4 slots per hour for "Chronic Care Management",
  * **When** a patient selects that clinic and service for a specific date,
  * **Then** the system calculates operational capacity minus existing confirmed bookings and renders only hours with remaining slots `> 0`.
* **Scenario 2: Complete Capacity Block-out**
  * **Given** that a specific day's operating slots are fully booked out due to local facility constraints,
  * **When** the patient opens the calendar picker view,
  * **Then** that specific date displays visual indicators indicating it is fully booked, and clicking the date is disabled.
* **Scenario 3: Out-of-Bounds Facility Operating Hours**
  * **Given** that a public clinic operates strictly from `07:30 AM` to `16:00 PM` Monday through Friday according to its dataset profile,
  * **When** the system dynamically generates the time slot layout grid,
  * **Then** it must not display slots for weekends or hours outside the defined operational profile.

### User Story #11: Finding Clinic
* **Scenario 1: Filtering Directory by Service Availability**
  * **Given** the complete South African health facility database is seeded into the application backend,
  * **When** a user filters the active directory list using the search criteria *"Johannesburg"* and service type *"TB Screening"*,
  * **Then** the application filters out irrelevant rows and returns only facilities matching both criteria.
* **Scenario 2: Handling Empty Directory Search Parameters**
  * **Given** the patient types a non-existent or corrupted search term like `XYZ123ABC` into the directory lookup query line,
  * **When** the search executes,
  * **Then** the system gracefully returns zero records and displays an informative notice reading *"No clinics found matching your criteria. Please check your spelling or search another region."*

### User Story #29: Third-Party Identifier Login
* **Scenario 1: First-Time User Profile Creation**
  * **Given** a user signs in to the platform for the first time and no user profile record exists in the application database,
  * **When** they authenticate successfully using Firebase Authentication,
  * **Then** the backend verifies the Firebase ID token, creates a corresponding user profile record in the patient profiles table, and redirects the user to the profile setup screen.
* **Scenario 2: Intercepting Expired or Compromised Session Tokens**
  * **Given** a user has an active window open but their underlying third-party identification token expires or is manually revoked outside the ecosystem,
  * **When** they click an internal resource action requiring routing authorization,
  * **Then** the global route guard interceptor catches the `401 Unauthorized` state, invalidates the local state, logs the client out, and redirects them to the base landing page.
