import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));

// Resolve the data dir both locally (server/src/data -> server/data) and inside
// a bundled serverless function, where import.meta.url points at the bundle and
// includeFiles places server/data/** relative to the project root (cwd).
function resolveDataDir(): string {
  const candidates = [
    path.resolve(here, "../../data"),
    path.resolve(process.cwd(), "server/data"),
    path.resolve(process.cwd(), "data"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, "patients"))) return c;
  }
  return candidates[0];
}

export const DATA_DIR = resolveDataDir();
const PATIENTS_DIR = path.join(DATA_DIR, "patients");

export interface PatientMeta {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  age: number;
  sex: string;
  mrn: string;
  esi: number;
  chiefComplaint: string;
  arrivalTime: string;
  arrivalLabel: string;
  room: string;
  triageNote: string;
  triageVitals: Record<string, unknown>;
}

export interface Chart {
  patient: any;
  coverage: any[];
  encounters: any[];
  conditionsProblems: any[];
  conditionsMedicalHistory: any[];
  allergies: any[];
  medicationRequests: any[];
  medicationAdministrations: any[];
  observationsVitals: any[];
  observationsLabs: any[];
  observationsSocial: any[];
  diagnosticReports: any[];
  documentReferencesClinicalNotes: any[];
  documentReferencesExternal: any[];
  familyMemberHistory: any[];
  procedures: any[];
  binaries: Record<string, { contentType: string; text?: string; file?: string }>;
}

export interface EventStage {
  stage: number;
  label: string;
  releasedAt: string;
  newObservationsLabs?: any[];
  newObservationsVitals?: any[];
  newDiagnosticReports?: any[];
  newDocuments?: { documentReference: any; binaryId: string; binary: { contentType: string; file: string } }[];
  pendingAfter: string[];
}

export interface EventsFile {
  pendingAtArrival: string[];
  stages: EventStage[];
}

export interface PatientRecord {
  meta: PatientMeta;
  chart: Chart;
  events: EventsFile;
  dir: string;
  // runtime state
  releasedStages: number; // how many stages have been "released" into the chart
  lastCardAt: string | null;
  lastCard: any | null;
  lastDeltaCheckedStage: number;
}

const records = new Map<string, PatientRecord>();

function loadPatient(id: string): PatientRecord {
  const dir = path.join(PATIENTS_DIR, id);
  const read = (f: string) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  return {
    meta: read("meta.json"),
    chart: read("chart.json"),
    events: read("events.json"),
    dir,
    releasedStages: 0,
    lastCardAt: null,
    lastCard: null,
    lastDeltaCheckedStage: 0,
  };
}

export function loadAllPatients(): PatientRecord[] {
  if (records.size === 0) {
    for (const id of fs.readdirSync(PATIENTS_DIR)) {
      if (fs.existsSync(path.join(PATIENTS_DIR, id, "meta.json"))) {
        try {
          records.set(id, loadPatient(id));
        } catch (e) {
          console.error(`Failed to load patient ${id}:`, e);
        }
      }
    }
  }
  return [...records.values()];
}

export function getPatient(id: string): PatientRecord {
  loadAllPatients();
  const r = records.get(id);
  if (!r) throw new Error(`Unknown patient: ${id}`);
  return r;
}

export function resetPatients(): void {
  records.clear();
}

/** Chart view including all released delta-stage resources merged in. */
export function effectiveChart(rec: PatientRecord): Chart {
  const chart: Chart = JSON.parse(JSON.stringify(rec.chart));
  for (const stage of rec.events.stages.slice(0, rec.releasedStages)) {
    chart.observationsLabs.push(...(stage.newObservationsLabs ?? []));
    chart.observationsVitals.push(...(stage.newObservationsVitals ?? []));
    chart.diagnosticReports.push(...(stage.newDiagnosticReports ?? []));
    for (const doc of stage.newDocuments ?? []) {
      chart.documentReferencesExternal.push(doc.documentReference);
      chart.binaries[doc.binaryId] = doc.binary;
    }
  }
  return chart;
}

export function currentPending(rec: PatientRecord): string[] {
  if (rec.releasedStages === 0) return rec.events.pendingAtArrival;
  return rec.events.stages[rec.releasedStages - 1].pendingAfter;
}

/** Resources released in stages (from..to], used by the delta agent. */
export function stagesBetween(rec: PatientRecord, fromStage: number, toStage: number): EventStage[] {
  return rec.events.stages.slice(fromStage, toStage);
}

export function readBinary(rec: PatientRecord, binaryId: string) {
  const chart = effectiveChart(rec);
  const bin = chart.binaries[binaryId];
  if (!bin) return null;
  if (bin.file) {
    const filePath = path.join(rec.dir, bin.file);
    return { contentType: bin.contentType, base64: fs.readFileSync(filePath).toString("base64") };
  }
  return { contentType: bin.contentType, text: bin.text ?? "" };
}
