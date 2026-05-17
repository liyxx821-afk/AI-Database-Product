/// <reference types="vite/client" />

interface KnowledgeBaseBridge {
  runtime: {
    getRuntimeConfig: () => Promise<{
      apiBaseUrl: string;
      localToken: string;
      appName: string;
      appVersion: string;
    }>;
    getRuntimeStatus: () => Promise<unknown>;
    onRuntimeStatusChange: (callback: (status: unknown) => void) => () => void;
  };
  native: {
    openFileDialog: () => Promise<string[]>;
    exportDiagnostics: () => Promise<unknown>;
  };
}

interface Window {
  knowledgeBase?: KnowledgeBaseBridge;
}
