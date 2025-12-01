import type { CanvasAssignment } from "../../../server/trpc/routers/canvas/canvasModels";

export const useAssignmentGroups = (
  assignments: CanvasAssignment[]
) => {
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

  return assignments.reduce(
    (acc, assignment) => {
      const key = getWeekKey(assignment.due_at);
      const existingIndex = acc.findIndex((g) => g.key === key);

      if (existingIndex >= 0) {
        return acc.map((g, i) =>
          i === existingIndex ? { ...g, items: [...g.items, assignment] } : g
        );
      }

      return [
        ...acc,
        {
          key,
          weekStart: key === "__nodue" ? undefined : new Date(key),
          items: [assignment],
        },
      ];
    },
    [] as {
      items: CanvasAssignment[] ;
      key: string;
      weekStart: Date | undefined;
    }[]
  ).sort((a, b) => {
    if (a.weekStart && b.weekStart) {
      return a.weekStart.getTime() - b.weekStart.getTime();
    }
    if (a.weekStart && !b.weekStart) {
      return -1;
    }
    if (!a.weekStart && b.weekStart) {
      return 1;
    }
    return 0;
  })
  .reverse();
};
