import type { FC } from "react";
import type { CanvasSubmission } from "../../server/trpc/routers/canvasRouter";

interface SubmissionGradingInfoProps {
  submission: CanvasSubmission;
}

export const SubmissionGradingInfo: FC<SubmissionGradingInfoProps> = ({
  submission,
}) => {
  const fmt = (
    iso?: string | null,
    options: Intl.DateTimeFormatOptions = {
      dateStyle: "short",
      timeStyle: "short",
    }
  ) => (iso ? new Date(iso).toLocaleString(undefined, options) : null);

  const formatSeconds = (s?: number) => {
    if (!s || s <= 0) return null;
    const totalMinutes = Math.floor(s / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) return `${hours}h${minutes ? ` ${minutes}m` : ""}`;
    return `${totalMinutes}m`;
  };

  // Build natural sentences about the submission
  const submissionParts = [];
  const gradingParts = [];
  const attemptParts = [];

  // Submission timing
  if (submission.submitted_at) {
    submissionParts.push(`Submitted ${fmt(submission.submitted_at)}`);
  }
  if (submission.seconds_late) {
    const lateBy = formatSeconds(submission.seconds_late);
    if (lateBy) submissionParts.push(`${lateBy} late`);
  }

  // Grading info
  if (submission.grade || submission.score != null) {
    if (submission.grade && submission.score != null) {
      gradingParts.push(`Grade: ${submission.grade} (${submission.score} pts)`);
    } else if (submission.grade) {
      gradingParts.push(`Grade: ${submission.grade}`);
    } else if (submission.score != null) {
      gradingParts.push(`Score: ${submission.score} points`);
    }
  }

  if (submission.points_deducted != null && submission.points_deducted > 0) {
    gradingParts.push(`${submission.points_deducted} points deducted`);
  }

  if (submission.graded_at || submission.grader_id != null) {
    let gradedInfo = "Graded";
    if (submission.graded_at) {
      gradedInfo += ` ${fmt(submission.graded_at)}`;
    }
    if (submission.grader_id != null) {
      gradedInfo += ` by grader #${submission.grader_id}`;
    }
    gradingParts.push(gradedInfo);
  }

  // Attempt info
  if (submission.attempt != null) {
    let attemptInfo = `Attempt #${submission.attempt}`;
    if (submission.extra_attempts != null && submission.extra_attempts > 0) {
      attemptInfo += ` (${submission.extra_attempts} extra attempts allowed)`;
    }
    attemptParts.push(attemptInfo);
  }

  // Combine into compact display
  const allParts = [
    ...submissionParts,
    ...gradingParts,
    ...attemptParts,
  ].filter(Boolean);

  if (allParts.length === 0) return null;

  return (
    <div className="text-sm text-gray-300 space-y-1">
      {allParts.map((part, index) => (
        <div key={index} className="flex items-center gap-2">
          <span className="h-1 w-1 rounded-full bg-gray-600 flex-shrink-0" />
          <span>{part}</span>
        </div>
      ))}
    </div>
  );
};
