import { useMemo } from "react";
import type { CanvasAssignment } from "../../../server/trpc/routers/canvas/canvasModels";

export const useAssignmentGroups = (
  assignments?: CanvasAssignment[] | null
) => {
  return useMemo(() => {
    if (!assignments) return [];

    const result: {
      items: CanvasAssignment[];
      key: string;
      weekStart: Date | undefined;
    }[] = [];
    const map = new Map<
      string,
      { items: CanvasAssignment[]; key: string; weekStart: Date | undefined }
    >();

    const getWeekKey = (iso?: string | null) => {
      if (!iso) return "__nodue";
      const d = new Date(iso);
      // Normalize to start of week (Monday)
      const day = (d.getDay() + 6) % 7; // Monday=0 .. Sunday=6
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - day);
      weekStart.setHours(0, 0, 0, 0);
      return weekStart.toISOString();
    };

    for (const a of assignments) {
      const key = getWeekKey(a.due_at);
      if (!map.has(key)) {
        map.set(key, {
          key,
          weekStart: key === "__nodue" ? undefined : new Date(key),
          items: [],
        });
      }
      map.get(key)!.items.push(a);
    }

    // Keep order consistent with assignments (which should already be sorted)
    for (const a of assignments) {
      const key = getWeekKey(a.due_at);
      const g = map.get(key)!;
      if (!result.includes(g)) result.push(g);
    }

    return result;
  }, [assignments]);
};
