# MVC + Services Architectural Design

SmartClinic utilizes a modular **Model-View-Controller + Services (MVC+S)** localized architecture. This design pattern ensures a strict separation of concerns, making the system easier to test, maintain, and scale across multiple cloud providers.

## Architecture Diagram

```mermaid
graph TD
    classDef view fill:#f8fafc,stroke:#334155,stroke-width:2px,color:#1e293b;
    classDef controller fill:#fefce8,stroke:#eab308,stroke-width:2px,color:#854d0e;
    classDef model fill:#f0fdf4,stroke:#22c55e,stroke-width:2px,color:#166534;
    classDef db fill:#fef2f2,stroke:#ef4444,stroke-width:2px,color:#991b1b;
    classDef ext fill:#faf5ff,stroke:#a855f7,stroke-width:2px,color:#6b21a8;

    %% --- View Layer ---
    subgraph ViewLayer ["View Layer (Browser)"]
        HTML["HTML Templates (public/*.html)"]:::view
        UIJS["Client JS & DOM Logic (public/js/*.js)"]:::view
    end

    %% --- Controller Layer ---
    subgraph ControllerLayer ["Controller Layer (Node.js)"]
        Routes["Express Router (routes/*.js)"]:::controller
        Controllers["Business Controllers (Controllers/*.js)"]:::controller
    end

    %% --- Model/Service Layer ---
    subgraph ModelLayer ["Model & Service Layer"]
        Services["Business Services (services/*.js)"]:::model
        Models["Data Structures (models/*.js)"]:::model
    end

    %% --- Data & External ---
    Firestore[(Firebase Firestore)]:::db
    MLService["Python ML Service (Render)"]:::ext

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
