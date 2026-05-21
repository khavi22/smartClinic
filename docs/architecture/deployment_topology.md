# System Deployment Topology

This document describes the production-grade deployment environment for SmartClinic, utilizing a multi-cloud strategy to leverage the specific pricing and performance strengths of different providers.

## Deployment Diagram

```mermaid
graph TD
    classDef device fill:#f8fafc,stroke:#334155,stroke-width:2px,stroke-dasharray: 5 5,color:#1e293b;
    classDef env fill:#f0f9ff,stroke:#0ea5e9,stroke-width:1px,color:#0369a1;
    classDef artifact fill:#ffffff,stroke:#1e293b,stroke-width:1px,color:#1e293b;
    
    %% --- Client Side ---
    subgraph ClientPC ["<<device>> Client PC"]
        subgraph BrowserEnv ["<<Execution Environment>> Web Browser"]
            FrontendArtifact["<<artifact>> Frontend Web App"]
        end
    end

    %% --- Backend API ---
    subgraph AzureNode ["<<device>> Microsoft Azure"]
        subgraph NodeEnv ["<<Execution Environment>> Node.js"]
            subgraph HTTPServer ["<<Execution Environment>> HTTP Server"]
                BackendArtifact["<<artifact>> Backend API Code"]
            end
        end
    end

    %% --- ML Service (Render) ---
    subgraph RenderNode ["<<device>> Render"]
        subgraph PythonEnv ["<<Execution Environment>> Python 3.x (Flask)"]
            MLArtifact["<<artifact>> ML Service (Wait-time Predictor)"]
        end
    end

    %% --- Database (Google Cloud) ---
    subgraph GCPNode ["<<device>> Google Cloud"]
        subgraph FirebaseEnv ["<<Execution Environment>> Firebase Engine"]
            FirestoreArtifact["<<artifact>> Firestore Collection"]
        end
    end

    %% --- Connections ---
    BrowserEnv -- "HTTP REST (Port: 3000)" --> HTTPServer
    BackendArtifact -- "HTTP REST Request (Port: 443)" --> MLArtifact
    BackendArtifact -- "Firebase SDK (Port: 443)" --> FirestoreArtifact
    MLArtifact -- "Firebase Admin SDK (Port: 443)" --> FirestoreArtifact

    %% Apply Classes for UML-like styling
    class ClientPC,AzureNode,RenderNode,GCPNode device;
    class BrowserEnv,NodeEnv,HTTPServer,PythonEnv,FirebaseEnv env;
    class FrontendArtifact,BackendArtifact,MLArtifact,FirestoreArtifact artifact;
```

## Infrastructure Overview

### 1. Microsoft Azure (Node.js Backend)
- **Service**: Azure App Service / Containers.
- **Role**: Serves the main Express API and hosts the static Frontend assets (provided via the `public/` directory).
- **Endpoint**: `https://smartclinic-api.azurewebsites.net` (Example).

### 2. Render.com (Python ML Service)
- **Service**: Render Web Service.
- **Role**: Self-contained Flask microservice responsible for training and serving GradientBoostingRegressor models for wait-time predictions.
- **Endpoint**: `https://smartclinic-ml.onrender.com`.

### 3. Google Cloud (Data & Auth)
- **Service**: Firebase (Firestore, Authentication, Hosting).
- **Role**: Centralized NoSQL data storage and user management. Both Azure and Render nodes sync directly with Firestore to ensure data consistency.

---
*Created for SmartClinic Architecture Documentation.*
