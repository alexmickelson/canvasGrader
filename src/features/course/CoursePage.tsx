import type { FC } from "react";
import { useState } from "react";
import { useParams } from "react-router";
import { useAssignmentsQuery } from "../../utils/canvas/canvasAssignmentHooks";
import { useAssignmentGroups } from "./weeks/useAssignmentGroups";
import { CourseNameDisplay } from "../../components/CourseNameDisplay";
import { Toggle } from "../../components/Toggle";
import { DisplayWeek } from "./weeks/DisplayWeek";
import { useCanvasCoursesQuery } from "../../utils/canvas/canvasHooks";
import { CourseProvider } from "../../components/contexts/CourseProvider";
import { RefetchAssignmentsButton } from "./RefetchAssignmentsButton";
import { RefreshUngradedSubmissionsButton } from "./RefreshUngradedSubmissionsButton";

export const CoursePage = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const parsedCourseId = courseId ? Number(courseId) : undefined;

  return (
    <div className="p-4 text-gray-200">
      {parsedCourseId ? (
        <CoursePageCourseProvider courseId={parsedCourseId}>
          <div className="flex justify-between items-center">
            <h2 className="unstyled text-2xl">
              Course <CourseNameDisplay courseId={parsedCourseId} />
            </h2>
            <div className="flex gap-x-3">
              <RefetchAssignmentsButton />
              <RefreshUngradedSubmissionsButton />
            </div>
          </div>

          <CourseAssignments />
        </CoursePageCourseProvider>
      ) : (
        <div>Invalid course ID: {parsedCourseId}</div>
      )}
    </div>
  );
};

const CoursePageCourseProvider: FC<{
  courseId: number;
  children: React.ReactNode;
}> = ({ courseId, children }) => {
  const { data: courses } = useCanvasCoursesQuery();
  const currentCourse = courses?.find((c) => c.id === courseId);
  if (!currentCourse) {
    return <>no course found to provide context</>;
  }

  return (
    <CourseProvider
      courseName={currentCourse.name}
      courseId={courseId}
      termName={currentCourse.term.name}
      course={currentCourse}
    >
      {children}
    </CourseProvider>
  );
};

export const CourseAssignments = () => {
  const { data: assignments } = useAssignmentsQuery();

  const [filter, setFilter] = useState("");
  const [hideGraded, setHideGraded] = useState(true);
  const [hideFuture, setHideFuture] = useState(true);
  const [now] = useState(() => Date.now());

  const filterValue = filter.trim().toLowerCase();

  const filtered = assignments
    .filter((a) => a.name.toLowerCase().includes(filterValue))
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
    <div className="mt-4">
      <div className="flex">
        <div className="flex-1">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter assignments..."
            className="w-full p-2 rounded-md bg-gray-800 border border-gray-700 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-700"
          />
        </div>
        <div className="flex flex-col items-start">
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
        </div>
      </div>

      <div className="">
        {assignmentsByWeek.map((group) => (
          <DisplayWeek
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
