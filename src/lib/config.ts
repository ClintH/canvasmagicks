import { homedir } from "node:os";
import { join } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

export const CONFIG_DIR = join(homedir(), ".config", "canvasmagicks");
export const CONFIG_PATH = join(CONFIG_DIR, "config.json");

export interface CanvasConfig {
  domain: string;
  token: string;
  defaultLocation?: string;
  defaultCourseId?: number;
  defaultCourseCode?: string;
}

export async function loadConfig(): Promise<CanvasConfig | null> {
  try {
    const text = await readFile(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(text) as Partial<CanvasConfig>;
    if (typeof parsed.domain === "string" && typeof parsed.token === "string") {
      return {
        domain: parsed.domain,
        token: parsed.token,
        defaultLocation: parsed.defaultLocation,
        defaultCourseId: parsed.defaultCourseId,
        defaultCourseCode: parsed.defaultCourseCode,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveConfig(config: CanvasConfig): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", {
    encoding: "utf8",
    mode: 0o600,
  });
}

// Merge with the existing config so writing one field never drops the others
// (e.g. saving defaultLocation must not wipe domain/token).
export async function patchConfig(
  partial: Partial<CanvasConfig>,
): Promise<CanvasConfig> {
  const existing = await loadConfig();
  if (!existing) {
    throw new Error("Cannot update config: not authenticated. Run `canvas auth` first.");
  }
  const next: CanvasConfig = { ...existing, ...partial };
  await saveConfig(next);
  return next;
}
