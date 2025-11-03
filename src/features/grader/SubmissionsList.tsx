import type { FC } from "react";
import type { CanvasSubmission } from "../../server/trpc/routers/canvas/canvasModels";
import { useSubmissionsQuery } from "./graderHooks";
import { userName } from "./userUtils";
import { describeTimeDifference } from "../../utils/timeUtils";
import { getSubmissionStatusChips } from "./submission/submissionUtils";
import { useViewingItem } from "./shared/viewingItemContext/ViewingItemContext";
import { useCurrentAssignment } from "../../components/contexts/AssignmentProvider";

export const SubmissionsList: FC<{
  selectedId: number | undefined;
  onSelect: (s: CanvasSubmission) => void;
}> = ({ selectedId, onSelect }) => {
  const { assignmentId, assignmentName, assignment } = useCurrentAssignment();

  const { setViewingFile } = useViewingItem();
  const { data: submissions } = useSubmissionsQuery({
    assignmentId,
    assignmentName,
  });
  if (!submissions?.length) {
    return (
      <>
        <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">
          {submissions?.length ?? 0} submissions
        </div>
        <div className="text-sm text-gray-400 border border-dashed border-gray-700 rounded p-6">
          No submissions found.
        </div>
      </>
    );
  }

  return (
    <div className="h-full flex flex-col ">
      <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">
        {submissions?.length ?? 0} submissions
      </div>
      <div className="space-y-2 flex-1 overflow-y-auto">
        {submissions.map((s) => {
          const name = userName(s);
          const isActive = selectedId === s.id;
          const submittedAt = s.submitted_at ? new Date(s.submitted_at) : null;
          const statusChips = getSubmissionStatusChips(s);
          const gradeDisplay =
            s.grade ?? (s.score != null ? `${s.score}` : null);

          // Calculate time difference from due date
          const timingInfo = (() => {
            if (!submittedAt) return "Not submitted";
            if (!assignment?.due_at)
              return `Submitted ${submittedAt.toLocaleString()}`;

            const timeDiff = describeTimeDifference(
              s.submitted_at!,
              assignment.due_at
            );
            return timeDiff;
          })();

          return (
            <div
              key={s.id}
              className={`group cursor-pointer rounded-md border transition-colors ${
                isActive
                  ? "border-indigo-500/60 bg-gray-800/80 ring-2 ring-indigo-500/30"
                  : "border-gray-700 bg-gray-800 hover:bg-gray-800/70"
              }`}
              onClick={() => {
                setViewingFile("submission.md");
                onSelect(s);
              }}
              role="button"
              aria-selected={isActive}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setViewingFile("submission.md");
                  onSelect(s);
                }
              }}
            >
              <div className="p-3 flex items-start gap-3">
                {/* Content */}
                <div className="min-w-0 flex-1">
                  {/* Top row: name + chips + grade */}
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <span
                          className="truncate font-medium text-gray-100"
                          title={name}
                        >
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
                  <div className="mt-1 flex flex-wrap justify-between gap-x-3 gap-y-1 text-[11px] text-gray-400">
                    <span>{timingInfo}</span>
                    {typeof s.attempt === "number" && (
                      <span className="inline-flex items-center gap-1">
                        <span className="  rounded-full bg-gray-600" />
                        {s.attempt} {s.attempt === 1 ? "Attempt" : "Attempts"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
