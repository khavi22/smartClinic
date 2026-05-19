# SmartClinic — Sprint 2 Backlog Plan

## 1. Sprint Meta & Team Configuration

* **Project:** SmartClinic
* **Sprint 2 Duration:** 15 April 2026 to 27 April 2026 (1.5 Weeks)
* **Status:** 🟢 Complete (100% Velocity Achieved, 10/10 Points, 16 Tasks Closed)
* **Sprint Goal:** Establish administrative and staff access control by integrating verification code authorization, enabling clinic registration, enabling operating hour management, and providing account removal procedures, alongside architecting system blueprints using the 4+1 View Model.
* **Total Points Completed:** 10 Story Points (Plus Non-Estimated and Storyless Tasks)

### Active Team Members
* **Sinothando Msiya** (Scrum Master)
* **Mulweli Nanngambi** (Development Team Member)
* **Mahlatse Maredi** (Development Team Member)
* **Gontse Maledu** (Development Team Member)
* **Thapelo Tlowana** (Development Team Member)
* **Khavisani Maluleke** (Product Owner)

---

## 2. Sprint Assumptions & Rules

### Clinic & Admin Management
* **1:1 Admin Mapping:** Each clinic registered in the system is managed by exactly one unique administrator. An administrator is associated with only one clinic and cannot manage multiple clinics.
* **Onboarding Baseline:** Clinics do not self-register freely. They must initiate direct contact with the core system support team to be officially onboarded with an admin.
* **Seeding & Default Settings:** All South African public health clinics are pre-onboarded/seeded into our system via real health facility datasets. By default, clinics operate on a 24-hour cycle until configured otherwise.
* **Admin Access Codes:** Upon successful onboarding validation, the clinic is issued a unique Admin Access Code sent via registered department email. Admin registration is strictly restricted and controlled through this verification code.

### Staff Management
* **Staff Number Generation:** Administrators are solely responsible for adding staff members to their clinic.
* **Clinic Linking:** Each staff member is restricted to exactly one clinic.

### System & Data Integrity
* **Verified Entities:** Clinic physical and geolocational data (name, geographic location, coordinates) is sourced and verified externally (e.g., via Google Maps API) and is not manually created or managed internally by end-users. Fake or manually drafted clinics are strictly disallowed.
* **Unique Identification:** Every clinic profile contains a permanent unique identifier linked directly to the external dataset authority records.

### Authentication & Operations
* **Unified OAuth2:** All user roles (Admins, Staff, and Patients) authenticate via a unified third-party identity provider (e.g., Google Sign-In) to guarantee secure, credential-free entry.
* **Data Maintenance:** Administrators are responsible for active operational configuration, including maintaining operating hours, service thresholds, and staff allocation tables.

---

## 3. Sprint 2 Backlog Table & Balanced Task Allocation

*Tasks have been balanced across our developers to prevent resource bottlenecks and ensure clear individual accountability.*

