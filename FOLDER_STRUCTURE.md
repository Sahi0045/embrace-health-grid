# Comprehensive Project Folder Structure

```
.
├── INPATIENT_FEATURES.md          # Documentation for inpatient care tracking module
├── PROJECT_REPORT.md              # Full architecture and project features report
├── RBAC_IMPLEMENTATION.md         # Documentation detailing Role-Based Access Control
├── bun.lock                       # Bun package manager lock file
├── bunfig.toml                    # Bun configuration file
├── components.json                # shadcn/ui component configuration
├── convex/                        # Convex database configuration and server functions
│   ├── records.ts                 # Convex server-side mutations and queries
│   └── schema.ts                  # Convex database schema definition
├── eslint.config.js               # ESLint linting rules and configuration
├── fabric-backend/                # Custom simulated Hyperledger Fabric Node.js server
│   ├── data/                      # Initial JSON mock data for world state
│   │   ├── appointments.json      # Mock appointments
│   │   ├── audit.json             # Mock audit logs
│   │   ├── beds.json              # Mock bed statuses
│   │   ├── billing.json           # Mock billing data
│   │   ├── consent-manager.json   # Mock consent grants
│   │   ├── credentials.json       # Mock verifiable credentials
│   │   ├── did-registry.json      # Mock Decentralized Identifiers (DIDs)
│   │   ├── tracker.json           # Mock staff tracking data
│   │   └── users.json             # Mock user authentication data
│   ├── package-lock.json          # Backend npm lock file
│   ├── package.json               # Backend dependencies (Express, WS, etc.)
│   ├── server.js                  # Main Express API and WebSocket server
│   └── world-state-db.js          # In-memory database logic simulating the ledger world state
├── package-lock.json              # Main project npm lock file
├── package.json                   # Main project dependencies (React, Vite, TanStack)
├── pnpm-lock.yaml                 # pnpm lock file
├── pnpm-workspace.yaml            # pnpm workspace configuration
├── public/                        # Public static assets
│   └── favicon.svg                # Application favicon
├── src/                           # Main frontend source code
│   ├── components/                # React components
│   │   ├── AppSidebar.tsx         # Global navigation sidebar
│   │   ├── EmptyState.tsx         # Generic empty state UI component
│   │   ├── FabricStatusBar.tsx    # Header status bar showing Fabric network status
│   │   ├── HyperledgerProvider.tsx# Context provider for Fabric/Convex state
│   │   ├── Motion.tsx             # Framer Motion utility components
│   │   ├── NotificationBell.tsx   # Header notification dropdown
│   │   ├── PageHeader.tsx         # Generic page header component
│   │   ├── PhoneFrame.tsx         # UI component to simulate a mobile device view
│   │   ├── QrCode.tsx             # Component to render QR codes
│   │   ├── QrPlaceholder.tsx      # Placeholder for scanning QR codes
│   │   ├── RoleSwitcher.tsx       # UI for admins to switch between patient/staff/admin views
│   │   ├── RouteGuard.tsx         # Higher-order component protecting routes based on roles
│   │   ├── Skeleton.tsx           # Loading skeleton UI component
│   │   ├── audit/                 # Components related to audit logs
│   │   │   ├── AuditEventCard.tsx # Individual audit event display
│   │   │   └── AuditTimeline.tsx  # Timeline view of audit events
│   │   ├── consent/               # Components related to consent management
│   │   │   ├── ConsentCard.tsx    # Individual consent grant display
│   │   │   ├── ConsentHistory.tsx # History of consent changes
│   │   │   └── ConsentToggle.tsx  # UI to grant/revoke consent
│   │   ├── credentials/           # Components for Verifiable Credentials
│   │   │   ├── CredentialCard.tsx # Card displaying a credential
│   │   │   ├── CredentialIssuerBadge.tsx # Badge identifying the issuer
│   │   │   ├── CredentialPreview.tsx # Preview of a credential
│   │   │   └── CredentialTimeline.tsx # Timeline of credential issuance
│   │   ├── did/                   # Components for Decentralized Identifiers
│   │   │   ├── DIDBadge.tsx       # Small badge displaying a DID
│   │   │   ├── DIDCard.tsx        # Card with full DID details
│   │   │   ├── DIDRelationshipGraph.tsx # Visual graph of DID relationships
│   │   │   └── DIDStatusChip.tsx  # UI chip showing DID status (active/revoked)
│   │   ├── emergency/             # Components for emergency access features
│   │   │   ├── BreakGlassRequestCard.tsx # Request for emergency 'break-glass' access
│   │   │   └── EmergencyAccessCard.tsx # UI for granting emergency access
│   │   ├── federation/            # Components for inter-hospital networking
│   │   │   ├── FederationHospitalCard.tsx # Display of a node in the federation
│   │   │   └── FederationNode.tsx # Individual node component
│   │   ├── infrastructure/        # Components for hospital resources
│   │   │   ├── AmbulanceCard.tsx  # Tracking ambulance status
│   │   │   ├── BedStatusCard.tsx  # Tracking individual bed occupancy
│   │   │   ├── EquipmentCard.tsx  # Tracking medical equipment
│   │   │   └── FacilityMap.tsx    # Visual map of hospital facility
│   │   ├── insurance/             # Components for billing and insurance
│   │   │   ├── ClaimsCard.tsx     # Displaying insurance claims
│   │   │   └── InsuranceCard.tsx  # Displaying insurance policy details
│   │   └── ui/                    # Base UI components (shadcn/Radix)
│   │       ├── accordion.tsx      # Accordion component
│   │       ├── alert-dialog.tsx   # Alert dialog component
│   │       ├── alert.tsx          # Alert component
│   │       ├── aspect-ratio.tsx   # Aspect ratio container
│   │       ├── avatar.tsx         # User avatar component
│   │       ├── badge.tsx          # Badge/chip component
│   │       ├── breadcrumb.tsx     # Breadcrumb navigation
│   │       ├── button.tsx         # Button component
│   │       ├── calendar.tsx       # Calendar/date picker component
│   │       ├── card.tsx           # Card container component
│   │       ├── carousel.tsx       # Carousel/slider component
│   │       ├── chart.tsx          # Recharts wrapper component
│   │       ├── checkbox.tsx       # Checkbox input
│   │       ├── collapsible.tsx    # Collapsible container
│   │       ├── command.tsx        # Command palette (cmdk)
│   │       ├── context-menu.tsx   # Right-click context menu
│   │       ├── dialog.tsx         # Modal dialog component
│   │       ├── drawer.tsx         # Mobile drawer/bottom sheet
│   │       ├── dropdown-menu.tsx  # Dropdown menu component
│   │       ├── form.tsx           # React Hook Form wrapper
│   │       ├── hover-card.tsx     # Hover card tooltip
│   │       ├── input-otp.tsx      # One-time password input
│   │       ├── input.tsx          # Text input field
│   │       ├── label.tsx          # Form label
│   │       ├── menubar.tsx        # Top menubar navigation
│   │       ├── navigation-menu.tsx# Navigation menu component
│   │       ├── pagination.tsx     # Pagination controls
│   │       ├── popover.tsx        # Popover container
│   │       ├── progress.tsx       # Progress bar
│   │       ├── radio-group.tsx    # Radio button group
│   │       ├── resizable.tsx      # Resizable panel container
│   │       ├── scroll-area.tsx    # Custom scrollbar container
│   │       ├── select.tsx         # Select/dropdown input
│   │       ├── separator.tsx      # Visual divider
│   │       ├── sheet.tsx          # Slide-out sheet/sidebar
│   │       ├── sidebar.tsx        # Sidebar layout component
│   │       ├── skeleton.tsx       # Loading skeleton base
│   │       ├── slider.tsx         # Range slider input
│   │       ├── sonner.tsx         # Toast notification provider
│   │       ├── switch.tsx         # Toggle switch input
│   │       ├── table.tsx          # Data table components
│   │       ├── tabs.tsx           # Tabbed navigation
│   │       ├── textarea.tsx       # Multiline text input
│   │       ├── toggle-group.tsx   # Group of toggle buttons
│   │       ├── toggle.tsx         # Toggle button
│   │       └── tooltip.tsx        # Tooltip popup
│   ├── hooks/                     # Custom React Hooks
│   │   ├── use-fabric.ts          # Hook to interact with Fabric simulation backend
│   │   ├── use-mobile.tsx         # Hook to detect mobile screen size
│   │   ├── use-notifications.ts   # Hook to manage notifications
│   │   └── use-simulated-loading.ts # Hook for simulated network delay
│   ├── lib/                       # Utilities and helper functions
│   │   ├── api/                   # API client integrations
│   │   │   └── example.functions.ts # Example API calls
│   │   ├── attendance-data.ts     # Mock data for staff attendance
│   │   ├── auth.ts                # LocalStorage based authentication logic
│   │   ├── billing-data.ts        # Mock data for billing
│   │   ├── config.server.ts       # Server configuration variables
│   │   ├── convex-client.ts       # Initialization of Convex client
│   │   ├── error-capture.ts       # Error tracking utility
│   │   ├── error-page.ts          # Error page rendering utility
│   │   ├── fabric-api.ts          # API client for the Express backend
│   │   ├── fabric-worker.ts       # Web Worker for background Fabric tasks
│   │   ├── hyperledger.ts         # Hyperledger constants/types
│   │   ├── infrastructure-data.ts # Mock data for infrastructure
│   │   ├── inpatient-data.ts      # Mock data and models for inpatient care
│   │   ├── lovable-error-reporting.ts # Telemetry/error reporting for Lovable
│   │   ├── medical-records-data.ts# Mock data for medical records
│   │   ├── mock-audit.ts          # Mock data for audit logs
│   │   ├── mock-credentials.ts    # Mock data for credentials
│   │   ├── mock-data.ts           # General mock data utilities
│   │   ├── mock-infrastructure.ts # Mock infrastructure data
│   │   ├── mock-patients.ts       # Mock patient profiles
│   │   ├── mock-staff.ts          # Mock staff profiles
│   │   ├── notifications.ts       # Logic for notification polling
│   │   ├── offline-queue.ts       # Logic for queuing requests while offline
│   │   ├── people-data.ts         # Mock data for people/users
│   │   ├── realtime-store.ts      # Zustand or similar local real-time store
│   │   ├── utils.ts               # General utility functions (e.g., tailwind merge)
│   │   └── zkproof.ts             # Client-side Zero-Knowledge Proof generation
│   ├── routeTree.gen.ts           # Auto-generated TanStack Route tree
│   ├── router.tsx                 # TanStack Router initialization and configuration
│   ├── routes/                    # File-based routing pages
│   │   ├── README.md              # Instructions for routing conventions
│   │   ├── __root.tsx             # Root layout wrapping all pages
│   │   ├── admin.attendance.tsx   # Admin: Staff attendance view
│   │   ├── admin.audit.tsx        # Admin: Audit logs dashboard
│   │   ├── admin.chaincode.tsx    # Admin: Chaincode management
│   │   ├── admin.command.tsx      # Admin: Hospital command center
│   │   ├── admin.compliance.tsx   # Admin: Compliance checks
│   │   ├── admin.credentials.tsx  # Admin: Credential issuance/management
│   │   ├── admin.dids.tsx         # Admin: DID management
│   │   ├── admin.digital-twin.tsx # Admin: Live Digital Twin map
│   │   ├── admin.federation.tsx   # Admin: Hospital federation network
│   │   ├── admin.financial.tsx    # Admin: Financial reports
│   │   ├── admin.fraud.tsx        # Admin: Fraud detection alerts
│   │   ├── admin.hyperledger.tsx  # Admin: Fabric network status
│   │   ├── admin.index.tsx        # Admin: Main dashboard
│   │   ├── admin.infrastructure.tsx # Admin: Infrastructure management
│   │   ├── admin.people.tsx       # Admin: User/Staff management
│   │   ├── admin.policies.tsx     # Admin: System policies
│   │   ├── admin.profile.tsx      # Admin: Profile settings
│   │   ├── admin.resources.tsx    # Admin: Resource allocation
│   │   ├── audit-timeline.tsx     # Global: Audit timeline view
│   │   ├── credential-explorer.tsx# Global: VC Explorer
│   │   ├── did-explorer.tsx       # Global: DID Explorer
│   │   ├── index.tsx              # Public: Landing page
│   │   ├── login.tsx              # Public: Login page
│   │   ├── patient.appointments.tsx # Patient: Manage appointments
│   │   ├── patient.billing.tsx    # Patient: Billing and invoices
│   │   ├── patient.consent.tsx    # Patient: Manage data consent
│   │   ├── patient.emergency.tsx  # Patient: Emergency profile
│   │   ├── patient.family.tsx     # Patient: Family access controls
│   │   ├── patient.history.tsx    # Patient: Medical history
│   │   ├── patient.index.tsx      # Patient: Main dashboard
│   │   ├── patient.inpatient.tsx  # Patient: Inpatient care tracking
│   │   ├── patient.insurance.tsx  # Patient: Insurance info
│   │   ├── patient.profile.tsx    # Patient: Profile details
│   │   ├── patient.qr.tsx         # Patient: QR Code for check-in
│   │   ├── patient.records.tsx    # Patient: View medical records
│   │   ├── patient.telemedicine.tsx # Patient: Telemedicine sessions
│   │   ├── patient.vaccines.tsx   # Patient: Vaccine passport
│   │   ├── patient.wallet.tsx     # Patient: Verifiable Credentials wallet
│   │   ├── patient.zkproof.tsx    # Patient: Generate ZK Proofs
│   │   ├── staff.attendance.tsx   # Staff: Clock-in/Clock-out
│   │   ├── staff.command.tsx      # Staff: Ward command center
│   │   ├── staff.emergency.tsx    # Staff: ER view
│   │   ├── staff.index.tsx        # Staff: Main dashboard
│   │   ├── staff.labs.tsx         # Staff: View lab results
│   │   ├── staff.patients.tsx     # Staff: Patient list
│   │   ├── staff.prescriptions.tsx# Staff: Manage prescriptions
│   │   ├── staff.profile.tsx      # Staff: Profile settings
│   │   ├── staff.schedule.tsx     # Staff: Schedule and shifts
│   │   ├── staff.sign.tsx         # Staff: Sign prescriptions/notes
│   │   ├── staff.surgeries.tsx    # Staff: Surgical schedule
│   │   ├── staff.tracker.tsx      # Staff: Location tracking
│   │   └── staff.verify.tsx       # Staff: Verify patient QR/credentials
│   ├── server.ts                  # Server entry for SSR (TanStack Start)
│   ├── start.ts                   # Client entry for SSR hydration
│   └── styles.css                 # Global CSS and Tailwind directives
├── tsconfig.json                  # TypeScript compiler settings
├── vercel.json                    # Vercel deployment configuration
└── vite.config.ts                 # Vite bundler configuration
```
