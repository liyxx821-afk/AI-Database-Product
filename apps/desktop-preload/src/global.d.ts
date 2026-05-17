export {};

declare global {
  interface Window {
    knowledgeBase?: {
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
    };
  }
}
