import type { FC } from "react";
import type { CanvasSubmission } from "../../server/trpc/routers/canvas/canvasModels";
import { useSubmissionsQuery } from "./graderHooks";
import { getSubmissionStatusChips } from "./submission/submissionUtils";
import { userName, initials } from "./userUtils";

export const SubmissionsList: FC<{
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
