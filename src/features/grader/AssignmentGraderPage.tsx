import { Suspense, useState, type FC } from "react";
import { useParams } from "react-router";
import { userName } from "./userUtils";
import { SubmissionDetailsWrapper } from "./submission/SubmissionDetails";
import { useSettingsQuery } from "../home/settingsHooks";
import type {
  CanvasAssignment,
  CanvasCourse,
  CanvasSubmission,
} from "../../server/trpc/routers/canvas/canvasModels";
import type { SettingsCourse } from "../../server/trpc/routers/settingsRouter";
import { AssignmentName } from "./AssignmentName";
import { SubmissionsList } from "./SubmissionsList";
import { GitHubClassroomDownload } from "./GitHubClassroomDownload";
import { useAssignmentsQuery } from "../course/canvasAssignmentHooks";
import { useCanvasCoursesQuery } from "../home/canvasHooks";
import { ViewingItemProvider } from "./shared/viewingItemContext/ViewingItemContext";
import {
  useUpdateSubmissionsMutation,
  useTranscribeSubmissionImagesMutation,
  useLoadGithubClassroomDataQuery,
} from "./graderHooks";
import { AiQueueStatus } from "../home/AiQueueStatus";

export const AssignmentGraderPage = () => {
  useLoadGithubClassroomDataQuery();
  const { courseId, assignmentId } = useParams<{
    courseId: string;
    assignmentId: string;
  }>();
  const { data: settings } = useSettingsQuery();
  const parsedCourseId = courseId ? Number(courseId) : undefined;
  const parsedAssignmentId = assignmentId ? Number(assignmentId) : undefined;
  const course = settings?.courses?.find((c) => c.canvasId === parsedCourseId);

  // Get Canvas course and assignment data for GitHub Classroom integration
  const { data: canvasCourses } = useCanvasCoursesQuery();
  const { data: assignments } = useAssignmentsQuery(parsedCourseId!);

  const canvasCourse = canvasCourses?.find((c) => c.id === parsedCourseId);
  const assignment = assignments?.find((a) => a.id === parsedAssignmentId);

  if (!courseId || !assignmentId) {
    return (
      <div className="p-4 text-red-400">Invalid course or assignment ID.</div>
    );
  }

  if (!parsedCourseId || !parsedAssignmentId) {
    return (
      <div className="p-4 text-red-400">
        Course ID and Assignment ID must be valid numbers.
      </div>
    );
  }

  if (!course) {
    return (
      <div className="p-4 text-red-400">
        Course with ID {parsedCourseId} not found in settings.
      </div>
    );
  }

  if (!canvasCourse) {
    return (
      <div className="p-4 text-red-400">
        Course with ID {parsedCourseId} not found in Canvas.
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="p-4 text-red-400">
        Assignment with ID {parsedAssignmentId} not found in Canvas.
      </div>
    );
  }

  return (
    <InnerAssignmentPage
      courseId={parsedCourseId}
      assignmentId={parsedAssignmentId}
      assignmentName={assignment.name}
      assignment={assignment}
      canvasCourse={canvasCourse}
      course={course}
    />
  );
};

const InnerAssignmentPage: FC<{
  courseId: number;
  assignmentId: number;
  assignmentName: string;
  assignment: CanvasAssignment;
  canvasCourse: CanvasCourse;
  course: SettingsCourse;
}> = ({
  courseId,
  assignmentId,
  assignmentName,
  assignment,
  course,
  canvasCourse,
}) => {
  const [selected, setSelected] = useState<CanvasSubmission | undefined>(
    undefined
  );

  const updateSubmissionsMutation = useUpdateSubmissionsMutation();

  const transcribeImagesMutation = useTranscribeSubmissionImagesMutation();

  return (
    <div className="p-4 text-gray-200 h-screen w-screen flex flex-col">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h1 className="text-xl font-semibold">
          Grade{" "}
          <AssignmentName assignmentId={assignmentId} courseId={courseId} />
        </h1>
        <AiQueueStatus />

        <div className="flex items-center gap-3">
          <button
            onClick={() =>
              updateSubmissionsMutation.mutate({
                courseId: courseId,
                assignmentId: assignmentId,
                assignmentName,
              })
            }
            disabled={updateSubmissionsMutation.isPending}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 text-white rounded-md text-sm font-medium transition-colors"
          >
            {updateSubmissionsMutation.isPending
              ? "Refreshing..."
              : "Refresh Submissions"}
          </button>

          <button
            onClick={() =>
              transcribeImagesMutation.mutate({
                courseId: courseId,
                assignmentId: assignmentId,
                assignmentName,
              })
            }
            disabled={transcribeImagesMutation.isPending}
            className="px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:opacity-50 text-white rounded-md text-sm font-medium transition-colors"
          >
            {transcribeImagesMutation.isPending
              ? "Transcribing..."
              : "Transcribe Images"}
          </button>

          {course && canvasCourse && assignment && (
            <GitHubClassroomDownload
              courseId={courseId}
              assignmentId={assignmentId}
              course={course}
              termName={canvasCourse.term?.name || "Unknown Term"}
              courseName={canvasCourse.name}
              assignmentName={assignment.name}
            />
          )}
        </div>
      </div>
      {
        <ViewingItemProvider>
          <div className="flex gap-4 items-stretch flex-1 min-h-0 w-full">
            <div className="w-52">
              <Suspense
                fallback={
                  <div className="text-gray-400">Loading submissions…</div>
                }
              >
                <SubmissionsList
                  courseId={courseId}
                  assignmentId={assignmentId}
                  selectedId={selected?.id}
                  assignment={assignment}
                  onSelect={(submission) => {
                    setSelected(submission);
                  }}
                />
              </Suspense>
            </div>

            <div
              className={`
                bg-gray-900 border-l border-gray-800 shadow-xl 
                transition-all duration-300 ease-out 
                flex-1
                flex flex-col
          `}
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-800 flex-shrink-0 min-h-0">
                <div className="flex items-center gap-3">
                  <div id="submission-details-title" className="truncate">
                    {selected ? userName(selected) : ""}
                  </div>
                  {selected && (
                    <a
                      href={`https://snow.instructure.com/courses/${courseId}/gradebook/speed_grader?assignment_id=${assignmentId}&student_id=${selected.user_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 text-sm underline"
                    >
                      View in Canvas
                    </a>
                  )}
                </div>

                <button
                  className="unstyled text-gray-400 hover:text-gray-200 rounded cursor-pointer "
                  onClick={() => setSelected(undefined)}
                  aria-label="Close"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <div className="p-4 space-y-3 text-sm flex-1 min-h-0 ">
                {selected && (
                  <SubmissionDetailsWrapper
                    submission={selected}
                    courseId={Number(courseId)}
                  />
                )}
              </div>
            </div>
          </div>
        </ViewingItemProvider>
      }
    </div>
  );
};
