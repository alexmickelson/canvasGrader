import type { FC } from "react";
import { Suspense, useState } from "react";
import { useParams } from "react-router";
import { useSubmissionsQuery, useGitHubClassroomMutation } from "./graderHooks";
import type { CanvasSubmission } from "../../server/trpc/routers/canvas/canvasRouter";
import { userName, initials } from "./userUtils";
import { useAssignmentsQuery } from "../course/canvasAssignmentHooks";
import { SubmissionDetails } from "./submission/SubmissionDetails";
import { getSubmissionStatusChips } from "./submission/submissionUtils";

export const AssignmentGraderPage = () => {
  const { courseId, assignmentId } = useParams<{
    courseId: string;
    assignmentId: string;
  }>();
  const parsedCourseId = courseId ? Number(courseId) : undefined;
  const parsedAssignmentId = assignmentId ? Number(assignmentId) : undefined;

  // Selected submission for slide-over panel
  const [selected, setSelected] = useState<CanvasSubmission | null>(null);

  // GitHub Classroom integration state
  const [gitHubClassroomInput, setGitHubClassroomInput] = useState("");
  const [isGitHubPanelOpen, setIsGitHubPanelOpen] = useState(false);

  const gitHubClassroomMutation = useGitHubClassroomMutation();

  const handleGitHubDownload = () => {
    if (!gitHubClassroomInput.trim()) return;

    // Parse GitHub Classroom assignment ID from input
    let classroomAssignmentId = gitHubClassroomInput.trim();

    // If it's a full gh command, extract the assignment ID
    const commandMatch = gitHubClassroomInput.match(
      /gh classroom clone student-repos -a (\d+)/
    );
    if (commandMatch) {
      classroomAssignmentId = commandMatch[1];
    } else if (!/^\d+$/.test(classroomAssignmentId)) {
      // If it's not a pure number, try to extract any number from it
      const numberMatch = gitHubClassroomInput.match(/(\d+)/);
      if (numberMatch) {
        classroomAssignmentId = numberMatch[1];
      } else {
        console.error(
          "Could not parse assignment ID from input:",
          gitHubClassroomInput
        );
        return;
      }
    }

    // Call the tRPC mutation
    gitHubClassroomMutation.mutate({
      classroomAssignmentId,
      assignmentId: parsedAssignmentId!,
      courseId: parsedCourseId!,
    });

    // Close the panel immediately to show progress
    setIsGitHubPanelOpen(false);
  };

  if (!parsedCourseId || !parsedAssignmentId) {
    return (
      <div className="p-4 text-gray-200">Missing courseId or assignmentId</div>
    );
  }

  return (
    <div className="p-4 text-gray-200 h-screen flex flex-col">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h1 className="text-xl font-semibold">
          Grade{" "}
          <AssignmentName
            assignmentId={parsedAssignmentId}
            courseId={parsedCourseId}
          />
        </h1>

        <div className="flex items-center gap-3">
          {/* GitHub download progress indicator */}
          {gitHubClassroomMutation.isPending && (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-600/20 border border-blue-500/30 rounded-md text-blue-300 text-sm">
              <div className="w-4 h-4 border-2 border-blue-300 border-t-transparent rounded-full animate-spin"></div>
              Downloading GitHub Classroom repositories...
            </div>
          )}

          {/* GitHub Classroom Integration Button */}
          <button
            onClick={() => setIsGitHubPanelOpen(true)}
            disabled={gitHubClassroomMutation.isPending}
            className="px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-md text-sm font-medium transition-colors"
          >
            GitHub Classroom
          </button>
        </div>
      </div>{" "}
      {/* Main two-pane layout: submissions list (left) and details panel (right) */}
      <div className="flex gap-4 items-stretch flex-1 min-h-0 flex-nowrap w-full">
        <div className="flex-1 min-w-0">
          <Suspense
            fallback={<div className="text-gray-400">Loading submissions…</div>}
          >
            <SubmissionsList
              courseId={parsedCourseId}
              assignmentId={parsedAssignmentId}
              selectedId={selected?.id ?? null}
              onSelect={setSelected}
            />
          </Suspense>
        </div>

        {/* Slide-in side panel that shares UI space */}
        <aside
          className={`bg-gray-900 border-l border-gray-800 shadow-xl transition-all duration-300 ease-out flex flex-col ${
            selected ? "w-3/4 " : "w-auto"
          }`}
          role="complementary"
          aria-labelledby="submission-details-title"
          aria-hidden={selected ? undefined : true}
        >
          <div className="flex items-center justify-between p-4 border-b border-gray-800 flex-shrink-0">
            <div id="submission-details-title" className="text-xl truncate">
              {selected ? userName(selected) : ""}
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
              <SubmissionDetails
                submission={selected}
                courseId={Number(courseId)}
              />
            )}
          </div>
        </aside>
      </div>
      {/* GitHub Classroom Panel */}
      {isGitHubPanelOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold">
                GitHub Classroom Integration
              </h2>
              <button
                onClick={() => setIsGitHubPanelOpen(false)}
                className="text-gray-400 hover:text-gray-200 rounded cursor-pointer"
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
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label
                  htmlFor="github-url"
                  className="block text-sm font-medium text-gray-300 mb-2"
                >
                  GitHub Classroom Assignment
                </label>
                <input
                  id="github-url"
                  type="text"
                  value={gitHubClassroomInput}
                  onChange={(e) => setGitHubClassroomInput(e.target.value)}
                  placeholder="730769 or gh classroom clone student-repos -a 730769"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div className="text-xs text-gray-400">
                <p>
                  Enter either the assignment ID (e.g., 730769) or the full
                  GitHub CLI command.
                </p>
                <p className="mt-1">
                  This will download all student repositories and organize them
                  into submission folders.
                </p>
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setIsGitHubPanelOpen(false)}
                  className="px-4 py-2 text-gray-300 hover:text-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGitHubDownload}
                  disabled={
                    !gitHubClassroomInput.trim() ||
                    gitHubClassroomMutation.isPending
                  }
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-md text-sm font-medium transition-colors flex items-center gap-2"
                >
                  {gitHubClassroomMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Downloading...
                    </>
                  ) : (
                    "Download & Organize"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const AssignmentName = ({
  assignmentId,
  courseId,
}: {
  assignmentId: number;
  courseId: number;
}) => {
  const { data: assignments } = useAssignmentsQuery(courseId);
  const assignment = assignments?.find((a) => a.id === assignmentId);
  if (!assignment) {
    return <span className="text-gray-400">Unknown Assignment</span>;
  }

  return <span className="text-gray-200">{assignment.name}</span>;
};

const SubmissionsList: FC<{
  courseId: number;
  assignmentId: number;
  selectedId: number | null;
  onSelect: (s: CanvasSubmission) => void;
}> = ({ courseId, assignmentId, selectedId, onSelect }) => {
  const { data: submissions } = useSubmissionsQuery(courseId, assignmentId);
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">
        {submissions?.length ?? 0} submissions
      </div>
      {!submissions?.length ? (
        <div className="text-sm text-gray-400 border border-dashed border-gray-700 rounded p-6">
          No submissions found.
        </div>
      ) : (
        <ul className="space-y-2">
          {submissions.map((s) => {
            const name = userName(s);
            const isActive = selectedId === s.id;
            const submittedAt = s.submitted_at
              ? new Date(s.submitted_at)
              : null;
            const statusChips = getSubmissionStatusChips(s);
            const gradeDisplay =
              s.grade ?? (s.score != null ? `${s.score}` : null);

            return (
              <li
                key={s.id}
                className={`group cursor-pointer rounded-md border transition-colors ${
                  isActive
                    ? "border-indigo-500/60 bg-gray-800/80 ring-2 ring-indigo-500/30"
                    : "border-gray-700 bg-gray-800 hover:bg-gray-800/70"
                }`}
                onClick={() => onSelect(s)}
                role="button"
                aria-selected={isActive}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(s);
                  }
                }}
              >
                <div className="p-3 flex items-start gap-3">
                  {/* Avatar */}
                  <div className="shrink-0 h-9 w-9 rounded-full bg-gradient-to-br from-gray-600 to-gray-700 grid place-items-center text-sm font-semibold text-white">
                    {initials(name)}
                  </div>
                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    {/* Top row: name + chips + grade */}
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="truncate font-medium text-gray-100">
                            {name}
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {statusChips.map((c, i) => (
                              <span
                                key={i}
                                className={`px-1.5 py-0.5 text-[10px] rounded-full ${c.className}`}
                              >
                                {c.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      {gradeDisplay && (
                        <div className="ml-auto shrink-0">
                          <span className="inline-flex items-center rounded-md border border-gray-600 bg-gray-900 px-2 py-0.5 text-xs font-semibold text-gray-100">
                            {gradeDisplay}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Bottom row: submitted at, attempt, id */}
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-400">
                      <span>
                        {submittedAt
                          ? `Submitted ${submittedAt.toLocaleString()}`
                          : "Not submitted"}
                      </span>
                      {typeof s.attempt === "number" && (
                        <span className="inline-flex items-center gap-1">
                          <span className="h-1 w-1 rounded-full bg-gray-600" />
                          Attempt {s.attempt}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <span className="h-1 w-1 rounded-full bg-gray-600" />
                        ID {s.id}
                      </span>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
