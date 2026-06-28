// Tiny localStorage-backed offline queue for attendance records.
import { supabase } from "@/integrations/supabase/client";

const KEY = "pending_attendance_v1";

export type PendingAttendance = {
  student_id: string;
  attendance_date: string; // YYYY-MM-DD
  attendance_time: string; // ISO
  trip: "morning" | "evening";
  route_id: string | null;
  device_name: string | null;
  user_id: string | null;
  latitude: number | null;
  longitude: number | null;
  remarks: string | null;
};

export function getPending(): PendingAttendance[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}

export function setPending(list: PendingAttendance[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function queueAttendance(rec: PendingAttendance) {
  const list = getPending();
  list.push(rec);
  setPending(list);
}

export async function flushPending(): Promise<{ flushed: number; failed: number }> {
  const list = getPending();
  if (!list.length) return { flushed: 0, failed: 0 };
  let flushed = 0;
  const remaining: PendingAttendance[] = [];
  for (const rec of list) {
    const { error } = await supabase.from("attendance").insert(rec);
    if (!error || error.code === "23505") {
      flushed++;
    } else {
      remaining.push(rec);
    }
  }
  setPending(remaining);
  return { flushed, failed: remaining.length };
}
