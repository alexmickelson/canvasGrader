import type { FC } from "react";
import { Suspense } from "react";
import { useParams } from "react-router";
import { useSubmissionsQuery } from "./graderHooks";

export const AssignmentGraderPage = () => {
  const { courseId, assignmentId } = useParams<{
    courseId: string;
    assignmentId: string;
  }>();
  const parsedCourseId = courseId ? Number(courseId) : undefined;
  const parsedAssignmentId = assignmentId ? Number(assignmentId) : undefined;

  if (!parsedCourseId || !parsedAssignmentId) {
    return (
      <div className="p-4 text-gray-200">Missing courseId or assignmentId</div>
    );
  }

  return (
    <div className="p-4 text-gray-200">
      <h1 className="text-xl font-semibold mb-4">Assignment Grader</h1>
      <Suspense
        fallback={<div className="text-gray-400">Loading submissions…</div>}
      >
        <SubmissionsList
          courseId={parsedCourseId}
          assignmentId={parsedAssignmentId}
        />
      </Suspense>
    </div>
  );
};

const SubmissionsList: FC<{ courseId: number; assignmentId: number }> = ({
  courseId,
  assignmentId,
}) => {
  const { data: submissions } = useSubmissionsQuery(courseId, assignmentId);
  return (
    <div>
      <div className="text-sm text-gray-400 mb-2">
        {submissions?.length ?? 0} submissions
      </div>
      <ul className="space-y-2">
        {submissions?.map((s) => (
          <li
            key={s.id}
            className="p-2 rounded bg-gray-800 border border-gray-700 text-gray-200"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">
                {s.user?.name ?? "Unknown student"}
              </span>
              <span className="text-xs text-gray-400">{s.workflow_state}</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">Submission #{s.id}</div>
          </li>
        ))}
      </ul>
    </div>
  );
};
