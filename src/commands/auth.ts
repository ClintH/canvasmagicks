import { input, password } from "@inquirer/prompts";
import { loadConfig, saveConfig, type CanvasConfig } from "../lib/config";
import { getCurrentUser, normalizeDomain } from "../lib/canvas";

export async function runAuth(initialDomain = ""): Promise<CanvasConfig | null> {
  const existing = await loadConfig();

  const domain = await input({
    message: "Canvas domain:",
    default: initialDomain || existing?.domain,
    required: true,
  });

  const token = await password({
    message: "Canvas API token:",
    mask: true,
    validate: (value) => (value.trim() ? true : "Token is required"),
  });

  const config: CanvasConfig = {
    domain: normalizeDomain(domain),
    token: token.trim(),
  };

  try {
    const user = await getCurrentUser(config);
    await saveConfig(config);
    console.log(`Authenticated as ${user.name} (${user.login_id}).`);
    return config;
  } catch (err) {
    console.error(`Verification failed: ${(err as Error).message}`);
    return null;
  }
}
