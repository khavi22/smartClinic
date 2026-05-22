# SmartClinic — Sprint 4 Backlog Plan

## 1. Sprint Meta & Team Configuration

* **Project:** SmartClinic
* **Sprint 4 Duration:** 11 May 2026 to 18 May 2026 (1 Week)
* **Status:** 🟢 Complete (100% Velocity Achieved, 34.5/34.5 Points, 38 Tasks Closed)
* **Sprint Goal:** Deliver end-to-end virtual walk-in queuing, real-time status notifications, verified administrator onboarding, and highly accurate, ML-driven patient wait-time predictions, complete with clinic performance analytics dashboards.
* **Total Points Completed:** 34.5 Story Points (Plus Non-Estimated and Storyless Tasks)

### Active Team Members
* **Sinothando Msiya** (Scrum Master)
* **Mulweli Nanngambi** (Development Team Member)
* **Mahlatse Maredi** (Development Team Member)
* **Gontse Maledu** (Development Team Member)
* **Thapelo Tlowana** (Development Team Member)
* **Khavisani Maluleke** (Product Owner)

---

## 2. Sprint Assumptions & Operational Rules

### Machine Learning Wait Time Predictor
* **Prediction Baselines:** Waiting times are calculated dynamically via a regression model evaluating hour of day, active staff schedules, historical seasonal congestion, and service type.
* **Graceful Fallback:** If the predictive machine learning engine experiences cold-start issues or API disconnects, the system automatically falls back to calculating rolling-average historical wait durations.

### Admin Verification & Onboarding
* **Identity Mapping:** Newly self-onboarding administrators must submit their official facility operational ID and validated Department of Health professional credentials to gain control panel permissions.

---

## 3. Sprint 4 Backlog Table & Balanced Task Allocation

*Sprint 4 tasks have been distributed across all team members to ensure robust integration of ML services, geolocated routes, and dashboard layouts.*

| User Story | Description | Technical Subtasks | Owner | Points | Status |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **#103: Predict Patient Wait Times** | As a patient, I want to view an ML-predicted wait time, so that I can manage my arrival and expectations realistically. | • Task 103.1: Clean and pre-process historical facility checkout data logs.<br>• Task 103.2: Build, train, and validate the wait-time regression model based on operational variables.<br>• Task 103.3: Set up pipeline serving real-time predictions via microservice endpoint.<br>• Task 103.4: Program model performance fallback to rolling historic averages. | Mahlatse | 8 | `Closed` |
| **#108: Queue Turn Notifications** | As a waiting patient, I want to receive proactive turn alerts, so that I don't miss my consultation session. | • Task 108.1: Integrate push service APIs for instant notification dispatches.<br>• Task 108.2: Build background event handlers listening to queue changes and executing notification runs.<br>• Task 108.3: Build client-side notification settings component with toggle options. | Khavisani | 5 | `Closed` |
| **#107: Join Virtual Walk-in Queue** | As a walk-in patient, I want staff to add me to a virtual queue via my email, so that I can track my placement digitally. | • Task 107.1: Develop staff side UI for adding patients via their email to the virtual queue.<br>• Task 107.2: Implement and design the nodemailer email to be sent to existing patients that are added to a queue.<br>• Task 107.3: Build database logic checking in virtual walk-ins and assigning sequence positions. | Thapelo,<br>Mulweli | 8 | `Closed` |
| **#129: Onboard Admin and Clinics** | As a super administrator, I want to onboard new admins and clinic details securely, so that platform governance remains intact. | • Task 129.1: Build super administrator page where they can add new admins and clinics.<br>• Task 129.2: Create verification APIs validating submitted credential details against government registry records.<br>• Task 129.3: Develop secure authorization routines mapping admin accounts to facility profiles. | Mahlatse | 5.5 | `Closed` |
| **#104: View Position and Wait Counters** | As a queued patient, I want to check my live line position and countdown counter, so that I know exactly when to expect service. | • Task 104.1: Design patient real-time status tracker dashboard showing estimated wait counters.<br>• Task 104.2: Program pipeline streaming ticket position updates directly to active views.<br>• Task 104.3: Implement lightweight cache layers on wait time lookups to maintain database performance. | Sinothando | 3 | `Closed` |
| **#109: Clinic Performance Analytics** | As a facility administrator, I want to view operational metrics and export trend reports, so that I can improve clinic throughput. | • Task 109.1: Build analytical reporting metrics dashboards (average wait times, no-show rates).<br>• Task 109.2: Code database aggregation queries generating performance reports.<br>• Task 109.3: Develop secure export tools rendering files in PDF or CSV formats. | Gontse,<br>Thapelo | 5 | `Closed` |
| **Storyless Tasks** | CI/CD & Testing | • Task 126: Deploy automated CI/CD microservice pipeline supporting ML regression model updates.<br>• Task 105: Conduct end-to-end integration test runs simulating patient walk-in actions.<br>• Task 106: Perform platform cloud deployment verification runs. | Mulweli,<br>Sinothando,<br>Thapelo | 0 | `Closed` |

*Note: `N/E` denotes items that were Non-Estimated but fully completed.*

---

## 4. Acceptance Criteria

Structured verification scenarios using the Given-When-Then format to validate Sprint 4 deliverables.

### User Story #103: Predict Patient Wait Times
* **Scenario 1: Accurate ML Wait Time Prediction Run**
  * **Given** that the machine learning wait time engine microservice is healthy and online,
  * **When** a patient checks in for `"General Consultation"` on a Monday at `10:00 AM` with 10 people currently waiting,
  * **Then** the system computes a prediction taking into account active staff capacities, writes the estimated value to their checkout booking, and updates their dashboard view.
* **Scenario 2: Graceful Model Disruption Fallback Run**
  * **Given** that the ML microservice endpoint is unresponsive or encounters runtime exceptions,
  * **When** a patient queries their wait time counter,
  * **Then** the backend interceptor catches the timeout, switches automatically to rolling clinic averages, and outputs the historical wait metric labeled as `"Estimated (Rolling Average)"`.

### User Story #107: Join Virtual Walk-in Queue
* **Scenario 1: Staff Adds Walk-in Patient to Queue (Successful Registration)**
  * **Given** that a patient arrives at Hillbrow Clinic for a walk-in consultation,
  * **And** a staff member has access to the queue management system,
  * **When** the staff member enters the patient’s email address and adds them to the virtual walk-in queue,
  * **Then** the system generates a queue ticket number, adds the patient to the queue, and sends an email notification containing their queue details and tracking information.
* **Scenario 2: Invalid Patient Email Entry (Registration Failure)**
  * **Given** that a staff member is registering a walk-in patient into the virtual queue,
  * **When** the entered email address is invalid, missing, or cannot be processed,
  * **Then** the system rejects the request, prevents queue registration, and displays an error message such as: `“Registration Failed: Please enter a valid patient email address.”`

### User Story #108: Queue Turn Notifications
* **Scenario 1: Automated Email Alert on Proximity Turn**
  * **Given** that a patient is registered in the active virtual queue with turn position 4,
  * **When** the preceding patient enters consultation and their status updates, shifting the target patient's position to 3 (within step threshold),
  * **Then** the system triggers the communication event pipeline, calling the email broker to dispatch an alert reading: `"You are third in line at Hillbrow Clinic. Please proceed to the waiting lobby."`