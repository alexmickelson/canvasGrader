import type { FC } from "react";
import { Suspense, useState } from "react";
import { useParams } from "react-router";
import { useSubmissionsQuery } from "./graderHooks";
import type { CanvasSubmission } from "../../server/trpc/routers/canvasRouter";
import { SubmissionDetails } from "./SubmissionDetails";
import { userName, initials } from "./userUtils";
import { useAssignmentsQuery } from "../course/canvasAssignmentHooks";

export const AssignmentGraderPage = () => {
  const { courseId, assignmentId } = useParams<{
    courseId: string;
    assignmentId: string;
  }>();
  const parsedCourseId = courseId ? Number(courseId) : undefined;
  const parsedAssignmentId = assignmentId ? Number(assignmentId) : undefined;

  // Selected submission for slide-over panel
  const [selected, setSelected] = useState<CanvasSubmission | null>(null);

  if (!parsedCourseId || !parsedAssignmentId) {
    return (
      <div className="p-4 text-gray-200">Missing courseId or assignmentId</div>
    );
  }

  return (
    <div className="p-4 text-gray-200">
      <h1 className="text-xl font-semibold mb-4">
        Grade{" "}
        <AssignmentName
          assignmentId={parsedAssignmentId}
          courseId={parsedCourseId}
        />
      </h1>

      {/* Main two-pane layout: submissions list (left) and details panel (right) */}
      <div className="flex gap-4 items-stretch">
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
          className={`relative bg-gray-900 border-l border-gray-800 shadow-xl overflow-hidden transition-all duration-300 ease-out ${
            selected ? "w-3/4 " : "w-0"
          }`}
          role="complementary"
          aria-labelledby="submission-details-title"
          aria-hidden={selected ? undefined : true}
        >
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            <h2
              id="submission-details-title"
              className="text-lg font-semibold truncate"
            >
              {selected ? userName(selected) : ""}
            </h2>
            <button
              className="text-gray-400 hover:text-gray-200 rounded p-1"
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
          <div className="p-4 space-y-3 text-sm">
            {selected && courseId ? (
              <SubmissionDetails
                submission={selected}
                courseId={Number(courseId)}
              />
            ) : (
              <div className="text-gray-400">No submission selected</div>
            )}
          </div>
        </aside>
      </div>
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
            const statusChips: Array<{ label: string; color: string }> = [];
            if (s.missing)
              statusChips.push({
                label: "Missing",
                color:
                  "bg-amber-500/15 text-amber-400 ring-1 ring-amber-400/30",
              });
            if (s.late)
              statusChips.push({
                label: "Late",
                color: "bg-rose-500/15 text-rose-400 ring-1 ring-rose-400/30",
              });
            if (s.workflow_state)
              statusChips.push({
                label: s.workflow_state,
                color:
                  "bg-indigo-500/10 text-indigo-300 ring-1 ring-indigo-400/20",
              });
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
                                className={`px-1.5 py-0.5 text-[10px] rounded-full ${c.color}`}
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
