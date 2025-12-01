import { useState } from "react";
import { Toggle } from "../../../components/Toggle";
import { useAssignmentsFromAllCoursesQuery } from "../../../utils/canvas/canvasAssignmentHooks";
import { useAssignmentGroups } from "../../course/weeks/useAssignmentGroups";
import { WeekToGrade } from "./WeekToGrade";

export const RecentAssignmentsToGrade = () => {
  const [hideGraded, setHideGraded] = useState(true);
  const [hideFuture, setHideFuture] = useState(true);
  const [now] = useState(() => Date.now());
  const allAssignmentsQueries = useAssignmentsFromAllCoursesQuery();

  const allAssignments = allAssignmentsQueries.flatMap((q) =>
    q.data.assignments.map((a) => ({ ...a, courseId: q.data.courseId }))
  );


  const filtered = allAssignments
    .filter((a) => {
      if (!hideFuture) return true;
      if (!a.due_at) return true;
      return new Date(a.due_at).getTime() <= now;
    })
    .slice()
    .sort((a, b) => {
      if (!a.due_at && !b.due_at) return 0;
      if (!a.due_at) return 1;
      if (!b.due_at) return -1;
      return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
    });



  const assignmentsByWeek = useAssignmentGroups(filtered);
  return (
    <div className="">
      <div>
        <Toggle
          label="hide graded assignments"
          value={hideGraded}
          onChange={setHideGraded}
        />
        <Toggle
          label="hide future assignments"
          value={hideFuture}
          onChange={setHideFuture}
        />
        {assignmentsByWeek.map((group) => (
          <WeekToGrade
            key={group.key}
            group={group}
            hideGraded={hideGraded}
            assignments={group.items}
          />
        ))}
      </div>
    </div>
  );
};
