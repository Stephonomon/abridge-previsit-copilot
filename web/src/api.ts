import type { AgentConfigResponse, Patient, RunEvent } from "./types";

export async function fetchPatients(): Promise<Patient[]> {
  const r = await fetch("/api/patients");
  const j = await r.json();
  return j.patients;
}

export async function fetchChart(patientId: string) {
  const r = await fetch(`/api/patients/${patientId}/chart`);
  return r.json();
}

export async function fetchCard(patientId: string) {
  const r = await fetch(`/api/patients/${patientId}/card`);
  return r.json();
}

export async function startPrevisit(patientId: string): Promise<string> {
  const r = await fetch(`/api/patients/${patientId}/previsit`, { method: "POST" });
  const j = await r.json();
  return j.runId;
}

export async function startDelta(patientId: string): Promise<string> {
  const r = await fetch(`/api/patients/${patientId}/delta`, { method: "POST" });
  const j = await r.json();
  return j.runId;
}

export async function simulateAdvance(patientId: string) {
  const r = await fetch(`/api/patients/${patientId}/simulate-advance`, { method: "POST" });
  return r.json();
}

export function subscribeRun(runId: string, onEvent: (e: RunEvent) => void): () => void {
  const es = new EventSource(`/api/runs/${runId}/stream`);
  es.onmessage = (m) => onEvent(JSON.parse(m.data));
  es.onerror = () => es.close();
  return () => es.close();
}

export async function fetchAgentConfig(specialty = "emergency-medicine"): Promise<AgentConfigResponse> {
  const r = await fetch(`/api/agent-config/${specialty}`);
  return r.json();
}

export async function sendFeedback(section: string, instruction: string, specialty = "emergency-medicine") {
  const r = await fetch(`/api/agent-config/${specialty}/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ section, instruction }),
  });
  return r.json();
}

export async function setActiveVersion(versionId: string, specialty = "emergency-medicine") {
  const r = await fetch(`/api/agent-config/${specialty}/active-version`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ versionId }),
  });
  return r.json();
}

export async function deleteCustomization(id: string, specialty = "emergency-medicine") {
  const r = await fetch(`/api/agent-config/${specialty}/customizations/${id}`, { method: "DELETE" });
  return r.json();
}
