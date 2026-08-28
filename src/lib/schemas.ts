import { z } from "zod";

// ---------------------------------------------------------------------------
// Response schemas (results we get back from Canvas)
// ---------------------------------------------------------------------------

export const CanvasUserSchema = z.object({
  id: z.coerce.number(),
  name: z.string(),
  email: z.string().nullable().optional(),
  login_id: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
});
export type CanvasUser = z.infer<typeof CanvasUserSchema>;

export const CanvasCourseSchema = z.object({
  id: z.coerce.number(),
  name: z.string(),
  course_code: z.string(),
  workflow_state: z.string().optional(),
});
export type CanvasCourse = z.infer<typeof CanvasCourseSchema>;

export const CalendarEventSchema = z.object({
  id: z.coerce.number(),
  title: z.string(),
  start_at: z.string(),
  end_at: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  location_name: z.string().nullable().optional(),
  context_code: z.string(),
  type: z.string().optional(),
  workflow_state: z.string().optional(),
});
export type CalendarEvent = z.infer<typeof CalendarEventSchema>;

export const CanvasPageSchema = z.object({
  id: z.coerce.number().optional(),
  url: z.string(),
  title: z.string(),
  body: z.string().nullable().optional(),
  published: z.boolean().optional(),
});
export type CanvasPage = z.infer<typeof CanvasPageSchema>;

// ---------------------------------------------------------------------------
// Request schemas (args we send to Canvas)
// ---------------------------------------------------------------------------

export const CreateEventInputSchema = z.object({
  context_code: z.string(),
  title: z.string(),
  description: z.string(),
  start_at: z.string(),
  end_at: z.string(),
  location_name: z.string().optional(),
  time_zone_edited: z.string().optional(),
});
export type CreateEventInput = z.infer<typeof CreateEventInputSchema>;

export const CreatePageInputSchema = z.object({
  title: z.string(),
  body: z.string(),
  published: z.boolean().optional(),
});
export type CreatePageInput = z.infer<typeof CreatePageInputSchema>;

export const UpdatePageInputSchema = z.object({
  body: z.string(),
  published: z.boolean().optional(),
});
export type UpdatePageInput = z.infer<typeof UpdatePageInputSchema>;
