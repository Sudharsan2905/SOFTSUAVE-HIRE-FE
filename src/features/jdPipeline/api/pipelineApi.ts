import { api } from "@/utils/api";
import { API_ENDPOINTS } from "@/constants/api";
import { PIPELINE_UPLOAD_TIMEOUT_MS } from "../constants";
import type { CreatePipelineInput, PipelineListResult, PipelineRun, ResendResult } from "../types";

const E = API_ENDPOINTS.JD_PIPELINE;

export function buildCreateFormData(input: CreatePipelineInput): FormData {
  const form = new FormData();
  form.append("jd_title", input.title.trim());
  form.append("jd_text", input.jdText.trim());
  form.append("workspace_id", input.workspaceId);
  form.append(
    "candidates",
    JSON.stringify(input.rows.map((r) => ({ description: r.description.trim() })))
  );
  input.rows.forEach((r, i) => {
    if (r.resume) form.append(`resume_${i}`, r.resume);
    if (r.photo) form.append(`photo_${i}`, r.photo);
  });
  return form;
}

export async function createPipeline(
  input: CreatePipelineInput
): Promise<{ id: string; status: string }> {
  const { data } = await api.post(E.ROOT, buildCreateFormData(input), {
    // Let the browser set the multipart boundary; uploads can be slow.
    headers: { "Content-Type": undefined },
    timeout: PIPELINE_UPLOAD_TIMEOUT_MS,
  });
  return data.data;
}

export async function listPipelines(workspaceId?: string): Promise<PipelineListResult> {
  const { data } = await api.get(E.ROOT, {
    params: { workspace_id: workspaceId, page: 1, page_size: 50 },
  });
  return data.data;
}

export async function getPipeline(id: string): Promise<PipelineRun> {
  const { data } = await api.get(E.BY_ID(id));
  return data.data;
}

export async function resendAllInvites(id: string): Promise<ResendResult> {
  const { data } = await api.post(E.RESEND_INVITES(id));
  return data.data;
}

export async function resendInvite(id: string, candidateId: string): Promise<ResendResult> {
  const { data } = await api.post(E.RESEND_INVITE(id, candidateId));
  return data.data;
}

export async function retryStep(id: string, step?: string): Promise<{ status: string }> {
  const { data } = await api.post(E.RETRY(id), step ? { step } : {});
  return data.data;
}

export async function resendReport(id: string, candidateId: string): Promise<{ sent: boolean }> {
  const { data } = await api.post(E.RESEND_REPORT(id, candidateId));
  return data.data;
}
