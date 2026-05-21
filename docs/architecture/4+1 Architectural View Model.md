# SmartClinic 4+1 Architectural View Model

## 1. Logical View
Captures the object-oriented design and the core system entities.

### Class Diagram: Multi-Clinic Management System
```mermaid
classDiagram
    class Patient {
        +String uid
        +String name
        +bookAppointment()
    }
    class Clinic {
        +String clinicCode
        +String name
        +Address address
        +OperatingHours hours
    }
    class Appointment {
        +String appointmentId
        +DateTime startTime
        +String status
    }
    class MedicalService {
        +String serviceCode
        +String title
        +Int baseDuration
    }
    class QueueItem {
        +Int position
        +String status
        +DateTime arrivalTime
    }

    Patient "1" -- "*" Appointment : books
    Clinic "1" -- "*" Appointment : manages
    Clinic "1" -- "1..*" MedicalService : offers
    Clinic "1" -- "1" PatientQueue : maintains
    PatientQueue "1" -- "*" QueueItem : contains
    Appointment "0..1" -- "1" QueueItem : promotes to
```

## 2. Development View
Describes the internal decomposition of components.

### Component Diagram: System Infrastructure
```mermaid
graph TD
    classDef box fill:#fff,stroke:#000,stroke-width:1px,color:#000;
    
    subgraph CoreComponents ["Backend Components"]
        Controllers["Controllers Layer"]:::box
        Services["Services Layer"]:::box
        MLProxy["ML Service Proxy"]:::box
    end
    
    subgraph DataAccess ["Data Layer"]
        FirebaseSDK["Firebase Admin SDK"]:::box
    end
    
    Controllers --> Services
    Services --> FirebaseSDK
    Controllers --> MLProxy
```

## 3. Physical View
The multi-cloud production topology featuring Azure, Render, and GCP.

### Deployment Diagram: Production Topology
```mermaid
graph TD
    classDef nodeStyle fill:#fff,stroke:#000,stroke-width:2px,color:#000;
    classDef envStyle fill:#fff,stroke:#000,stroke-width:1px,color:#000,stroke-dasharray: 4;
    classDef artStyle fill:#fff,stroke:#000,stroke-width:1px,color:#000;

    subgraph Client ["<<device>> Client PC"]
        subgraph Browser ["<<Execution Environment>> Web Browser"]
            Frontend["<<artifact>> Frontend Web App"]:::artStyle
        end:::envStyle
    end:::nodeStyle

    subgraph Azure ["<<device>> Microsoft Azure"]
        subgraph NodeJs ["<<Execution Environment>> Node.js"]
            subgraph Server ["<<Executable environment>> HTTP Server"]
                Backend["<<artifact>> Backend API Code"]:::artStyle
            end:::envStyle
        end:::envStyle
    end:::nodeStyle

    subgraph Render ["<<device>> Render"]
        subgraph Python ["<<Execution Environment>> Python 3 (Flask)"]
            ML["<<artifact>> ML Service (Wait-time Predictor)"]:::artStyle
        end:::envStyle
    end:::nodeStyle

    subgraph GCP ["<<device>> Google Cloud"]
        subgraph Firebase ["<<Execution Environment>> Firebase Engine"]
            Store["<<artifact>> Firestore Collection"]:::artStyle
        end:::envStyle
    end:::nodeStyle

    Browser -- "HTTP Request (3000)" --> Server
    Server -- "HTTP Request (443)" --> Python
    Backend -- "Firebase SDK" --> Store
    ML -- "Admin SDK" --> Store

    class Client,Azure,Render,GCP nodeStyle;
```

## 4. Process View
Describes the communication and data flow between components.

### Activity Diagram: Appointment Workflow
```mermaid
graph TD
    Start([Start]) --> Search[Search Clinics]
    Search --> Filter{Filter Applied?}
    Filter -->|Yes| Apply[Apply Filters]
    Filter -->|No| Select[Select Clinic]
    Apply --> Select
    Select --> CheckSlot[Check Availability]
    CheckSlot --> Book[Book Slot]
    Book --> Firestore[(Store to Firestore)]
    Firestore --> Notify[Send Confirmation]
    Notify --> End([End])
```

## 5. Scenario View
Use cases that demonstrate the architectural fitness.

### Use Case: Patient Booking Flow
```mermaid
graph LR
    Patient((Patient)) --> Book[Book Appointment]
    Patient --> Check[Check Wait Times]
    Admin((Clinic Admin)) --> Manage[Manage Services]
    Staff((Medical Staff)) --> Triage[Triage Queue]
    Book -.-> Triage : triggers
```

---
*Maintained by the SmartClinic Architecture Team.*
