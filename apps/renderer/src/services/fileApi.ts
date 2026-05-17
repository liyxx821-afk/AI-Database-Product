import type {
  FileRecord,
  ParseTaskRecord,
  UploadCreateRequest,
  UploadPartResponse,
  UploadSnapshot
} from "@knowledgebase-dev/api-types";
import { apiBinaryFetch, apiFetch } from "./apiClient";

const DEFAULT_PART_SIZE = 4 * 1024 * 1024;

export async function listFiles(): Promise<FileRecord[]> {
  return apiFetch<FileRecord[]>("/files");
}

export async function verifyFile(fileId: string): Promise<FileRecord> {
  return apiFetch<FileRecord>(`/files/${fileId}:verify`, { method: "POST" });
}

export async function parseFile(fileId: string): Promise<ParseTaskRecord> {
  return apiFetch<ParseTaskRecord>(`/files/${fileId}:parse`, { method: "POST" });
}

export async function uploadFile(
  file: File,
  onProgress: (progress: { receivedBytes: number; totalBytes: number; uploadId: string }) => void
): Promise<UploadSnapshot> {
  const payload: UploadCreateRequest = {
    filename: file.name,
    size_bytes: file.size,
    content_type: file.type || null,
    sha256: null,
    part_size: DEFAULT_PART_SIZE,
    project_id: "default-space"
  };
  const upload = await apiFetch<UploadSnapshot>("/uploads", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  const totalParts = upload.part_count;
  let receivedBytes = 0;
  for (let index = 0; index < totalParts; index += 1) {
    const start = index * upload.part_size;
    const part = file.slice(start, Math.min(start + upload.part_size, file.size));
    const partResponse = await apiBinaryFetch<UploadPartResponse>(
      `/uploads/${upload.id}/parts/${index + 1}`,
      part
    );
    receivedBytes = partResponse.received_bytes;
    onProgress({ receivedBytes, totalBytes: file.size, uploadId: upload.id });
  }
  return apiFetch<UploadSnapshot>(`/uploads/${upload.id}:complete`, { method: "POST" });
}
