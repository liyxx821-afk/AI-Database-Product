import type { ReviewActionResponse, ReviewTask } from "@knowledgebase-dev/api-types";
import { apiFetch } from "./apiClient";

export async function listReviewTasks(status = "pending_review"): Promise<ReviewTask[]> {
  return apiFetch<ReviewTask[]>(`/review-tasks?status=${encodeURIComponent(status)}`);
}

export async function confirmReviewTask(taskId: string): Promise<ReviewActionResponse> {
  return apiFetch<ReviewActionResponse>(`/review-tasks/${taskId}:confirm`, { method: "POST" });
}

export async function ignoreReviewTask(taskId: string): Promise<ReviewActionResponse> {
  return apiFetch<ReviewActionResponse>(`/review-tasks/${taskId}:ignore`, { method: "POST" });
}