| User Story | Description | Technical Subtasks | Owner | Points | Status |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **#45: Clinic Staff Login & Registration** | As a clinic staff member, I want to log in using a third-party identifier provider, so that I can securely manage healthcare services. | • Task 45.1: Create Clinic Staff registration panel requiring unique staff access codes.<br>• Task 45.3: Integrate staff OAuth authentication with third-party IDP (Google Sign-In) to establish verified sessions.<br>• Task 45.4: Implement staff dashboard redirect routing and secure session state validation. | Sinothando | 5 | `Closed` |
| **#46: Admin Login & Registration** | As an admin, I want to register and log in using an authorized clinic access code, so that I can securely access and manage healthcare services for a clinic. | • Task 46.1: Develop Admin access code verification gate checking onboarding registries.<br>• Task 46.2: Set up DB script associating successful registrations with singular pre-onboarded clinics.<br>• Task 46.3: Implement secure admin route-guards protecting internal clinic service parameters. | Thapelo | 6 | `Closed` |
| **#47: Manage Clinic Operating Hours** | As an admin, I want to manage operating hours for each registered facility, so that I can ensure patient safety and maintain quality care. | • Task 47.1: Build frontend schedule matrix grid (operating hours, lunch breaks, and holiday configurations).<br>• Task 47.2: Create PUT/PATCH API endpoints for modifying individual facility operational hours.<br>• Task 47.3: Implement logic validating patient booking attempts against configured operating hour constraints.<br>• Task 47.4: Develop audit logger recording admin modifications to clinic operating configurations. | Sinothando,<br>Mulweli,<br>Mahlatse | 7 | `Closed` |
| **#57: Add Clinic / Onboarding** | As an admin, I want to onboard/add my clinic into the active scheduling system using my unique access code, so that my facility becomes visible to patients. | • Task 57.1: Develop backend endpoint validating Google Maps API clinic locations against real health records.<br>• Task 57.2: Implement email broker utility to automatically dispatch access codes to newly verified facilities. | Mulweli,<br>Thapelo | 3 | `Closed` |
| **#58: Admin Account Deletion** | As an admin, I want to delete my account, so that another admin can occupy my position and manage my clinic's operational profile. | • Task 58.1: Design secure "Delete Account" modal showing implications of operational transition.<br>• Task 58.2: Implement database operations ensuring clinic schedules and queue listings are handled safely and not orphaned. | Gontse,<br>Mahlatse | 5 | `Closed` |
| **Storyless Tasks** | 4+1 Architecture Models | • Task 38.1: Construct Logical View diagram mapping clean layered architecture interfaces.<br>• Task 38.2: Construct Process View diagram mapping dynamic concurrency of virtual walk-in queuing.<br>• Task 38.3: Construct Development View diagram mapping package management, API boundaries, and modules.<br>• Task 38.4: Construct Physical/Deployment View diagram mapping cloud server clusters, identity providers, and DB hosts. | Khavisani,<br>Sinothando,<br>Thapelo,<br>Mulweli | 0 | `Closed` |

*Note: `N/E` denotes items that were Non-Estimated but fully completed.*

---

## 4. Acceptance Criteria

Structured verification scenarios using the Given-When-Then format to validate Sprint 2 deliverables.

### User Story #45: Clinic Staff Log in and Registration
* **Scenario 1: Admin Invitation and Staff Approval Workflow**
  * **Given** an admin is successfully associated with `"Hillbrow Clinic"`,
  * **When** they add a staff member by entering the staff member’s email address in the clinic management screen,
  * **Then** the system creates a pending staff invitation linked to the clinic and waits for the staff member to register on the platform.
* **Scenario 2: Staff Registration Approval Process**
  * **Given** a staff member has registered using an email address that matches a pending clinic invitation,
  * **When** the admin reviews and approves the staff member from the pending approvals list,
  * **Then** the system assigns the staff member to `"Hillbrow Clinic"`, activates their staff access permissions, and displays a successful approval notification.

### User Story #47: Manage Clinic Operating Hours
* **Scenario 1: Restricting Operating Hours Adjustments to Authorized Admin Only**
  * **Given** an admin has successfully mapped their profile to `"Hillbrow Clinic"`,
  * **When** they update the daily operating hours from `"24 hours (Default)"` to `08:00 AM - 16:30 PM` and hit `"Save modifications"`,
  * **Then** the database updates the operational criteria record and outputs a successful update notification.
* **Scenario 2: Dynamic System Rejection of Out-of-Hours Appointments**
  * **Given** that the clinic operating hours have been set to `08:00 AM - 16:30 PM`,
  * **When** a patient attempts to book an appointment for `17:00 PM` on that clinic's calendar,
  * **Then** the scheduling engine rejects the input, marks the time as unavailable, and prompts the patient to select a valid slot.

### User Story #57: Add Clinic / Onboarding Access Code
* **Scenario 1: Automated Dispatch of Admin Access Code Upon Verification**
  * **Given** a clinic's physical location and legitimacy is verified against the official national public health facility records,
  * **When** the core team confirms onboarding,
  * **Then** the system records the facility, generates a cryptographically secure unique Admin Access Code, and automatically sends it to the clinic's registered department email.

### User Story #58: Admin Account Deletion
* **Scenario 1: Secure Account Removal and Resource Integrity Preservation**
  * **Given** an administrator decides to delete their active management profile,
  * **When** they trigger `"Delete Account"`, input their credentials, and confirm the permanent action on the safety warning dialog,
  * **Then** the system removes their credentials, resets the clinic's administrative assignment field to `Unassigned` so a new administrator can register using the access code, and preserves all ongoing clinic schedule data.