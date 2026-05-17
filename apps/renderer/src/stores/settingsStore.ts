import { create } from "zustand";
import { hasBridge } from "../services/apiClient";
import { getSettings, patchSettings } from "../services/settingsApi";
import { defaultLanguage, type LanguageCode } from "../services/i18n";
import { resolveErrorCode } from "../utils/errors";

type SettingsState = "loading" | "empty" | "degraded" | "recoverable_error" | "done";

type SettingsStore = {
  language: LanguageCode;
  state: SettingsState;
  errorCode: string | null;
  persistence: "config_json" | "session";
  refresh: () => Promise<void>;
  setLanguage: (language: LanguageCode) => Promise<void>;
};

export const useSettingsStore = create<SettingsStore>((set) => ({
  language: defaultLanguage,
  state: "empty",
  errorCode: null,
  persistence: "session",
  refresh: async () => {
    if (!hasBridge()) {
      set({ state: "degraded", persistence: "session", errorCode: "desktop_bridge_unavailable" });
      return;
    }
    set({ state: "loading", errorCode: null });
    try {
      const settings = await getSettings();
      set({
        language: settings.language,
        persistence: "config_json",
        state: "done",
        errorCode: null
      });
    } catch (error) {
      set({
        state: "recoverable_error",
        errorCode: resolveErrorCode(error, "settings_load_failed")
      });
    }
  },
  setLanguage: async (language) => {
    if (!hasBridge()) {
      set({
        language,
        state: "degraded",
        persistence: "session",
        errorCode: "desktop_bridge_unavailable"
      });
      return;
    }
    set({ state: "loading", errorCode: null });
    try {
      const settings = await patchSettings({ language });
      set({
        language: settings.language,
        persistence: "config_json",
        state: "done",
        errorCode: null
      });
    } catch (error) {
      set({
        state: "recoverable_error",
        errorCode: resolveErrorCode(error, "settings_save_failed")
      });
    }
  }
}));
