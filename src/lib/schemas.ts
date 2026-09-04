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

// Full Canvas CalendarEvent – preserves every field the API may return.
// Used only for `calendar download --output .json` to export losslessly.
// MD/ICS rendering continues to use the minimal `CalendarEvent` above.
export const CalendarEventFullSchema = z
  .object({
    id: z.coerce.number(),
    title: z.string(),
    start_at: z.string(),
    end_at: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    location_name: z.string().nullable().optional(),
    location_address: z.string().nullable().optional(),
    context_code: z.string(),
    effective_context_code: z.string().nullable().optional(),
    context_name: z.string().nullable().optional(),
    all_context_codes: z.string().nullable().optional(),
    workflow_state: z.string().nullable().optional(),
    hidden: z.boolean().nullable().optional(),
    parent_event_id: z.coerce.number().nullable().optional(),
    child_events_count: z.coerce.number().nullable().optional(),
    child_events: z.array(z.unknown()).nullable().optional(),
    url: z.string().nullable().optional(),
    html_url: z.string().nullable().optional(),
    all_day_date: z.string().nullable().optional(),
    all_day: z.boolean().nullable().optional(),
    created_at: z.string().nullable().optional(),
    updated_at: z.string().nullable().optional(),
    appointment_group_id: z.coerce.number().nullable().optional(),
    appointment_group_url: z.string().nullable().optional(),
    own_reservation: z.boolean().nullable().optional(),
    reserve_url: z.string().nullable().optional(),
    reserved: z.boolean().nullable().optional(),
    participant_type: z.string().nullable().optional(),
    participants_per_appointment: z.coerce.number().nullable().optional(),
    available_slots: z.coerce.number().nullable().optional(),
    user: z.unknown().nullable().optional(),
    group: z.unknown().nullable().optional(),
    important_dates: z.boolean().nullable().optional(),
    series_uuid: z.string().nullable().optional(),
    rrule: z.string().nullable().optional(),
    series_head: z.boolean().nullable().optional(),
    series_natural_language: z.string().nullable().optional(),
    blackout_date: z.boolean().nullable().optional(),
    type: z.string().nullable().optional(),
  })
  .passthrough();
export type CalendarEventFull = z.infer<typeof CalendarEventFullSchema>;

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

// ---------------------------------------------------------------------------
// Exams (assignments + submissions)
// ---------------------------------------------------------------------------

export const AssignmentSchema = z
  .object({
    id: z.coerce.number(),
    name: z.string(),
    due_at: z.string().nullable().optional(),
    points_possible: z.number().nullable().optional(),
    submission_types: z.array(z.string()).nullable().optional(),
    workflow_state: z.string().nullable().optional(),
    published: z.boolean().nullable().optional(),
    html_url: z.string().nullable().optional(),
    needs_grading_count: z.coerce.number().nullable().optional(),
    has_submitted_submissions: z.boolean().nullable().optional(),
  })
  .passthrough();
export type Assignment = z.infer<typeof AssignmentSchema>;

export const SubmissionUserSchema = z
  .object({
    id: z.coerce.number(),
    name: z.string(),
    sortable_name: z.string().nullable().optional(),
    login_id: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
  })
  .passthrough();
export type SubmissionUser = z.infer<typeof SubmissionUserSchema>;

export const SubmissionAttachmentSchema = z
  .object({
    id: z.coerce.number(),
    filename: z.string().nullable().optional(),
    display_name: z.string().nullable().optional(),
    "content-type": z.string().nullable().optional(),
    content_type: z.string().nullable().optional(),
    size: z.coerce.number().nullable().optional(),
    url: z.string(),
    created_at: z.string().nullable().optional(),
    updated_at: z.string().nullable().optional(),
  })
  .passthrough();
export type SubmissionAttachment = z.infer<typeof SubmissionAttachmentSchema>;

export const SubmissionCommentSchema = z
  .object({
    id: z.coerce.number(),
    author_id: z.coerce.number().nullable().optional(),
    author_name: z.string().nullable().optional(),
    comment: z.string(),
    created_at: z.string(),
    attachments: z.array(SubmissionAttachmentSchema).nullable().optional(),
  })
  .passthrough();
export type SubmissionComment = z.infer<typeof SubmissionCommentSchema>;

export const SubmissionSchema = z
  .object({
    id: z.coerce.number().nullable().optional(),
    assignment_id: z.coerce.number().nullable().optional(),
    user_id: z.coerce.number(),
    user: SubmissionUserSchema.nullable().optional(),
    submitted_at: z.string().nullable().optional(),
    attempt: z.coerce.number().nullable().optional(),
    workflow_state: z.string().nullable().optional(),
    late: z.boolean().nullable().optional(),
    missing: z.boolean().nullable().optional(),
    excused: z.boolean().nullable().optional(),
    score: z.number().nullable().optional(),
    grade: z.string().nullable().optional(),
    submission_type: z.string().nullable().optional(),
    body: z.string().nullable().optional(),
    url: z.string().nullable().optional(),
    attachments: z.array(SubmissionAttachmentSchema).nullable().optional(),
    submission_comments: z.array(SubmissionCommentSchema).nullable().optional(),
    submission_history: z.array(z.unknown()).nullable().optional(),
    turnitin_data: z.record(z.string(), z.unknown()).nullable().optional(),
    html_url: z.string().nullable().optional(),
    preview_url: z.string().nullable().optional(),
    media_comment: z.unknown().nullable().optional(),
  })
  .passthrough();
export type Submission = z.infer<typeof SubmissionSchema>;
