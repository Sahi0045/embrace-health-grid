import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";


// ============================================================================
// Patient Hooks
// ============================================================================

/**
 * Hook to fetch all patients
 */
export function useConvexPatients() {
  return useQuery(api.records.getPatients);
}

/**
 * Hook to fetch a patient by DID
 */
export function useConvexPatient(did: string | undefined) {
  return useQuery(
    api.records.getPatientByDID,
    did ? { did } : "skip"
  );
}

/**
 * Hook to fetch a patient by MRN (Medical Record Number)
 */
export function useConvexPatientByMRN(mrn: string | undefined) {
  return useQuery(
    api.records.getPatientByMRN,
    mrn ? { mrn } : "skip"
  );
}

/**
 * Hook to fetch a patient by email
 */
export function useConvexPatientByEmail(email: string | undefined) {
  return useQuery(
    api.records.getPatientByEmail,
    email ? { email } : "skip"
  );
}

/**
 * Hook to create a new patient
 */
export function useCreatePatient() {
  return useMutation(api.records.createPatient);
}

/**
 * Hook to update an existing patient
 */
export function useUpdatePatient() {
  return useMutation(api.records.updatePatient);
}

/**
 * Hook to delete a patient
 */
export function useDeletePatient() {
  return useMutation(api.records.deletePatient);
}

// ============================================================================
// Staff Hooks
// ============================================================================

/**
 * Hook to fetch all staff members
 */
export function useConvexStaff() {
  return useQuery(api.records.getStaff);
}

/**
 * Hook to fetch a staff member by DID
 */
export function useConvexStaffMember(did: string | undefined) {
  return useQuery(
    api.records.getStaffByDID,
    did ? { did } : "skip"
  );
}

/**
 * Hook to fetch a staff member by employee ID
 */
export function useConvexStaffByEmployeeId(employeeId: string | undefined) {
  return useQuery(
    api.records.getStaffByEmployeeId,
    employeeId ? { employeeId } : "skip"
  );
}

/**
 * Hook to fetch a staff member by email
 */
export function useConvexStaffByEmail(email: string | undefined) {
  return useQuery(
    api.records.getStaffByEmail,
    email ? { email } : "skip"
  );
}

/**
 * Hook to create a new staff member
 */
export function useCreateStaff() {
  return useMutation(api.records.createStaff);
}

/**
 * Hook to update an existing staff member
 */
export function useUpdateStaff() {
  return useMutation(api.records.updateStaff);
}

/**
 * Hook to delete a staff member
 */
export function useDeleteStaff() {
  return useMutation(api.records.deleteStaff);
}

// ============================================================================
// DID Hooks
// ============================================================================

/**
 * Hook to fetch all DIDs
 */
export function useConvexDIDs() {
  return useQuery(api.records.getDIDs);
}

// ============================================================================
// Credential Hooks
// ============================================================================

/**
 * Hook to fetch all credentials
 */
export function useConvexCredentials() {
  return useQuery(api.records.getCredentials);
}

// ============================================================================
// Consent Hooks
// ============================================================================

/**
 * Hook to fetch all consents
 */
export function useConvexConsents() {
  return useQuery(api.records.getConsents);
}

// ============================================================================
// Audit Hooks
// ============================================================================

/**
 * Hook to fetch all audit events
 */
export function useConvexAuditEvents() {
  return useQuery(api.records.getAuditEvents);
}

// ============================================================================
// Bed Hooks
// ============================================================================

/**
 * Hook to fetch all beds
 */
export function useConvexBeds() {
  return useQuery(api.records.getBeds);
}

// ============================================================================
// Appointment Hooks
// ============================================================================

/**
 * Hook to fetch all appointments
 */
export function useConvexAppointments() {
  return useQuery(api.records.getAppointments);
}
