import { create } from "zustand";
import type {
  FolderRecord,
  KnowledgeUnitOrganizationBatchUpdateRequest,
  OrganizationUpdateRequest,
  ProjectRecord,
  SourceOrganizationBatchUpdateRequest,
  TagCreateRequest,
  TagRecord
} from "@knowledgebase-dev/api-types";
import { hasBridge } from "../services/apiClient";
import {
  createFolder,
  createProject,
  createTag,
  listFolders,
  listProjects,
  listTags,
  updateKnowledgeUnitsOrganizationBatch,
  updateKnowledgeUnitOrganization,
  updateSourcesOrganizationBatch,
  updateSourceOrganization
} from "../services/organizationApi";

type ViewState = "loading" | "empty" | "degraded" | "recoverable_error" | "done";

type OrganizationStore = {
  projects: ProjectRecord[];
  folders: FolderRecord[];
  tags: TagRecord[];
  state: ViewState;
  errorCode: string | null;
  selectedProjectId: string;
  selectedFolderId: string | null;
  selectedTagIds: string[];
  refresh: () => Promise<void>;
  setSelectedProject: (projectId: string) => void;
  setSelectedFolder: (folderId: string | null) => void;
  setSelectedTagIds: (tagIds: string[]) => void;
  resetFilters: () => void;
  createProject: (name: string) => Promise<void>;
  createFolder: (name: string) => Promise<void>;
  createTag: (name: string) => Promise<void>;
  updateSourceOrganization: (
    sourceId: string,
    payload: OrganizationUpdateRequest
  ) => Promise<void>;
  updateSourcesOrganizationBatch: (payload: SourceOrganizationBatchUpdateRequest) => Promise<void>;
  updateKnowledgeUnitOrganization: (
    knowledgeUnitId: string,
    payload: OrganizationUpdateRequest
  ) => Promise<void>;
  updateKnowledgeUnitsOrganizationBatch: (
    payload: KnowledgeUnitOrganizationBatchUpdateRequest
  ) => Promise<void>;
};

const defaultProject: ProjectRecord = {
  id: "default-space",
  user_id: "local-user",
  parent_id: null,
  name: "Default Knowledge Space",
  description: "P0 local workspace",
  kb_type: "project_kb",
  status: "active",
  metadata: {},
  created_at: "",
  updated_at: ""
};

export const useOrganizationStore = create<OrganizationStore>((set, get) => ({
  projects: [defaultProject],
  folders: [],
  tags: [],
  state: "empty",
  errorCode: null,
  selectedProjectId: "default-space",
  selectedFolderId: null,
  selectedTagIds: [],
  refresh: async () => {
    if (!hasBridge()) {
      set({
        projects: [defaultProject],
        state: "degraded",
        errorCode: "desktop_bridge_unavailable"
      });
      return;
    }
    set({ state: "loading", errorCode: null });
    try {
      const projectId = get().selectedProjectId || "default-space";
      const [projects, folders, tags] = await Promise.all([
        listProjects(),
        listFolders(projectId),
        listTags(projectId)
      ]);
      set({
        projects: projects.length ? projects : [defaultProject],
        folders,
        tags,
        state: projects.length || folders.length || tags.length ? "done" : "empty",
        errorCode: null
      });
    } catch (error) {
      set({
        state: "recoverable_error",
        errorCode: error instanceof Error ? error.message : "organization_refresh_failed"
      });
    }
  },
  setSelectedProject: (projectId: string) => {
    set({ selectedProjectId: projectId, selectedFolderId: null, selectedTagIds: [] });
    void get().refresh();
  },
  setSelectedFolder: (folderId: string | null) => set({ selectedFolderId: folderId }),
  setSelectedTagIds: (tagIds: string[]) => set({ selectedTagIds: tagIds }),
  resetFilters: () => set({ selectedFolderId: null, selectedTagIds: [] }),
  createProject: async (name: string) => {
    if (!hasBridge()) {
      set({ state: "degraded", errorCode: "desktop_bridge_unavailable" });
      return;
    }
    const project = await createProject(name);
    set({ selectedProjectId: project.id, selectedFolderId: null, selectedTagIds: [] });
    await get().refresh();
  },
  createFolder: async (name: string) => {
    if (!hasBridge()) {
      set({ state: "degraded", errorCode: "desktop_bridge_unavailable" });
      return;
    }
    await createFolder(get().selectedProjectId, name);
    await get().refresh();
  },
  createTag: async (name: string) => {
    if (!hasBridge()) {
      set({ state: "degraded", errorCode: "desktop_bridge_unavailable" });
      return;
    }
    const payload: TagCreateRequest = {
      project_id: get().selectedProjectId,
      name,
      namespace: "topic",
      tag_type: "topic_tag"
    };
    await createTag(payload);
    await get().refresh();
  },
  updateSourceOrganization: async (sourceId: string, payload: OrganizationUpdateRequest) => {
    if (!hasBridge()) {
      set({ state: "degraded", errorCode: "desktop_bridge_unavailable" });
      return;
    }
    await updateSourceOrganization(sourceId, payload);
    await get().refresh();
  },
  updateSourcesOrganizationBatch: async (payload: SourceOrganizationBatchUpdateRequest) => {
    if (!hasBridge()) {
      set({ state: "degraded", errorCode: "desktop_bridge_unavailable" });
      return;
    }
    set({ state: "loading", errorCode: null });
    try {
      await updateSourcesOrganizationBatch(payload);
      await get().refresh();
    } catch (error) {
      set({
        state: "recoverable_error",
        errorCode: error instanceof Error ? error.message : "source_batch_organization_failed"
      });
    }
  },
  updateKnowledgeUnitOrganization: async (
    knowledgeUnitId: string,
    payload: OrganizationUpdateRequest
  ) => {
    if (!hasBridge()) {
      set({ state: "degraded", errorCode: "desktop_bridge_unavailable" });
      return;
    }
    await updateKnowledgeUnitOrganization(knowledgeUnitId, payload);
    await get().refresh();
  },
  updateKnowledgeUnitsOrganizationBatch: async (
    payload: KnowledgeUnitOrganizationBatchUpdateRequest
  ) => {
    if (!hasBridge()) {
      set({ state: "degraded", errorCode: "desktop_bridge_unavailable" });
      return;
    }
    set({ state: "loading", errorCode: null });
    try {
      await updateKnowledgeUnitsOrganizationBatch(payload);
      await get().refresh();
    } catch (error) {
      set({
        state: "recoverable_error",
        errorCode:
          error instanceof Error ? error.message : "knowledge_unit_batch_organization_failed"
      });
    }
  }
}));
