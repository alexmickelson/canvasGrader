import { Suspense, useState } from "react";
import { useParams } from "react-router";
import { userName } from "./userUtils";
import { SubmissionDetailsWrapper } from "./submission/SubmissionDetails";
import { useSettingsQuery } from "../home/settingsHooks";
import type { CanvasSubmission } from "../../server/trpc/routers/canvas/canvasModels";
import { AssignmentName } from "./AssignmentName";
import { SubmissionsList } from "./SubmissionsList";
import { GitHubClassroomDownload } from "./GitHubClassroomDownload";
import { AnalysisWrapper } from "./analysis/AnalysisWrapper";
import { useAssignmentsQuery } from "../course/canvasAssignmentHooks";
import { useCanvasCoursesQuery } from "../home/canvasHooks";

export const AssignmentGraderPage = () => {
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

  // Selected submission for slide-over panel
  const [selected, setSelected] = useState<CanvasSubmission | null>(null);

  // View toggle: 'submission' or 'analysis'
  const [currentView, setCurrentView] = useState<"submission" | "analysis">(
    "submission"
  );

  if (!parsedCourseId || !parsedAssignmentId) {
    return (
      <div className="p-4 text-gray-200">Missing courseId or assignmentId</div>
    );
  }

  return (
    <div className="p-4 text-gray-200 h-screen w-screen flex flex-col">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h1 className="text-xl font-semibold">
          Grade{" "}
          <AssignmentName
            assignmentId={parsedAssignmentId}
            courseId={parsedCourseId}
          />
        </h1>

        {course && canvasCourse && assignment && (
          <GitHubClassroomDownload
            courseId={parsedCourseId}
            assignmentId={parsedAssignmentId}
            course={course}
            termName={canvasCourse.term?.name || "Unknown Term"}
            courseName={canvasCourse.name}
            assignmentName={assignment.name}
          />
        )}
      </div>{" "}
      {/* Main two-pane layout: submissions list (left) and details panel (right) */}
      <div className="flex gap-4 items-stretch flex-1 min-h-0 w-full">
        <div className="w-64">
          <Suspense
            fallback={<div className="text-gray-400">Loading submissions…</div>}
          >
            <SubmissionsList
              courseId={parsedCourseId}
              assignmentId={parsedAssignmentId}
              selectedId={selected?.id ?? null}
              assignment={assignment ?? null}
              onSelect={(submission) => {
                setSelected(submission);
                setCurrentView("submission"); // Reset to submission view when selecting new student
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
          <div className="flex items-center justify-between p-4 border-b border-gray-800 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div id="submission-details-title" className="truncate">
                {selected ? userName(selected) : ""}
              </div>

              {/* View Toggle Buttons */}
              {selected && (
                <div className="flex rounded-md border border-gray-600 overflow-hidden">
                  <button
                    onClick={() => setCurrentView("submission")}
                    className={`unstyled px-3 py-1 text-xs font-medium transition-colors cursor-pointer  ${
                      currentView === "submission"
                        ? "bg-blue-800 text-white"
                        : "text-gray-300 hover:bg-gray-600"
                    }`}
                  >
                    Submission
                  </button>
                  <button
                    onClick={() => setCurrentView("analysis")}
                    className={`unstyled px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                      currentView === "analysis"
                        ? "bg-blue-800 text-white"
                        : "text-gray-300 hover:bg-gray-600"
                    }`}
                  >
                    AI Analysis
                  </button>
                </div>
              )}
            </div>

            <button
              className="unstyled text-gray-400 hover:text-gray-200 rounded cursor-pointer "
              onClick={() => setSelected(null)}
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
          <div className="p-4 space-y-3 text-sm flex-1 min-h-0">
            {selected && courseId && (
              <>
                {currentView === "submission" ? (
                  <SubmissionDetailsWrapper
                    submission={selected}
                    courseId={Number(courseId)}
                  />
                ) : (
                  <AnalysisWrapper
                    submission={selected}
                    courseId={Number(courseId)}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
