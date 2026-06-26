# DID Hospital Infrastructure - Project Full Report

## 1. Executive Summary
The DID (Decentralized Identity) Hospital Infrastructure is a comprehensive healthcare platform built to modernize patient interactions, staff workflows, and administrative oversight. It leverages decentralized identities (DIDs), verifiable credentials, and a distributed backend system to ensure data privacy, security, and immutability. The project is divided into three main portals: Patient Portal, Staff Portal, and Admin Console, all seamlessly integrated into a single application interface.

## 2. Architecture Overview
The application follows a modern web architecture, decoupling the frontend user interfaces from the backend ledger simulation and data synchronization layer.

*   **Frontend:** Built with React, TypeScript, and Vite, utilizing TanStack Start for server-side rendering and file-based routing. Styling is managed via Tailwind CSS and Radix UI components for a robust, accessible, and responsive design.
*   **Backend API:** A Node.js and Express backend (`backend/server.js`) provides a distributed system architecture. It maintains an in-memory ledger with blocks, transactions, and a world state database (`backend/world-state-db.js`). It exposes REST APIs and WebSockets for real-time updates (e.g., vitals monitoring, staff tracking, system events).
*   **Real-time Database (Convex):** The system integrates with Convex (`convex/schema.ts`) to provide live, synchronized real-time database capabilities, acting as a bridge between the simulated ledger and the frontend for instantaneous state updates across clients.

## 3. Technology Stack

### Frontend
*   **Framework:** React 19, TanStack Start (File-based routing & SSR)
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS, Radix UI (accessible components), Framer Motion (animations), `lucide-react` (icons)
*   **State Management/Data Fetching:** TanStack Query (React Query)
*   **Build Tool:** Vite

### Backend
*   **Runtime:** Node.js
*   **Framework:** Express.js
*   **Real-time Communication:** WebSocket (`ws`)
*   **Authentication:** JWT (JSON Web Tokens), `bcryptjs`
*   **Distributed Ledger:** Custom in-memory distributed ledger system

### Database & Real-time Sync
*   **Database:** Convex (Live synchronization and persistent storage mapping the world state)

## 4. Key Features by Portal

### 4.1 Patient Portal (`/patient/*`)
*   **Dashboard & Profile:** Overview of health status, appointments, and personal details.
*   **Inpatient Care Management (`/patient/inpatient`):** Real-time tracking of admission status, vital signs (temperature, BP, heart rate, SpO2), medication schedules with countdowns, daily checkups, lab results, and procedures.
*   **Appointments & Telemedicine:** Booking and viewing upcoming appointments, supporting both in-person and telemedicine modes.
*   **Credentials Wallet (`/patient/wallet`):** Storage and management of verifiable credentials (e.g., vaccine passports, medical licenses, insurance).
*   **Consent Management (`/patient/consent`):** Granular control over which doctors can access specific medical records, with the ability to grant and revoke access.
*   **QR Check-in & ZK Proofs:** Secure identity verification using QR codes and Zero-Knowledge Proofs to confirm attributes (e.g., insurance validity) without revealing full medical history.

### 4.2 Staff Portal (`/staff/*`)
*   **Command Center & Dashboard:** Unified view of hospital operations, patient statuses, and urgent alerts.
*   **Patient Management:** Access to assigned patient records, history, and vitals.
*   **Prescriptions (`/staff/sign`):** Secure signing and issuance of digital prescriptions linked to the patient's DID.
*   **Lab Orders & Tracker:** Ordering lab tests and tracking their status and results.
*   **Schedule & Attendance:** Managing doctor schedules, shifts, and tracking staff location via a simulated beacon system.

### 4.3 Admin Console (`/admin/*`)
*   **Digital Twin (`/admin/digital-twin`):** A live visual hierarchy of the hospital's DID infrastructure.
*   **DID & Credential Management:** Issuing and revoking decentralized identifiers and verifiable credentials across the network.
*   **Resource Tracking (Beds & Infrastructure):** Real-time management of bed availability and ward statuses.
*   **Audit Timeline (`/audit-timeline`):** An immutable, detailed log of all system events (access, consent changes, prescriptions) backed by the distributed ledger.
*   **Fraud Detection & Compliance:** Monitoring for unusual access patterns, tracking policy violations, and ensuring compliance with HIPAA, GDPR, etc.

## 5. Security & Access Control
*   **Role-Based Access Control (RBAC):** Strict enforcement of user roles (Patient, Staff, Admin). A `RouteGuard` component ensures users can only access routes permitted for their role. Admins have superuser access to all portals.
*   **Authentication:** Secure login using JWTs stored on the client.
*   **Decentralized Identity (DID):** Every entity (patient, doctor, device) is identified by a unique DID, anchoring their digital presence and interactions securely.
*   **Zero-Knowledge Proofs (ZKP):** Enables privacy-preserving verifications.

## 6. Project Structure (Pin-to-Pin)

