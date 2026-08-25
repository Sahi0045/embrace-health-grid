/**
 * Response shapes for `src/lib/api.ts`.
 *
 * WHY THIS FILE EXISTS
 * ────────────────────
 * `api.ts` is the boundary between route components and the `*.server.ts`
 * server functions, and almost everything used to cross it as `any`. Components
 * read field names the API never returned and nothing caught it. Every one of
 * these was a real, shipped defect:
 *
 *   - `getRehabSessions` returns `sessionType`; the records page read
 *     `session.type` → TypeError that took down the whole Rehab tab on click.
 *   - `getVaccines` returns {id, name, doseNumber, administeredOn, …}; the
 *     vaccines page read `vaccine`, `issuer`, `status`, `doses`, `lastDose` —
 *     one field of eight matched, so every card rendered blank.
 *   - `getConsents` returns `grantId`; the consent screen read
 *     `c.id ?? c.txId ?? String(Math.random())` → revoke could never match a
 *     row, so a patient could not withdraw a doctor's access at all.
 *   - `getBilling` returns `totalPaid`; the billing page read `amountPaid` →
 *     "Amount Paid" always read ₹0.
 *
 * WHY THESE ARE HAND-WRITTEN, NOT DERIVED FROM `database.types.ts`
 * ────────────────────────────────────────────────────────────────
 * `api.ts` does not return rows — it returns view models. `getVaccines` renames
 * `vaccine_id → id`; `getBilling` synthesises a summary from a billing_accounts
 * row plus fields that have no column at all. `Tables<'vaccines'>` cannot
 * describe that, and `Pick`/`Omit`/rename gymnastics would be longer and less
 * readable than the interface. Generated row types belong upstream, in the
 * `*.server.ts` layer where `.from(...)` genuinely returns a row.
 *
 * HOW TO USE
 * ──────────
 * DECLARE the return type on the api function — do not rely on inference.
 * Inference widens to whatever the mapper happens to produce, which is exactly
 * the bug. An explicit annotation makes the mapper's object literal subject to
 * missing- and excess-property checks.
 *
 * NOTE: do not import shapes from `src/lib/types.ts` for this purpose. That file
 * exports similarly-named types (`ConsentGrant`, `Appointment`, `Credential`)
 * which are the demo/mock shapes, NOT what these functions return. Importing the
 * wrong one is a fresh instance of the very bug this file prevents.
 */

// ─── Consent ────────────────────────────────────────────────────────────────

export interface ConsentRecord {
  grantId: string;
  patientDid: string;
  doctorDid: string;
  resource: string;
  status: string;
  /** The doctor's stated justification. Null until they supply one. */
  reason: string | null;
  grantedAt: string | null;
  expiresAt: string | null;
  requestedAt: string | null;
  /** The doctor read policies require this to be non-null. */
  approvedAt: string | null;
  revokedAt: string | null;
  /** @deprecated alias of `expiresAt`; `getMyConsents` keys a validity check on it. */
  expiry: string | null;
}

export interface ConsentsResponse {
  consents: ConsentRecord[];
  /** @deprecated alias of `consents`. Migrate readers, then remove. */
  grants: ConsentRecord[];
  total: number;
}

// ─── Vaccines ───────────────────────────────────────────────────────────────

export interface VaccineRecord {
  id: string;
  patientDid: string;
  name: string;
  doseNumber: number | null;
  administeredOn: string | null;
  administeredBy: string | null;
  batchNumber: string | null;
  nextDueOn: string | null;
}

export interface VaccinesResponse {
  vaccines: VaccineRecord[];
  total: number;
}

// ─── Rehab ──────────────────────────────────────────────────────────────────

export interface RehabSession {
  id: string;
  patientDid: string;
  /** The column is `session_type`. Reading `type` here is what crashed the tab. */
  sessionType: string;
  /** Mapped from `session_date`; the mapper emits it as `date`. */
  date: string | null;
  therapist: string | null;
  status: string | null;
  notes: string | null;
}

export interface RehabSessionsResponse {
  sessions: RehabSession[];
  /** @deprecated alias of `sessions`. */
  rehabSessions: RehabSession[];
  total: number;
}

// ─── Billing ────────────────────────────────────────────────────────────────

export interface BillSummary {
  outstanding: number;
  totalBilled: number;
  totalPaid: number;
  /** @deprecated alias of `totalBilled`. */
  totalCharges: number;
  /** @deprecated alias of `outstanding`. */
  balanceDue: number;
  /** @deprecated alias of `totalPaid`; the billing page reads this name. */
  amountPaid: number;

  /**
   * No column backs any of these — `billing_accounts` has no bill number,
   * period, status or insurance split. Explicitly null so the UI can say
   * "not available" instead of rendering ₹0 as though it were a real figure.
   */
  billNumber: string | null;
  status: string | null;
  fromDate: string | null;
  toDate: string | null;
  insuranceClaimed: number | null;
  insurancePending: number | null;
  patientResponsibility: number | null;
  /** A map, not an array — `.map()` on this would throw. */
  categoryTotals: Record<string, number> | null;
}

export interface PaymentRecord {
  id: string;
  amount: number;
  method: string | null;
  status: string | null;
  reference: string | null;
  date: string | null;
}

export interface BillingResponse {
  outstanding: number;
  totalBilled: number;
  totalPaid: number;
  bills: PaymentRecord[];
  payments: unknown[];
  billSummary: BillSummary;
  /** @deprecated alias of `bills`. */
  paymentRecords: PaymentRecord[];
  /** No source table yet; empty so the tab can show an empty state. */
  billItems: unknown[];
  dailyCharges: unknown[];
}

// ─── Insurance ──────────────────────────────────────────────────────────────

export interface InsuranceClaim {
  claimId: string;
  /** @deprecated alias of `claimId`. */
  id: string;
  /** @deprecated alias of `claimId`; `insurance_claims` has no separate number. */
  claimNo: string;
  patientDid: string;
  amount: number;
  description: string | null;
  remarks: string | null;
  status: string;
  submittedAt: string | null;
  /** @deprecated alias of `submittedAt`. */
  submittedDate: string | null;
  processedDate: string | null;
  /** No columns back these three; null so the card omits them. */
  claimType: string | null;
  insuranceProvider: string | null;
  approvedAmount: number | null;
}

export interface InsuranceClaimsResponse {
  claims: InsuranceClaim[];
}

export interface InsurancePolicy {
  provider: string | null;
  policyNumber: string | null;
  groupNumber: string | null;
  coverageType: string | null;
  copay: number | null;
  deductible: number | null;
  coveragePercentage: number | null;
  validFrom: string | null;
  validTo: string | null;
}

export interface InsurancePolicyResponse {
  policy: InsurancePolicy | null;
}

// ─── Labs ───────────────────────────────────────────────────────────────────

export interface LabResult {
  labId: string;
  patientDid: string;
  testName: string;
  /** A scalar, not an array of parameters. */
  resultValue: string | null;
  unit: string | null;
  referenceRange: string | null;
  status: string | null;
  resultedAt: string | null;
}
