import {
  buildTitle,
  buildDescription,
  type Activity,
} from "./activities";
import { toIso, type CalendarEvent } from "./calendar";

export type ChangeKind = "added" | "deleted" | "updated";

export interface FieldChange {
  field: "title" | "description" | "date" | "start" | "end" | "location";
  from: string;
  to: string;
}

export interface SyncChange {
  kind: ChangeKind;
  date: string;
  startTime: string;
  title: string;
  activity?: Activity;
  event?: CalendarEvent;
  fieldChanges?: FieldChange[];
}

export interface SyncReport {
  changes: SyncChange[];
  addedCount: number;
  deletedCount: number;
  updatedCount: number;
  unchangedCount: number;
}

const startOf = (iso: string): number => new Date(iso).getTime();

// Canvas stores start_at as UTC, but users think in local wall-clock time. Render
// it back to the local components so deleted events display the same time the user
// entered in the file (mirrors how activities are formatted on the file side).
function localDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return { date, time };
}

// Combined "YYYY-MM-DD HH:MM" in local wall-clock time, for displaying instants.
function formatLocal(iso: string): string {
  const { date, time } = localDateTime(iso);
  return `${date} ${time}`;
}

const localDateOnly = (iso: string): string => localDateTime(iso).date;
const localTimeOnly = (iso: string): string => localDateTime(iso).time;

// The file allows "9:15" while Canvas times always render as "09:15". Normalize
// to HH:MM so a changed time is compared by value, not by leading-zero style.
const normalizeTime = (t: string): string => {
  const [h, m] = t.split(":");
  return `${h.padStart(2, "0")}:${m}`;
};

function fieldChangesFor(activity: Activity, ev: CalendarEvent): FieldChange[] {
  const changes: FieldChange[] = [];

  const expectedTitle = buildTitle(activity);
  if (ev.title !== expectedTitle) {
    changes.push({ field: "title", from: ev.title, to: expectedTitle });
  }

  // Date and start time only differ when an event was moved on the calendar
  // (matched by title in the second pass); start-time-matched pairs share the
  // same instant so these never fire there.
  const evDate = localDateOnly(ev.start_at);
  if (evDate !== activity.date) {
    changes.push({ field: "date", from: evDate, to: activity.date });
  }
  const evStart = localTimeOnly(ev.start_at);
  if (normalizeTime(evStart) !== normalizeTime(activity.startTime)) {
    changes.push({
      field: "start",
      from: evStart,
      to: normalizeTime(activity.startTime),
    });
  }

  // buildDescription depends on a user-chosen prefix toggle at import time.
  // Accept either form so we don't false-positive on previously imported events.
  const descPrefixed = buildDescription(activity, true);
  const descPlain = buildDescription(activity, false);
  const evDesc = ev.description ?? "";
  if (evDesc !== descPrefixed && evDesc !== descPlain) {
    changes.push({
      field: "description",
      from: evDesc,
      to: descPrefixed,
    });
  }

  // Compare end time by parsed instant, not by the raw ISO string: Canvas may
  // return "..T10:00:00Z" while toIso emits "..T10:00:00.000Z" for the same time.
  const expectedEnd = toIso(activity.date, activity.endTime);
  const evEndMs = ev.end_at ? new Date(ev.end_at).getTime() : NaN;
  if (evEndMs !== new Date(expectedEnd).getTime()) {
    changes.push({
      field: "end",
      from: ev.end_at ? formatLocal(ev.end_at) : "",
      to: formatLocal(expectedEnd),
    });
  }

  // Only compare location when the file explicitly sets one; at import time a
  // missing location is filled by a prompt we can't know here.
  if (activity.location && activity.location.trim() !== "") {
    if ((ev.location_name ?? "") !== activity.location) {
      changes.push({
        field: "location",
        from: ev.location_name ?? "",
        to: activity.location,
      });
    }
  }

  return changes;
}

export function analyzeCalendarSync(
  activities: Activity[],
  events: CalendarEvent[],
): SyncReport {
  const changes: SyncChange[] = [];
  let addedCount = 0;
  let deletedCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;

  const remaining = [...events];
  const unmatchedActivities: Activity[] = [];

  for (const activity of activities) {
    const startAt = toIso(activity.date, activity.startTime);
    const matchIdx = remaining.findIndex(
      (ev) => startOf(ev.start_at) === startOf(startAt),
    );

    if (matchIdx === -1) {
      unmatchedActivities.push(activity);
      continue;
    }

    const ev = remaining.splice(matchIdx, 1)[0];
    const fieldChanges = fieldChangesFor(activity, ev);
    if (fieldChanges.length > 0) {
      updatedCount++;
      changes.push({
        kind: "updated",
        date: activity.date,
        startTime: activity.startTime,
        title: buildTitle(activity),
        activity,
        event: ev,
        fieldChanges,
      });
    } else {
      unchangedCount++;
    }
  }

  // Second pass: an activity reported as NEW and an event reported as DELETED
  // that share the exact same title are really the same event that moved on the
  // calendar. Report it once as UPDATED, noting which time fields changed.
  const stillDeleted: CalendarEvent[] = [...remaining];
  const stillNew: Activity[] = [];
  for (const activity of unmatchedActivities) {
    const title = buildTitle(activity);
    const delIdx = stillDeleted.findIndex((ev) => ev.title === title);
    if (delIdx !== -1) {
      const ev = stillDeleted.splice(delIdx, 1)[0];
      const fieldChanges = fieldChangesFor(activity, ev);
      updatedCount++;
      changes.push({
        kind: "updated",
        date: activity.date,
        startTime: activity.startTime,
        title,
        activity,
        event: ev,
        fieldChanges,
      });
      continue;
    }
    stillNew.push(activity);
  }

  for (const activity of stillNew) {
    deletedCount++;
    changes.push({
      kind: "deleted",
      date: activity.date,
      startTime: activity.startTime,
      title: buildTitle(activity),
      activity,
    });
  }

  for (const ev of stillDeleted) {
    addedCount++;
    const { date, time: startTime } = localDateTime(ev.start_at);
    changes.push({
      kind: "added",
      date,
      startTime,
      title: ev.title,
      event: ev,
    });
  }

  return { changes, addedCount, deletedCount, updatedCount, unchangedCount };
}
