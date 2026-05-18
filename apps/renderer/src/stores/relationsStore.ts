import { create } from "zustand";
import type {
  GraphPreviewResponse,
  KnowledgeRelationCreateRequest,
  KnowledgeRelationPatchRequest,
  KnowledgeRelationRecord
} from "@knowledgebase-dev/api-types";
import { hasBridge } from "../services/apiClient";
import type { OrganizationFilters } from "../services/organizationApi";
import {
  archiveRelation as archiveRelationApi,
  createRelation as createRelationApi,
  getGraphPreview,
  listRelations,
  updateRelation as updateRelationApi
} from "../services/relationsApi";
import type { UiState } from "../types/uiState";
import { resolveErrorCode } from "../utils/errors";

type RelationsState = {
  graph?: GraphPreviewResponse;
  relations: KnowledgeRelationRecord[];
  graphState: UiState;
  relationState: UiState;
  graphErrorCode?: string;
  relationErrorCode?: string;
  refreshGraph: (filters?: OrganizationFilters) => Promise<void>;
  refreshRelations: (filters?: OrganizationFilters) => Promise<void>;
  createRelation: (payload: KnowledgeRelationCreateRequest) => Promise<KnowledgeRelationRecord | undefined>;
  updateRelation: (
    relationId: string,
    payload: KnowledgeRelationPatchRequest
  ) => Promise<KnowledgeRelationRecord | undefined>;
  archiveRelation: (relationId: string, filters?: OrganizationFilters) => Promise<void>;
};

export const useRelationsStore = create<RelationsState>((set, get) => ({
  relations: [],
  graphState: "empty",
  relationState: "empty",
  async refreshGraph(filters) {
    if (!hasBridge()) {
      set({
        graph: undefined,
        graphState: "degraded",
        graphErrorCode: "desktop_bridge_unavailable"
      });
      return;
    }
    set({ graphState: "loading", graphErrorCode: undefined });
    try {
      const graph = await getGraphPreview(filters);
      set({
        graph,
        graphState: graph.summary.edge_count > 0 ? "done" : "empty",
        graphErrorCode: undefined
      });
    } catch (error) {
      set({
        graphState: "recoverable_error",
        graphErrorCode: resolveErrorCode(error, "graph_preview_failed")
      });
    }
  },
  async refreshRelations(filters) {
    if (!hasBridge()) {
      set({
        relations: [],
        relationState: "degraded",
        relationErrorCode: "desktop_bridge_unavailable"
      });
      return;
    }
    set({ relationState: "loading", relationErrorCode: undefined });
    try {
      const relations = await listRelations({ ...filters, status: "confirmed" });
      set({
        relations,
        relationState: relations.length ? "done" : "empty",
        relationErrorCode: undefined
      });
    } catch (error) {
      set({
        relationState: "recoverable_error",
        relationErrorCode: resolveErrorCode(error, "relations_refresh_failed")
      });
    }
  },
  async createRelation(payload) {
    if (!hasBridge()) {
      set({
        relationState: "degraded",
        relationErrorCode: "desktop_bridge_unavailable"
      });
      return undefined;
    }
    set({ relationState: "loading", relationErrorCode: undefined });
    try {
      const relation = await createRelationApi(payload);
      set((state) => ({
        relations: [relation, ...state.relations],
        relationState: "done",
        relationErrorCode: undefined
      }));
      return relation;
    } catch (error) {
      set({
        relationState: "recoverable_error",
        relationErrorCode: resolveErrorCode(error, "relation_create_failed")
      });
      return undefined;
    }
  },
  async updateRelation(relationId, payload) {
    if (!hasBridge()) {
      set({
        relationState: "degraded",
        relationErrorCode: "desktop_bridge_unavailable"
      });
      return undefined;
    }
    set({ relationState: "loading", relationErrorCode: undefined });
    try {
      const relation = await updateRelationApi(relationId, payload);
      set((state) => ({
        relations: state.relations.map((item) => (item.id === relation.id ? relation : item)),
        relationState: "done",
        relationErrorCode: undefined
      }));
      return relation;
    } catch (error) {
      set({
        relationState: "recoverable_error",
        relationErrorCode: resolveErrorCode(error, "relation_update_failed")
      });
      return undefined;
    }
  },
  async archiveRelation(relationId, filters) {
    if (!hasBridge()) {
      set({
        relationState: "degraded",
        relationErrorCode: "desktop_bridge_unavailable"
      });
      return;
    }
    set({ relationState: "loading", relationErrorCode: undefined });
    try {
      await archiveRelationApi(relationId);
      await Promise.all([get().refreshRelations(filters), get().refreshGraph(filters)]);
    } catch (error) {
      set({
        relationState: "recoverable_error",
        relationErrorCode: resolveErrorCode(error, "relation_archive_failed")
      });
    }
  }
}));
