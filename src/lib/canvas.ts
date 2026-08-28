import type { CanvasConfig } from "./config";
import { CanvasClient } from "./client";
import { CanvasUserSchema, CanvasCourseSchema, type CanvasUser, type CanvasCourse } from "./schemas";

export type { CanvasUser, CanvasCourse } from "./schemas";

export function normalizeDomain(domain: string): string {
  let d = domain.trim();
  if (!/^https?:\/\//i.test(d)) {
    d = "https://" + d;
  }
  return d.replace(/\/+$/, "");
}

export async function getCurrentUser(config: CanvasConfig): Promise<CanvasUser> {
  const client = new CanvasClient(config);
  const json = await client.get("users/self");
  return CanvasUserSchema.parse(json);
}

export async function getCourses(config: CanvasConfig, perPage = 100): Promise<CanvasCourse[]> {
  const client = new CanvasClient(config);
  const json = await client.getAll("courses", { per_page: perPage });
  return CanvasCourseSchema.array().parse(json);
}
