# MVC + Services Architectural Design

SmartClinic utilizes a modular **Model-View-Controller + Services (MVC+S)** localized architecture. This design pattern ensures a strict separation of concerns, making the system easier to test, maintain, and scale across multiple cloud providers.

## Architecture Diagram

```mermaid
graph TD
    classDef bnd fill:#fff,stroke:#000,stroke-width:2px,color:#000;
    classDef box fill:#fff,stroke:#000,stroke-width:1px,color:#000;
    classDef dash stroke:#000,stroke-width:1px,stroke-dasharray: 5 5;

    %% --- View Layer ---
    subgraph ViewLayer ["View Layer (Browser)"]
        HTML["HTML Templates (public/*.html)"]:::box
        UIJS["Client JS & DOM Logic (public/js/*.js)"]:::box
    end

    %% --- Controller Layer ---
    subgraph ControllerLayer ["Controller Layer (Node.js)"]
        Routes["Express Router (routes/*.js)"]:::box
        Controllers["Business Controllers (Controllers/*.js)"]:::box
    end

    %% --- Model/Service Layer ---
    subgraph ModelLayer ["Model & Service Layer"]
        Services["Business Services (services/*.js)"]:::box
        Models["Data Structures (models/*.js)"]:::box
    end

    %% --- Data & External ---
    Firestore[(Firebase Firestore)]:::box
    MLService["Python ML Service (Render)"]:::box

    %% --- Data Flow ---
    HTML -->|User Interaction| UIJS
    UIJS -->|API Requests| Routes
    Routes -->|Dispatch| Controllers
    Controllers -->|Invoke| Services
    Services -->|Validation| Models
    Services -->|CRUD| Firestore
    Controllers -->|Predict Requests| MLService
    
    %% Return Path
    Firestore -.->|Sync| Services
    Services -.->|Data| Controllers
    Controllers -.->|JSON| UIJS
    UIJS -.->|Render| HTML

    class ViewLayer,ControllerLayer,ModelLayer bnd;
```

## Component Breakdown

### 1. View Layer (`public/`)
Responsible for the "Glassmorphic" UI and user interactions.
- **Templates**: Standard HTML5 semantic files.
- **Client Logic**: Handles `fetch()` API calls to the backend and updates the DOM dynamically.

### 2. Controller Layer (`Controllers/` & `routes/`)
Acts as the entry point for all system requests.
- **Routes**: Defines the API endpoints and maps them to specific controller functions.
- **Controllers**: Orchestrates the flow of data. It parses request parameters and calls the appropriate service.

### 3. Service Layer (`services/`)
The "Brain" of the application. All core business logic resides here to ensure it can be reused across different controllers or even CLI tools.
- **clinicService.js**: Handles clinic metadata and hours logic.
- **appointmentService.js**: Manages booking windows and slot allocations.
- **queueService.js**: Triage and live status management.

### 4. Model Layer (`models/`)
Defines the schema and structure of the data objects used within the code and stored in the database.

---
*Created for SmartClinic Architecture Documentation.*