*   `.lovable/` & `components.json`: Configuration for Lovable and UI component setup.
*   `convex/`: Contains the Convex schema (`schema.ts`) and server-side functions (`records.ts`) for real-time database synchronization.
*   `backend/`: The Express REST + WebSocket backend server.
    *   `server.js`: Express server, WebSocket setup, REST endpoints, and in-memory ledger logic.
    *   `world-state-db.js`: Functions for managing the state of the distributed ledger (put, get, query).
*   `src/`: Main frontend source code.
    *   `components/`: Reusable React components (UI elements, route guards, sidebar, layout).
        *   `ui/`: Radix UI based basic components (buttons, dialogs, etc.).
    *   `hooks/`: Custom React hooks.
    *   `lib/`: Utility functions, API clients (`api.ts`), mock data, authentication logic (`auth.ts`), and offline queuing mechanisms.
    *   `routes/`: TanStack Start file-based routes.
        *   `__root.tsx`: The root application layout, providing context providers (Query, Convex, Theme, Sidebar).
        *   `index.tsx`: The main landing page.
        *   `patient.*.tsx`: Patient portal routes.
        *   `staff.*.tsx`: Staff portal routes.
        *   `admin.*.tsx`: Admin console routes.
    *   `router.tsx`: TanStack Router configuration.
    *   `server.ts`: Server entry point for TanStack Start SSR.
*   `package.json` & `vite.config.ts`: Project dependencies, scripts, and build configuration.

## 7. Conclusion
The DID Hospital Infrastructure project is a highly advanced, feature-rich simulation of a next-generation healthcare system. By combining modern frontend technologies with a distributed backend system and real-time database syncing, it successfully demonstrates the practical application of Decentralized Identity, Verifiable Credentials, and secure role-based access in a complex medical environment.

### 6.1 Folder Structure Detail (tree)
```
.
├── INPATIENT_FEATURES.md          # Documentation for inpatient features
├── PROJECT_REPORT.md              # This project report
├── RBAC_IMPLEMENTATION.md         # Documentation for Role-Based Access Control
├── components.json                # Radix/shadcn UI configuration
├── convex/                        # Convex database schema and server functions
│   ├── records.ts                 # Convex server functions for database interaction
│   └── schema.ts                  # Convex database schema definitions
├── eslint.config.js               # Linter configuration
├── backend/                       # Express REST + WebSocket backend server
│   ├── data/                      # Initial mock data/world state JSON files
│   ├── package.json               # Backend dependencies
│   ├── server.js                  # Main Express and WebSocket server for simulation
│   └── world-state-db.js          # In-memory world state management logic
├── package.json                   # Main project dependencies and scripts
├── public/                        # Static assets
│   └── favicon.svg                # Application favicon
├── src/                           # Frontend source code
│   ├── components/                # React components
│   │   ├── AppSidebar.tsx         # Global sidebar navigation
│   │   ├── RouteGuard.tsx         # Component protecting routes based on roles
│   │   ├── RoleSwitcher.tsx       # Component for admins to switch viewing roles
│   │   ├── audit/                 # Components for audit logs and timeline
│   │   ├── consent/               # Components for consent management
│   │   ├── credentials/           # Components for VC wallet and display
│   │   ├── did/                   # Components for DID exploration and visualization
│   │   ├── emergency/             # Components for emergency access ("break-glass")
│   │   ├── federation/            # Components for inter-hospital network view
│   │   ├── infrastructure/        # Components for beds, equipment, ambulance tracking
│   │   ├── insurance/             # Components for insurance and claims
│   │   └── ui/                    # Reusable, atomic Radix UI components (shadcn)
│   ├── hooks/                     # Custom React hooks (e.g., use-api.ts)
│   ├── lib/                       # Utilities, API integrations, and mock data
│   │   ├── auth.ts                # Client-side authentication logic
│   │   ├── convex-client.ts       # Convex connection setup
│   │   ├── api.ts                 # API client for interacting with backend
│   │   └── zkproof.ts             # Logic for generating/verifying Zero-Knowledge Proofs
│   ├── routes/                    # TanStack Start file-based routing directory
│   │   ├── __root.tsx             # Root layout and context providers
│   │   ├── index.tsx              # Main landing page
│   │   ├── patient.*.tsx          # Patient portal routes (e.g., patient.inpatient.tsx)
│   │   ├── staff.*.tsx            # Staff portal routes (e.g., staff.sign.tsx)
│   │   └── admin.*.tsx            # Admin console routes (e.g., admin.digital-twin.tsx)
│   ├── router.tsx                 # TanStack Router configuration
│   ├── server.ts                  # TanStack Start SSR entry point
│   ├── start.ts                   # TanStack Start client entry point
│   └── styles.css                 # Global Tailwind CSS styles
├── tsconfig.json                  # TypeScript configuration
└── vite.config.ts                 # Vite build and development configuration
```
