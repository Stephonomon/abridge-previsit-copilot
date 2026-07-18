import { effectiveChart, type PatientRecord, readBinary } from "../data/store.js";

/**
 * Mock Epic FHIR layer. Each operation mirrors a real Epic incoming API
 * (names taken verbatim from Abridge's Epic API list) and returns FHIR R4
 * resources from the patient fixtures.
 *
 * `toolName` is the Anthropic-tool-safe identifier; `apiName` is the exact
 * Epic API string shown in the Live Agent Activity panel.
 */
export interface FhirOperation {
  toolName: string;
  apiName: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run: (rec: PatientRecord, input: Record<string, any>) => any[];
}

const noParams = { type: "object", properties: {}, additionalProperties: false } as const;

const sinceParam = {
  type: "object",
  properties: {
    sinceISO: {
      type: "string",
      description: "Optional ISO date — only return resources effective on/after this date",
    },
  },
  additionalProperties: false,
} as const;

function since<T extends { effectiveDateTime?: string; date?: string; period?: { start?: string } }>(
  items: T[],
  input: Record<string, any>
): T[] {
  const s = input?.sinceISO;
  if (!s) return items;
  return items.filter((i) => {
    const d = i.effectiveDateTime ?? i.date ?? i.period?.start;
    return !d || d >= s;
  });
}

