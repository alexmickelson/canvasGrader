import type { CanvasSubmission } from "../../../server/trpc/routers/canvas/canvasModels";

export interface StatusChip {
  label: string;
  className: string;
}

/**
 * Generate status chips for a Canvas submission based on its state
 */
export function getSubmissionStatusChips(
  submission: CanvasSubmission
): StatusChip[] {
  const chips: StatusChip[] = [];

  if (submission.workflow_state) {
    chips.push({
      label: submission.workflow_state,
      className: "bg-indigo-500/10 text-indigo-300 ring-1 ring-indigo-400/20",
    });
  }

  if (submission.late) {
    chips.push({
      label: "Late",
      className: "bg-rose-500/15 text-rose-400 ring-1 ring-rose-400/30",
    });
  }

  if (submission.missing) {
    chips.push({
      label: "Missing",
      className: "bg-amber-500/15 text-amber-400 ring-1 ring-amber-400/30",
    });
  }

  if (submission.excused) {
    chips.push({
      label: "Excused",
      className:
        "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-400/30",
    });
  }

  if (submission.late_policy_status) {
    chips.push({
      label: submission.late_policy_status,
      className:
        "bg-fuchsia-500/10 text-fuchsia-300 ring-1 ring-fuchsia-400/20",
    });
  }

  if (submission.assignment_visible === false) {
    chips.push({
      label: "Hidden",
      className: "bg-gray-700 text-gray-200 ring-1 ring-gray-500/40",
    });
  }

  if (submission.grade_matches_current_submission === false) {
    chips.push({
      label: "Resubmitted since graded",
      className: "bg-blue-500/10 text-blue-300 ring-1 ring-blue-400/20",
    });
  }

  return chips;
}
