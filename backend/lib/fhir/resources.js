/**
 * HL7 FHIR R4 Resource Definitions
 * Implements FHIR (Fast Healthcare Interoperability Resources) standard
 *
 * Enables interoperability with other healthcare systems
 * Reference: https://www.hl7.org/fhir/
 */

import { randomUUID } from "crypto";

/**
 * Generate FHIR-compliant resource ID
 */
function generateFHIRId() {
  return randomUUID();
}

/**
 * Base FHIR Resource structure
 */
class FHIRResource {
  constructor(resourceType) {
    this.resourceType = resourceType;
    this.id = generateFHIRId();
    this.meta = {
      versionId: "1",
      lastUpdated: new Date().toISOString(),
      profile: [`http://hl7.org/fhir/StructureDefinition/${resourceType}`]
    };
  }
}

/**
 * FHIR Patient Resource
 * Maps to our patient data structure
 */
export class FHIRPatient extends FHIRResource {
  constructor(patientData) {
    super("Patient");

    this.identifier = patientData.identifiers || [
      {
        system: "urn:oid:embrace-health",
        value: patientData.id || patientData.did,
        type: {
          coding: [{
            system: "http://terminology.hl7.org/CodeSystem/v2-0203",
            code: "MR",
            display: "Medical Record Number"
          }]
        }
      }
    ];

    this.active = patientData.active !== false;

    this.name = [{
      use: "official",
      family: patientData.lastName || patientData.name?.split(" ").pop(),
      given: [patientData.firstName || patientData.name?.split(" ")[0]],
      text: patientData.name
    }];

    this.telecom = [];
    if (patientData.email) {
      this.telecom.push({
        system: "email",
        value: patientData.email,
        use: "home"
      });
    }
    if (patientData.phone) {
      this.telecom.push({
        system: "phone",
        value: patientData.phone,
        use: "home"
      });
    }

    this.gender = patientData.gender || "unknown";
    this.birthDate = patientData.birthDate || patientData.dateOfBirth;

    if (patientData.address) {
      this.address = [{
        use: "home",
        type: "physical",
        text: patientData.address,
        line: [patientData.address],
        city: patientData.city,
        state: patientData.state,
        postalCode: patientData.zipCode,
        country: patientData.country || "US"
      }];
    }

    // Extensions for additional data
    this.extension = [];
    if (patientData.did) {
      this.extension.push({
        url: "http://embrace-health.org/fhir/StructureDefinition/did",
        valueString: patientData.did
      });
    }
    if (patientData.bloodType) {
      this.extension.push({
        url: "http://embrace-health.org/fhir/StructureDefinition/blood-type",
        valueCodeableConcept: {
          coding: [{
            system: "http://loinc.org",
            code: patientData.bloodType,
            display: patientData.bloodType
          }]
        }
      });
    }
  }
}

/**
 * FHIR Observation Resource
 * Used for vital signs, lab results
 */
export class FHIRObservation extends FHIRResource {
  constructor(observationData) {
    super("Observation");

    this.status = observationData.status || "final";
    this.category = [{
      coding: [{
        system: "http://terminology.hl7.org/CodeSystem/observation-category",
        code: observationData.category || "vital-signs",
        display: "Vital Signs"
      }]
    }];

    this.code = {
      coding: [observationData.coding || {
        system: "http://loinc.org",
        code: observationData.loincCode,
        display: observationData.name
      }],
      text: observationData.name
    };

    this.subject = {
      reference: `Patient/${observationData.patientId}`,
      display: observationData.patientName
    };

    this.effectiveDateTime = observationData.timestamp || new Date().toISOString();

    // Value with unit
    if (observationData.value !== undefined) {
      this.valueQuantity = {
        value: observationData.value,
        unit: observationData.unit,
        system: "http://unitsofmeasure.org",
        code: observationData.unitCode || observationData.unit
      };
    }

    // Reference ranges
    if (observationData.referenceRange) {
      this.referenceRange = [{
        low: {
          value: observationData.referenceRange.low,
          unit: observationData.unit
        },
        high: {
          value: observationData.referenceRange.high,
          unit: observationData.unit
        }
      }];
    }

    // Interpretation (normal, high, low)
    if (observationData.interpretation) {
      this.interpretation = [{
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
          code: observationData.interpretation.toUpperCase(),
          display: observationData.interpretation
        }]
      }];
    }
  }
}

/**
 * FHIR MedicationRequest Resource
 * Used for prescriptions
 */
export class FHIRMedicationRequest extends FHIRResource {
  constructor(prescriptionData) {
    super("MedicationRequest");

    this.status = prescriptionData.status || "active";
    this.intent = "order";

    this.medicationCodeableConcept = {
      coding: [{
        system: "http://www.nlm.nih.gov/research/umls/rxnorm",
        code: prescriptionData.rxnormCode,
        display: prescriptionData.medication
      }],
      text: prescriptionData.medication
    };

    this.subject = {
      reference: `Patient/${prescriptionData.patientId}`,
      display: prescriptionData.patientName
    };

    this.authoredOn = prescriptionData.prescribedDate || new Date().toISOString();

    this.requester = {
      reference: `Practitioner/${prescriptionData.doctorId}`,
      display: prescriptionData.doctorName
    };

    this.dosageInstruction = [{
      text: prescriptionData.dosage,
      timing: {
        repeat: {
          frequency: prescriptionData.frequency || 1,
          period: 1,
          periodUnit: "d"
        }
      },
      route: {
        coding: [{
          system: "http://snomed.info/sct",
          code: "26643006",
          display: "Oral"
        }]
      },
      doseAndRate: [{
        doseQuantity: {
          value: prescriptionData.doseValue,
          unit: prescriptionData.doseUnit,
          system: "http://unitsofmeasure.org",
          code: prescriptionData.doseUnit
        }
      }]
    }];

    if (prescriptionData.duration) {
      this.dispenseRequest = {
        validityPeriod: {
          start: new Date().toISOString(),
          end: new Date(Date.now() + prescriptionData.duration * 24 * 60 * 60 * 1000).toISOString()
        },
        numberOfRepeatsAllowed: prescriptionData.refills || 0
      };
    }
  }
}

