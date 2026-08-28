import { z } from "zod";

export const ActivitySchema = z
  .object({
    week: z.number(),
    title: z.string(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
    startTime: z.string().regex(/^\d{1,2}:\d{2}$/, "startTime must be H:MM (24h)"),
    endTime: z.string().regex(/^\d{1,2}:\d{2}$/, "endTime must be H:MM (24h)"),
    involved: z.array(z.string()),
    responsible: z.string().optional(),
    location: z.string().optional(),
    notes: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (typeof val.date === "string") {
      const m = val.date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) {
        const y = Number(m[1]);
        const mo = Number(m[2]);
        const d = Number(m[3]);
        const dt = new Date(y, mo - 1, d);
        if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["date"],
            message: "must be a real calendar date",
          });
        }
      }
    }
    for (const field of ["startTime", "endTime"] as const) {
      const t = val[field];
      if (typeof t === "string") {
        const m = t.match(/^(\d{1,2}):(\d{2})$/);
        if (m) {
          const h = Number(m[1]);
          const mi = Number(m[2]);
          if (h > 23 || mi > 59) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [field],
              message: "must be HH:MM in 24-hour time (00-23:00-59)",
            });
          }
        }
      }
    }
  });

export type Activity = z.infer<typeof ActivitySchema>;

export const ActivitiesFileSchema = z.array(ActivitySchema);

export type ParseResult =
  | { ok: true; data: Activity[] }
  | { ok: false; issues: { index: number; message: string }[] };

export function parseActivities(text: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    return { ok: false, issues: [{ index: 0, message: `Invalid JSON: ${(e as Error).message}` }] };
  }

  const result = ActivitiesFileSchema.safeParse(json);
  if (result.success) {
    return { ok: true, data: result.data };
  }

  const issues = result.error.issues.map((issue) => {
    const first = issue.path[0];
    const index = typeof first === "number" ? first + 1 : 0;
    return { index, message: formatIssue(issue) };
  });
  return { ok: false, issues };
}

function formatIssue(issue: z.ZodIssue): string {
  const field =
    typeof issue.path[1] === "string"
      ? issue.path[1]
      : typeof issue.path[0] === "string"
        ? issue.path[0]
        : "value";
  const msg = issue.message;
  if (/received undefined/i.test(msg)) {
    return `field '${field}' is required but missing`;
  }
  return `field '${field}': ${msg}`;
}

// Encodes who is responsible and who is participating into the compact form used
// in both the Markdown overview and Canvas event titles:
//   - responsible present, others present:  "!CH with JP,JN"
//   - responsible present, no others:       "!CH"
//   - no responsible, only involved:        "CH" (or "CH,JN")
// Returns "" when there is nothing to encode.
export function formatParticipants(activity: Activity): string {
  const responsible = (activity.responsible ?? "").trim();
  const involved = activity.involved.map((x) => x.trim()).filter((x) => x.length > 0);
  const others = involved.filter((x) => x !== responsible);

  if (responsible.length > 0) {
    return others.length > 0 ? `!${responsible} with ${others.join(",")}` : `!${responsible}`;
  }
  if (involved.length > 0) {
    return involved.join(",");
  }
  return "";
}

export function formatEventTitle(activity: Activity): string {
  const participants = formatParticipants(activity);
  return participants ? `${activity.title} (${participants})` : activity.title;
}

export function buildTitle(activity: Activity): string {
  return formatEventTitle(activity);
}

export function buildDescription(activity: Activity, prefixInvolved: boolean): string {
  const involvedLine =
    prefixInvolved && activity.involved.length > 0
      ? `Involved: ${activity.involved.join(", ")}`
      : "";
  return [involvedLine, activity.notes ?? ""].filter((part) => part.length > 0).join("\n\n");
}
