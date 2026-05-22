# Project Plan

## Project Overview
SmartClinic is an intelligent, web-based healthcare management platform developed to streamline public health clinic workflows, eliminate waiting-room congestion, and provide real-time operational transparency in South African medical facilities. The system incorporates secure patient authentication, digital clinic directories, a dynamic walk-in queue state machine, and a machine learning-driven wait-time prediction engine. 

The project was executed using an Agile Scrum framework across four distinct operational sprints. This methodology enabled the team to maintain high flexibility, absorb architectural pivots gracefully, and continuously deliver incremental, production-ready iterations. By structuring development into rapid, time-boxed cycles, the project smoothly evolved from conceptual requirements into a highly secured, cloud-deployed SaaS solution.

## High-Level Timeline

| Phase | Milestone | Key Deliverables | Target Deadline | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Project Initiation** | M1: Project Setup & Baseline | Project Repository Setup, Baseline Seed Datasets, Core Tech Stack Selection | 12 April 2026 | Completed |
| **Requirements & Planning** | Product Backlog Initial Grooming | Taiga Project Setup, User Story Mapping, Project Scope Definition | 14 April 2026 | Completed |
| **Architecture & Design** | System Architectural Blueprinting | 4+1 Architectural View Model, 3-Tier Layered Architecture Specifications | 19 April 2026 | Completed |
| **Sprint 1 Execution** | Foundational Booking Engine | Secure Patient Authentication, Clinic Directory Lookup, Appointment Lifecycles | 20 April 2026 | Completed |
| **Sprint 2 Execution** | Access Control & Administration | Admin Dashboards, Cryptographic Access Verification Codes, Operating Hours Controls | 27 April 2026 | Completed |
| **Sprint 3 Execution** | Real-Time Workforce Operations | Staff Onboarding Workflow, Custom Claims RBAC, In-Clinic Live Queue Lifecycles | 11 May 2026 | Completed |
| **Sprint 4 Execution** | Intelligent Analytics & Prediction | ML Wait-Time Prediction Engine, Staff Utilisation Reports, Automated Email Notification Broker | 18 May 2026 | Completed |
| **Testing & QA** | End-to-End System Validation | Service-Layer Jest Regression Test Suite, Integrated TDD Coverage Enforcement | 18 May 2026 | Completed |
| **Deployment** | Cloud Infrastructure Release | Multi-Environment Node.js Express Production Launch, Flask ML Microservice Deployment | 19 May 2026 | Completed |
| **Final Documentation** | Project Closeout & Academic Package | Final Retro Reports, Compiled System Manual, Academic Submission Sign-off | 22 May 2026 | Pending |

## Major Milestones

### Milestone 1: Project Setup
* **Objective:** Establish the development environment, baseline infrastructure, and initial functional tracking frameworks to kick off product development securely.
* **Deliverables:**
  * Initialized multi-branch GitHub code repository with branch governance rules.
  * Taiga project workspace populated with initial project scope and estimated user stories.
  * Seeded Firestore database with authenticated national public health facility registries.
* **Target completion:** 14 April 2026

### Milestone 2: Core Feature Development
* **Objective:** Implement the primary software layers, focusing on data schemas, authentication controls, operational management systems, and real-time data streaming.
* **Deliverables:**
  * End-to-end appointment engine managing creation, cancellation, and history caching.
  * Role-Based Access Control (RBAC) powered by Firebase Custom User Claims (Patient, Staff, Admin).
  * 3-Tier Layered Architecture infrastructure isolating public endpoints into dumb controllers and slim services.
  * Subcollection-driven active clinic queue lifecycle management tracks (`Waiting`, `Called`, `In Consultation`, `Completed`, `No-Show`).
* **Target completion:** 11 May 2026

### Milestone 3: System Validation
* **Objective:** Enforce robust product quality, eliminate regressions, and resolve critical technical bottlenecks across interdependent modules through rigorous automated testing.
* **Deliverables:**
  * Centralized mock architectures for isolated Firestore database and third-party API executions.
  * Automated backend service-layer regression suites achieving 80%+ Jest code coverage.
  * Input sanitization middleware for handling environmental inconsistencies like string normalization.
  * Local compilation environment synchronization balancing CommonJS (Jest) and ES Modules (Client).
* **Target completion:** 18 May 2026

### Milestone 4: Deployment & Final Submission
* **Objective:** Transition the modularized web application from local development environments to live cloud infrastructures, ensuring high performance, security compliance, and comprehensive academic review readiness.
* **Deliverables:**
  * Live cloud environment hosting the Node.js Express application server linked to the frontend.
  * Independently running Flask machine learning microservice deployed with integrated synthetic data bootstrapping pipelines.
  * Multi-role automated notification architecture configured for post-deployment delivery.
  * Formally compiled project documentation package and sprint retrospective logs.
* **Target completion:** 22 May 2026

## Dependencies and Risks
* **Data Architecture Volatility:** Switching mid-project from a centralized monolithic data structure to distinct data collections introduced architectural friction. This required refactoring the core authentication routing pipelines and logic frameworks across multiple developer branches.
* **Third-Party API Constraints:** Early dependence on client-side requests to restricted external health registries introduced unexpected blocking points due to rigid validation procedures. The team mitigated this risk by adopting a server-side data ingestion model utilizing highly responsive API engines.
* **Deployment System Inconsistencies:** Environmental variations between local runtimes and live cloud server specifications triggered post-deployment runtime exceptions in third-party automated notification services. This required implementing defensive try/catch mechanisms and dedicated pre-fetch evaluation hooks.
* **Cold-Start Predictor Instability:** The machine learning regression model initially suffered from cold-start failures due to a lack of live historical data patterns in new database instances. This was resolved by implementing a synthetic data bootstrapping pipeline within the prediction service to populate database models gracefully upon execution.

## Project Completion Summary
SmartClinic successfully progressed from an ambiguous healthcare problem into a high-performance, production-ready ecosystem, hitting all critical milestones with 100% velocity across four tightly scheduled sprints. The project demonstrates advanced engineering maturity by evolving from an initial monolithic structure into a robust, decoupled, MVC architecture. 

Despite early data schema changes and late-stage cloud integration complexities, the Scrum team maintained delivery alignment by embracing strict test-driven engineering concepts and refining task tracking frameworks continuously. The final system achieves a highly stable implementation, fulfilling its promise of delivering smart, automated, and secure clinic workflow coordination.