/**
 * FHIR Encounter Resource
 * Used for appointments and visits
 */
export class FHIREncounter extends FHIRResource {
  constructor(appointmentData) {
    super("Encounter");

    this.status = appointmentData.status || "planned";
    this.class = {
      system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
      code: appointmentData.encounterClass || "AMB",
      display: "ambulatory"
    };

    this.type = [{
      coding: [{
        system: "http://snomed.info/sct",
        code: "185349003",
        display: "Encounter for check up"
      }],
      text: appointmentData.reason
    }];

    this.subject = {
      reference: `Patient/${appointmentData.patientId}`,
      display: appointmentData.patientName
    };

    this.participant = [{
      individual: {
        reference: `Practitioner/${appointmentData.doctorId}`,
        display: appointmentData.doctorName
      }
    }];

    this.period = {
      start: appointmentData.scheduledTime,
      end: appointmentData.endTime
    };

    if (appointmentData.location) {
      this.location = [{
        location: {
          reference: `Location/${appointmentData.locationId}`,
          display: appointmentData.location
        }
      }];
    }
  }
}

/**
 * FHIR DiagnosticReport Resource
 * Used for lab results
 */
export class FHIRDiagnosticReport extends FHIRResource {
  constructor(labData) {
    super("DiagnosticReport");

    this.status = labData.status || "final";
    this.category = [{
      coding: [{
        system: "http://terminology.hl7.org/CodeSystem/v2-0074",
        code: "LAB",
        display: "Laboratory"
      }]
    }];

    this.code = {
      coding: [{
        system: "http://loinc.org",
        code: labData.loincCode,
        display: labData.testName
      }],
      text: labData.testName
    };

    this.subject = {
      reference: `Patient/${labData.patientId}`,
      display: labData.patientName
    };

    this.effectiveDateTime = labData.testDate || new Date().toISOString();
    this.issued = labData.resultDate || new Date().toISOString();

    this.performer = [{
      reference: `Organization/${labData.labId}`,
      display: labData.labName
    }];

    if (labData.results && Array.isArray(labData.results)) {
      this.result = labData.results.map(r => ({
        reference: `Observation/${r.id}`,
        display: r.name
      }));
    }

    this.conclusion = labData.interpretation;
  }
}

/**
 * Convert legacy data to FHIR format
 */
export function convertToFHIR(resourceType, data) {
  switch (resourceType) {
    case "Patient":
      return new FHIRPatient(data);
    case "Observation":
      return new FHIRObservation(data);
    case "MedicationRequest":
      return new FHIRMedicationRequest(data);
    case "Encounter":
      return new FHIREncounter(data);
    case "DiagnosticReport":
      return new FHIRDiagnosticReport(data);
    default:
      throw new Error(`Unsupported FHIR resource type: ${resourceType}`);
  }
}

/**
 * Create FHIR Bundle (collection of resources)
 */
export function createFHIRBundle(resources, type = "collection") {
  return {
    resourceType: "Bundle",
    id: generateFHIRId(),
    meta: {
      lastUpdated: new Date().toISOString()
    },
    type: type,
    total: resources.length,
    entry: resources.map(resource => ({
      fullUrl: `${resource.resourceType}/${resource.id}`,
      resource: resource
    }))
  };
}

/**
 * Validate FHIR resource structure
 */
export function validateFHIRResource(resource) {
  const errors = [];

  if (!resource.resourceType) {
    errors.push("Missing resourceType");
  }

  if (!resource.id) {
    errors.push("Missing resource id");
  }

  if (!resource.meta || !resource.meta.lastUpdated) {
    errors.push("Missing meta.lastUpdated");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * SNOMED CT code mappings (sample)
 * In production, integrate with full terminology server
 */
export const SNOMED_CODES = {
  // Conditions
  diabetes: "73211009",
  hypertension: "38341003",
  asthma: "195967001",

  // Procedures
  blood_test: "396550006",
  xray: "168537006",

  // Body sites
  left_arm: "368208006",
  right_arm: "368209003"
};

/**
 * ICD-10 code mappings (sample)
 * For diagnosis coding
 */
export const ICD10_CODES = {
  // Diabetes
  type2_diabetes: "E11",
  type1_diabetes: "E10",

  // Hypertension
  essential_hypertension: "I10",

  // Respiratory
  asthma_unspecified: "J45.909",

  // Cardiovascular
  chest_pain: "R07.9",

  // General
  fever: "R50.9",
  headache: "R51"
};

/**
 * LOINC code mappings for lab tests and vital signs
 */
export const LOINC_CODES = {
  // Vital Signs
  blood_pressure: "85354-9",
  heart_rate: "8867-4",
  respiratory_rate: "9279-1",
  body_temperature: "8310-5",
  oxygen_saturation: "59408-5",
  body_weight: "29463-7",
  body_height: "8302-2",
  bmi: "39156-5",

  // Lab Tests
  glucose: "2345-7",
  hemoglobin: "718-7",
  cholesterol_total: "2093-3",
  cholesterol_ldl: "18262-6",
  cholesterol_hdl: "2085-9",
  triglycerides: "2571-8",
  creatinine: "2160-0",
  sodium: "2951-2",
  potassium: "2823-3"
};
