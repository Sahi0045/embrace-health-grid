# Role-Based Access Control (RBAC) Implementation

## Overview
This application implements a comprehensive RBAC system with three user roles:
- **Patient**: Can only access patient routes
- **Staff**: Can only access staff routes  
- **Admin**: Can access ALL routes (patient, staff, and admin)

## Access Control Rules

### Patient Role
- ✅ Can access: `/patient/*` routes
- ❌ Cannot access: `/staff/*` or `/admin/*` routes
- Redirected to access denied page if attempting to access restricted routes

### Staff Role
- ✅ Can access: `/staff/*` routes
- ❌ Cannot access: `/patient/*` or `/admin/*` routes
- Redirected to access denied page if attempting to access restricted routes

### Admin Role (Super User)
- ✅ Can access: ALL routes (`/patient/*`, `/staff/*`, `/admin/*`)
- Can switch between all three role views using the role switcher
- Has full system access for oversight and management

## Implementation Details

### 1. Authentication Module (`src/lib/auth.ts`)
- `getCurrentUser()`: Retrieves current user from localStorage
- `isAuthenticated()`: Checks if user is logged in
- `hasAccess(userRole, requiredRole)`: Validates role-based access
- `logout()`: Clears session and redirects to login

### 2. Route Guard Component (`src/components/RouteGuard.tsx`)
- Wraps protected routes to enforce access control
- Redirects unauthenticated users to `/login`
- Shows "Access Denied" page for unauthorized access attempts
- Provides navigation back to user's appropriate dashboard

### 3. Role Switcher (`src/components/RoleSwitcher.tsx`)
- Displays available roles based on user permissions
- Admin sees all three roles (Patient, Staff, Admin)
- Non-admin users see only their assigned role
- Locked roles shown with lock icon for non-admin users

### 4. Sidebar Navigation (`src/components/AppSidebar.tsx`)
- Dynamically shows navigation based on user role
- Admin can see navigation for any section they're viewing
- Non-admin users only see their role-specific navigation

## Protected Routes

All role-specific routes are protected with `<RouteGuard>`:

### Patient Routes
- `/patient` - Patient home
- `/patient/profile` - Patient profile
- `/patient/qr` - QR code
- `/patient/appointments` - Appointments
- `/patient/wallet` - Credentials wallet
- `/patient/consent` - Consent management
- `/patient/history` - Access history

### Staff Routes
- `/staff` - Staff dashboard
- `/staff/profile` - Staff profile
- `/staff/verify` - Verify patient
- `/staff/patients` - Patient list
- `/staff/schedule` - Schedule
- `/staff/sign` - Sign & prescribe

### Admin Routes
- `/admin` - Admin overview
- `/admin/profile` - Admin profile
- `/admin/dids` - DID management
- `/admin/policies` - Policies
- `/admin/audit` - Audit logs
- `/admin/fraud` - Fraud detection
- `/admin/compliance` - Compliance

## Testing RBAC

### Test as Patient
1. Login with role: Patient
2. Try accessing `/staff` or `/admin` → Should see "Access Denied"
3. Can only access `/patient/*` routes

### Test as Staff
1. Login with role: Staff
2. Try accessing `/patient` or `/admin` → Should see "Access Denied"
3. Can only access `/staff/*` routes

### Test as Admin
1. Login with role: Admin
2. Can access `/patient`, `/staff`, and `/admin` routes
3. Role switcher shows all three roles
4. Can freely navigate between all sections

## Security Features

1. **Client-side validation**: Immediate feedback on unauthorized access
2. **Route-level protection**: Every protected route wrapped with RouteGuard
3. **Session management**: User role stored in localStorage
4. **Graceful degradation**: Clear error messages for access violations
5. **Navigation guards**: Sidebar and role switcher respect permissions

## Future Enhancements

- Server-side session validation
- JWT token-based authentication
- Role hierarchy and custom permissions
- Audit logging for access attempts
- Multi-factor authentication
- Session timeout and refresh
