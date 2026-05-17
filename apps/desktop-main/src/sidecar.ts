import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { appIdentity } from "@knowledgebase-dev/shared-config";

export type SidecarRuntime = {
  apiBaseUrl: string;
  localToken: string;
  pid: number | null;
  status: "sidecar_starting" | "ready" | "degraded" | "shutting_down";
  statusReason: string | null;
};

export type SidecarStopResult = {
  pid: number | null;
  exited: boolean;
  code: number | null;
  signal: NodeJS.Signals | null;
  forced: boolean;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..", "..");

function pythonExecutable(): string {
  const venvPython = path.join(repoRoot, ".venv", "bin", "python");
  return existsSync(venvPython) ? venvPython : "python3";
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (typeof address === "object" && address) resolve(address.port);
        else reject(new Error("Unable to allocate local sidecar port."));
      });
    });
    server.on("error", reject);
  });
}

async function waitForHealth(apiBaseUrl: string): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 15000) {
    try {
      const response = await fetch(`${apiBaseUrl}/health`);
      if (response.ok) return;
    } catch {
      // Sidecar is still booting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("FastAPI sidecar did not become healthy in time.");
}

export class SidecarManager {
  private child: ChildProcessWithoutNullStreams | null = null;
  private runtime: SidecarRuntime | null = null;

  async start(userDataPath: string): Promise<SidecarRuntime> {
    if (this.runtime?.status === "ready") return this.runtime;
    const port = await freePort();
    const localToken = randomBytes(24).toString("hex");
    const apiBaseUrl = `http://127.0.0.1:${port}/api`;
    const apiRoot = path.join(repoRoot, "apps", "api");
    this.runtime = {
      apiBaseUrl,
      localToken,
      pid: null,
      status: "sidecar_starting",
      statusReason: null
    };
    this.child = spawn(
      pythonExecutable(),
      ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", String(port)],
      {
        cwd: apiRoot,
        env: {
          ...process.env,
          PYTHONPATH: apiRoot,
          KB_LOCAL_TOKEN: localToken,
          KB_APP_DATA_DIR: path.join(userDataPath, appIdentity.dataDirName)
        }
      }
    );
    this.runtime.pid = this.child.pid ?? null;
    this.child.stdout.on("data", (data) => console.log(`[sidecar] ${data}`));
    this.child.stderr.on("data", (data) => console.error(`[sidecar] ${data}`));
    this.child.on("exit", (code) => {
      if (this.runtime?.status !== "shutting_down") {
        this.runtime = {
          ...this.runtime!,
          status: "degraded",
          statusReason: `sidecar exited with code ${code}`
        };
      }
    });

    await waitForHealth(apiBaseUrl);
    this.runtime.status = "ready";
    return this.runtime;
  }

  getRuntime(): SidecarRuntime | null {
    return this.runtime;
  }

  async stop(timeoutMs = 5000): Promise<SidecarStopResult | null> {
    const child = this.child;
    if (!child) return null;
    const pid = child.pid ?? null;
    if (this.runtime) this.runtime.status = "shutting_down";

    const waitForExit = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
      if (child.exitCode !== null || child.signalCode !== null) {
        resolve({ code: child.exitCode, signal: child.signalCode });
        return;
      }
      child.once("exit", (code, signal) => resolve({ code, signal }));
    });

    let forced = false;
    child.kill("SIGTERM");
    let exit = await Promise.race([
      waitForExit,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs))
    ]);

    if (!exit) {
      forced = true;
      child.kill("SIGKILL");
      exit = await Promise.race([
        waitForExit,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000))
      ]);
    }

    this.child = null;
    return {
      pid,
      exited: Boolean(exit),
      code: exit?.code ?? null,
      signal: exit?.signal ?? null,
      forced
    };
  }
}
