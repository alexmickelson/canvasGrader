import type { FC } from "react";
import type { CanvasSubmission } from "../../../server/trpc/routers/canvas/canvasRouter";
import { SubmissionGradingInfo } from "./SubmissionGradingInfo";
import { getSubmissionStatusChips, type StatusChip } from "./submissionUtils";

interface SubmissionHeaderProps {
  submission: CanvasSubmission;
}

export const SubmissionMetadata: FC<SubmissionHeaderProps> = ({
  submission,
}) => {
  const chips = getSubmissionStatusChips(submission);

  return (
    <div className="flex flex-col gap-4 p-3 bg-slate-950 rounded">
      {/* Submission Type */}
      <div>
        {submission.submission_type && (
          <span className="inline-flex items-center gap-1 text-xs text-gray-400">
            {submission.submission_type}
          </span>
        )}
      </div>

      {/* Status Chips */}
      <div>
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {chips.map((c: StatusChip, i: number) => (
              <span
                key={i}
                className={`px-1.5 py-0.5 text-[10px] rounded-full ring-1 ${c.className}`}
              >
                {c.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Grading Info */}
      <div>
        <SubmissionGradingInfo submission={submission} />
      </div>
    </div>
  );
};
