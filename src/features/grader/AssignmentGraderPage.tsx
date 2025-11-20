import { Suspense, useState } from "react";
import { useParams } from "react-router";
import { userName } from "./userUtils";
import { SubmissionDetailsWrapper } from "./submission/SubmissionDetails";
import type { CanvasSubmission } from "../../server/trpc/routers/canvas/canvasModels";
import { AssignmentName } from "./AssignmentName";
import { SubmissionsList } from "./SubmissionsList";
import { useAssignmentsQuery } from "../course/canvasAssignmentHooks";
import { useCanvasCoursesQuery } from "../home/hooks/canvasHooks";
import { ViewingItemProvider } from "./shared/viewingItemContext/ViewingItemContext";
import {
  useUpdateSubmissionsMutation,
  useTranscribeSubmissionImagesMutation,
  useLoadGithubClassroomDataQuery,
  useUntranscribedImageCountQuery,
} from "./graderHooks";
import { AiQueueStatus } from "../home/AiQueueStatus";
import { Toggle } from "../../components/Toggle";
import { AiSandbox } from "./submission/AiSandbox";
import { useLoadSubmissionToSandboxMutation } from "../sandbox/sandboxHooks";
import {
  CourseProvider,
  useCurrentCourse,
} from "../../components/contexts/CourseProvider";
import {
  AssignmentProvider,
  useCurrentAssignment,
} from "../../components/contexts/AssignmentProvider";
import { GithubClassroomSubmissionDownloader } from "./gitDownload/GithubClassroomSubmissionDownloader";

export const AssignmentGraderPage = () => {
  useLoadGithubClassroomDataQuery();
  const { courseId, assignmentId } = useParams<{
    courseId: string;
    assignmentId: string;
  }>();
  const parsedCourseId = courseId ? Number(courseId) : undefined;

  const { data: canvasCourses } = useCanvasCoursesQuery();

  const canvasCourse = canvasCourses?.find((c) => c.id === parsedCourseId);

  if (!courseId || !assignmentId) {
    return (
      <div className="p-4 text-red-400">Invalid course or assignment ID.</div>
    );
  }

  if (!parsedCourseId) {
    return (
      <div className="p-4 text-red-400">Course ID must be valid number.</div>
    );
  }

  if (!canvasCourse) {
    return (
      <div className="p-4 text-red-400">
        Course with ID {parsedCourseId} not found in Canvas.
      </div>
    );
  }
  return (
    <CourseProvider
      courseId={parsedCourseId}
      courseName={canvasCourse.name}
      termName={canvasCourse.term.name}
      course={canvasCourse}
    >
      <AssignmentPageAssignmentProviderWrapper />
    </CourseProvider>
  );
};

const AssignmentPageAssignmentProviderWrapper = () => {
  const { assignmentId } = useParams<{
    assignmentId: string;
  }>();
  const parsedAssignmentId = assignmentId ? Number(assignmentId) : undefined;

  const { data: assignments } = useAssignmentsQuery();
  const assignment = assignments?.find((a) => a.id === parsedAssignmentId);

  if (!parsedAssignmentId) {
    return (
      <div className="p-4 text-red-400">
        Assignment ID must be valid number.
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
    <AssignmentProvider
      assignmentId={parsedAssignmentId}
      assignmentName={assignment.name}
      assignment={assignment}
    >
      <InnerAssignmentPage />
    </AssignmentProvider>
  );
};

const InnerAssignmentPage = () => {
  const { courseId } = useCurrentCourse();
  const { assignmentId, assignmentName } = useCurrentAssignment();
  const [selected, setSelected] = useState<CanvasSubmission | undefined>(
    undefined
  );
  const [showSandbox, setShowSandbox] = useState(false);

  const updateSubmissionsMutation = useUpdateSubmissionsMutation();

  const transcribeImagesMutation = useTranscribeSubmissionImagesMutation();

  const { data: imageCount } = useUntranscribedImageCountQuery(assignmentId);

  const loadSubmission = useLoadSubmissionToSandboxMutation();

  const handleSandboxToggle = async (enabled: boolean) => {
    if (enabled && selected) {
      // Load submission when enabling sandbox
      await loadSubmission.mutateAsync({
        studentName: selected.user.name,
      });
    } else {
      // unload from sandbox, terminate any old processes...
    }
    setShowSandbox(enabled);
  };

  return (
    <div className="p-4 text-gray-200 h-screen w-screen flex flex-col">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h1 className="text-xl font-semibold">
          Grade <AssignmentName />
        </h1>
        <AiQueueStatus />

        <div className="flex items-center gap-3">
          <button
            onClick={() =>
              updateSubmissionsMutation.mutate({ assignmentId, assignmentName })
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
                assignmentId: assignmentId,
                assignmentName,
              })
            }
            disabled={transcribeImagesMutation.isPending}
            className=" text-sm "
          >
            {transcribeImagesMutation.isPending
              ? "Transcribing..."
              : `Transcribe Images (${imageCount.count})`}
          </button>
          <GithubClassroomSubmissionDownloader />
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
                  selectedId={selected?.id}
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
                    <>
                      <a
                        href={`https://snow.instructure.com/courses/${courseId}/gradebook/speed_grader?assignment_id=${assignmentId}&student_id=${selected.user_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 text-sm underline"
                      >
                        View in Canvas
                      </a>

                      <Toggle
                        label="Interactive Sandbox"
                        value={showSandbox}
                        onChange={handleSandboxToggle}
                      />
                    </>
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
                {selected && showSandbox && (
                  <AiSandbox
                    key={selected.id}
                    studentName={selected.user.name}
                  />
                )}
                {selected && !showSandbox && (
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
