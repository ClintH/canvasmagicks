import type { CanvasConfig } from "./config";
import { CanvasClient, buildForm } from "./client";
import {
  CalendarEventSchema,
  CreateEventInputSchema,
  CanvasCourseSchema,
  type CalendarEvent,
  type CanvasCourse,
  type CreateEventInput,
} from "./schemas";

export type { CalendarEvent, CanvasCourse, CreateEventInput } from "./schemas";

// Interpret the wall-clock time as the CLI machine's local time and store it as
// a UTC instant. This is correct under the "use the machine timezone" decision.
export function toIso(date: string, time: string): string {
  const dm = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const tm = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!dm || !tm) {
    throw new Error(`Invalid date/time: ${date} ${time}`);
  }
  const y = Number(dm[1]);
  const mo = Number(dm[2]);
  const d = Number(dm[3]);
  const h = Number(tm[1]);
  const mi = Number(tm[2]);
  // Built from local components so single-digit hours (e.g. "9:15") are accepted;
  // toISOString() then yields the UTC instant for the local wall-clock time.
  const dt = new Date(y, mo - 1, d, h, mi, 0, 0);
  if (Number.isNaN(dt.getTime())) {
    throw new Error(`Invalid date/time: ${date} ${time}`);
  }
  return dt.toISOString();
}

export async function listCourseEvents(
  config: CanvasConfig,
  courseId: number | string,
): Promise<CalendarEvent[]> {
  const client = new CanvasClient(config);
  const json = await client.getAll("calendar_events", {
    type: "event",
    all_events: true,
    per_page: 100,
    "context_codes[]": `course_${courseId}`,
  });
  return CalendarEventSchema.array().parse(json);
}

export async function createEvent(
  config: CanvasConfig,
  input: CreateEventInput,
): Promise<CalendarEvent> {
  const client = new CanvasClient(config);
  const payload = {
    ...input,
    time_zone_edited: input.time_zone_edited ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
  const validated = CreateEventInputSchema.parse(payload);
  const body = buildForm(validated, "calendar_event");
  const json = await client.postForm("calendar_events", body);
  return CalendarEventSchema.parse(json);
}

export async function deleteEvent(config: CanvasConfig, id: number | string): Promise<void> {
  const client = new CanvasClient(config);
  await client.delete(`calendar_events/${id}`);
}

export async function listFavoriteCourses(config: CanvasConfig): Promise<CanvasCourse[]> {
  const client = new CanvasClient(config);
  const json = await client.getAll("users/self/favorites/courses", { per_page: 100 });
  return CanvasCourseSchema.array().parse(json);
}