export const OPERATIONS: FhirOperation[] = [
  {
    toolName: "Patient_Read_Demographics",
    apiName: "Patient.Read (Demographics) (R4)",
    description: "Read the FHIR Patient resource (demographics) for the current patient.",
    inputSchema: noParams,
    run: (rec) => [effectiveChart(rec).patient],
  },
  {
    toolName: "Appointment_Read_Appointments",
    apiName: "Appointment.Read (Appointments) (R4)",
    description: "Read today's ED arrival context: chief complaint, ESI, room, arrival time, triage RN note, and triage vitals.",
    inputSchema: noParams,
    run: (rec) => [
      {
        resourceType: "Appointment",
        id: `appt-${rec.meta.id}`,
        status: "arrived",
        description: `ED Arrival — ${rec.meta.chiefComplaint}`,
        start: rec.meta.arrivalTime,
        extension: [
          { url: "esi", valueInteger: rec.meta.esi },
          { url: "room", valueString: rec.meta.room },
          { url: "triageNote", valueString: rec.meta.triageNote },
          { url: "triageVitals", valueString: JSON.stringify(rec.meta.triageVitals) },
        ],
      },
    ],
  },
  {
    toolName: "Encounter_Search_PatientChart",
    apiName: "Encounter.Search (Patient Chart) (R4)",
    description: "Search prior encounters (last 12 months): visit titles, dates, and disposition diagnoses.",
    inputSchema: sinceParam,
    run: (rec, input) => since(effectiveChart(rec).encounters, input),
  },
  {
    toolName: "Coverage_Search_Insurance",
    apiName: "Coverage.Search (Patient Insurance Information) (R4)",
    description: "Search the patient's insurance coverage.",
    inputSchema: noParams,
    run: (rec) => effectiveChart(rec).coverage,
  },
  {
    toolName: "Procedure_Search_Orders",
    apiName: "Procedure.Search (Orders) (R4)",
    description: "Search the patient's surgical/procedure history.",
    inputSchema: noParams,
    run: (rec) => effectiveChart(rec).procedures,
  },
  {
    toolName: "Condition_Search_Problems",
    apiName: "Condition.Search (Problems) (R4)",
    description: "Search the active problem list.",
    inputSchema: noParams,
    run: (rec) => effectiveChart(rec).conditionsProblems,
  },
  {
    toolName: "Condition_Search_MedicalHistory",
    apiName: "Condition.Search (Medical History) (R4)",
    description: "Search resolved/historical medical conditions.",
    inputSchema: noParams,
    run: (rec) => effectiveChart(rec).conditionsMedicalHistory,
  },
  {
    toolName: "MedicationRequest_Search_Signed",
    apiName: "MedicationRequest.Search (Signed Medication Order) (R4)",
    description: "Search active signed medication orders (home med list) plus any meds administered this visit.",
    inputSchema: noParams,
    run: (rec) => [
      ...effectiveChart(rec).medicationRequests,
      ...effectiveChart(rec).medicationAdministrations,
    ],
  },
  {
    toolName: "AllergyIntolerance_Search",
    apiName: "AllergyIntolerance.Search (Patient Chart) (R4)",
    description: "Search documented allergies and intolerances with reactions and criticality.",
    inputSchema: noParams,
    run: (rec) => effectiveChart(rec).allergies,
  },
  {
    toolName: "Observation_Search_Labs",
    apiName: "Observation.Search (Labs) (R4)",
    description: "Search lab result Observations (CBC, BMP, troponin, BNP, INR, lactate, UA, etc.) with values, units, reference ranges, and timestamps.",
    inputSchema: sinceParam,
    run: (rec, input) => since(effectiveChart(rec).observationsLabs, input),
  },
  {
    toolName: "Observation_Search_VitalSigns",
    apiName: "Observation.Search (Vital Signs) (R4)",
    description: "Search vital sign panels (today's triage vitals and historical vitals from prior visits).",
    inputSchema: sinceParam,
    run: (rec, input) => since(effectiveChart(rec).observationsVitals, input),
  },
  {
    toolName: "DiagnosticReport_Search_Results",
    apiName: "DiagnosticReport.Search (Results) (R4)",
    description: "Search diagnostic reports: ECG reads, imaging reports, echo reports, microbiology cultures with sensitivities.",
    inputSchema: sinceParam,
    run: (rec, input) => since(effectiveChart(rec).diagnosticReports, input),
  },
  {
    toolName: "DocumentReference_Search_Radiology",
    apiName: "DocumentReference.Search (Radiology Results) (R4)",
    description: "Search radiology result documents.",
    inputSchema: noParams,
    run: (rec) =>
      effectiveChart(rec).diagnosticReports.filter((r: any) =>
        (r.category ?? []).some((c: any) => /radiology|imaging/i.test(c.text ?? ""))
      ),
  },
  {
    toolName: "Observation_Search_Assessments",
    apiName: "Observation.Search (Assessments) (R4)",
    description: "Search clinical assessment observations documented this visit.",
    inputSchema: noParams,
    run: () => [],
  },
  {
    toolName: "DocumentReference_Search_ClinicalNotes",
    apiName: "DocumentReference.Search (Clinical Notes) (R4)",
    description: "Search clinical note documents (ED notes, specialist notes, discharge summaries). Returns metadata; use Binary.Read to get note text.",
    inputSchema: noParams,
    run: (rec) => effectiveChart(rec).documentReferencesClinicalNotes,
  },
  {
    toolName: "Observation_Search_SocialHistory",
    apiName: "Observation.Search (Social History) (R4)",
    description: "Search social history observations (tobacco, alcohol, living situation).",
    inputSchema: noParams,
    run: (rec) => effectiveChart(rec).observationsSocial,
  },
  {
    toolName: "FamilyMemberHistory_Search",
    apiName: "FamilyMemberHistory.Search (R4)",
    description: "Search documented family medical history.",
    inputSchema: noParams,
    run: (rec) => effectiveChart(rec).familyMemberHistory,
  },
  {
    toolName: "Binary_Read_ClinicalNotes",
    apiName: "Binary.Read (Clinical Notes) (R4)",
    description: "Read the full text of a clinical note Binary by id (from a DocumentReference content url like 'Binary/<id>').",
    inputSchema: {
      type: "object",
      properties: { binaryId: { type: "string", description: "Binary resource id, e.g. bin-wr-ednote-0628" } },
      required: ["binaryId"],
      additionalProperties: false,
    },
    run: (rec, input) => {
      const bin = readBinary(rec, String(input.binaryId).replace(/^Binary\//, ""));
      if (!bin) return [];
      return [{ resourceType: "Binary", id: input.binaryId, contentType: bin.contentType, text: bin.text ?? "(binary content — PDF)" }];
    },
  },
  {
    toolName: "DocumentReference_Search_ExternalCCDA",
    apiName: "DocumentReference.Search (External CCDA) (R4)",
    description: "Search external/outside documents in the chart: faxed records, EMS run sheets, outside reports (often PDFs). Returns metadata; use Binary.Read (External CCDA) to fetch content.",
    inputSchema: noParams,
    run: (rec) => effectiveChart(rec).documentReferencesExternal,
  },
];

export const OPERATIONS_BY_TOOL = new Map(OPERATIONS.map((o) => [o.toolName, o]));

// Special op used by the document agent — returns base64 PDFs (handled specially in the agent loop)
export const BINARY_READ_EXTERNAL = {
  toolName: "Binary_Read_ExternalCCDA",
  apiName: "Binary.Read (External CCDA) (R4)",
  description:
    "Read an external document Binary (e.g. a faxed PDF) by id from a DocumentReference content url like 'Binary/<id>'. The PDF content will be attached for you to read.",
  inputSchema: {
    type: "object",
    properties: { binaryId: { type: "string" } },
    required: ["binaryId"],
    additionalProperties: false,
  },
};

export function jitteredLatency(): number {
  return 150 + Math.floor(Math.random() * 450);
}
