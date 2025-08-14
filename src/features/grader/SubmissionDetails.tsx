import type { FC } from "react";
import type { CanvasSubmission } from "../../server/trpc/routers/canvasRouter";
import { userName, initials } from "./userUtils";

export const SubmissionDetails: FC<{ submission: CanvasSubmission }> = ({
  submission,
}) => {
  const fmt = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleString() : "—";
  const name = userName(submission);
  const headerStat =
    submission.grade ??
    (submission.score != null ? `${submission.score}` : undefined);

  // Build status chips and derived labels
  const chips: Array<{ label: string; className: string }> = [];
  if (submission.workflow_state)
    chips.push({
      label: submission.workflow_state,
      className: "bg-indigo-500/10 text-indigo-300 ring-1 ring-indigo-400/20",
    });
  if (submission.late)
    chips.push({
      label: "Late",
      className: "bg-rose-500/15 text-rose-400 ring-1 ring-rose-400/30",
    });
  if (submission.missing)
    chips.push({
      label: "Missing",
      className: "bg-amber-500/15 text-amber-400 ring-1 ring-amber-400/30",
    });
  if (submission.excused)
    chips.push({
      label: "Excused",
      className:
        "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-400/30",
    });
  if (submission.late_policy_status)
    chips.push({
      label: submission.late_policy_status,
      className:
        "bg-fuchsia-500/10 text-fuchsia-300 ring-1 ring-fuchsia-400/20",
    });
  if (submission.assignment_visible === false)
    chips.push({
      label: "Hidden",
      className: "bg-gray-700 text-gray-200 ring-1 ring-gray-500/40",
    });
  if (submission.grade_matches_current_submission === false)
    chips.push({
      label: "Resubmitted since graded",
      className: "bg-blue-500/10 text-blue-300 ring-1 ring-blue-400/20",
    });

  const secondsLate = submission.seconds_late ?? undefined;
  const pointsDeducted = submission.points_deducted ?? undefined;
  const formatSeconds = (s?: number) => {
    if (!s || s <= 0) return undefined;
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const mm = m % 60;
    if (h > 0) return `${h}h${mm ? ` ${mm}m` : ""}`;
    return `${m}m`;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-gray-600 to-gray-700 grid place-items-center text-sm font-semibold text-white">
          {initials(name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h3 className="font-semibold text-gray-100 truncate">{name}</h3>
            {headerStat && (
              <span className="ml-auto inline-flex items-center rounded-md border border-gray-600 bg-gray-900 px-2 py-0.5 text-xs font-semibold text-gray-100">
                {headerStat}
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-gray-400 flex gap-3 flex-wrap">
            <span>Submission #{submission.id}</span>
            <span className="inline-flex items-center gap-1">
              <span className="h-1 w-1 rounded-full bg-gray-600" />
              {submission.workflow_state}
            </span>
          </div>
        </div>
      </div>

      {/* Status chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c, i) => (
            <span
              key={i}
              className={`px-1.5 py-0.5 text-[10px] rounded-full ring-1 ${c.className}`}
            >
              {c.label}
            </span>
          ))}
        </div>
      )}

      {/* Submission info */}
      <div className="space-y-1 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-gray-400">Submitted</span>
          <span className="text-gray-200">{fmt(submission.submitted_at)}</span>
        </div>
        {secondsLate && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-gray-400">Late by</span>
            <span className="text-gray-200">{formatSeconds(secondsLate)}</span>
          </div>
        )}
      </div>

      {/* Grading info */}
      <div className="space-y-1 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-gray-400">Grade</span>
          <span className="text-gray-200">{submission.grade ?? "—"}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-gray-400">Score</span>
          <span className="text-gray-200">{submission.score ?? "—"}</span>
        </div>
        {pointsDeducted != null && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-gray-400">Points deducted</span>
            <span className="text-gray-200">{pointsDeducted}</span>
          </div>
        )}
        {(submission.graded_at || submission.grader_id != null) && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-gray-400">Graded</span>
            <span className="text-gray-200">
              {submission.graded_at ? fmt(submission.graded_at) : "—"}
              {submission.grader_id != null
                ? ` · by #${submission.grader_id}`
                : ""}
            </span>
          </div>
        )}
      </div>

      {/* Attempts */}
      <div className="space-y-1 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-gray-400">Attempt</span>
          <span className="text-gray-200">{submission.attempt ?? "—"}</span>
        </div>
        {submission.extra_attempts != null && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-gray-400">Extra attempts allowed</span>
            <span className="text-gray-200">{submission.extra_attempts}</span>
          </div>
        )}
      </div>

      {/* Content/Links */}
      {(submission.body ||
        submission.url ||
        submission.html_url ||
        submission.preview_url) && (
        <div className="space-y-2">
          {submission.body && (
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-400 mb-1">
                Text entry
              </div>
              <div className="whitespace-pre-wrap rounded border border-gray-700 bg-gray-800 p-2 text-sm text-gray-100">
                {submission.body}
              </div>
            </div>
          )}
          {submission.url && (
            <div className="text-sm">
              <a
                href={submission.url}
                target="_blank"
                rel="noreferrer noopener"
                className="text-indigo-300 hover:text-indigo-200 underline"
              >
                Open submitted URL
              </a>
            </div>
          )}
          {(submission.html_url || submission.preview_url) && (
            <div className="flex gap-2">
              {submission.html_url && (
                <a
                  href={submission.html_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-100 hover:bg-gray-700"
                >
                  Open in Canvas
                </a>
              )}
              {submission.preview_url && (
                <a
                  href={submission.preview_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-100 hover:bg-gray-700"
                >
                  Preview
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
