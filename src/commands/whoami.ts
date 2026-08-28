import { loadConfig } from "../lib/config";
import { getCurrentUser } from "../lib/canvas";

export async function runWhoami(): Promise<void> {
  const config = await loadConfig();
  if (!config) {
    console.error("Not authenticated. Run `canvas auth` first.");
    process.exitCode = 1;
    return;
  }

  try {
    const user = await getCurrentUser(config);
    console.log(`Name:   ${user.name}`);
    console.log(`Login:  ${user.login_id}`);
    console.log(`Email:  ${user.email}`);
    console.log(`ID:     ${user.id}`);
  } catch (err) {
    console.error(`Failed to load identity: ${(err as Error).message}`);
    process.exitCode = 1;
  }
}
