import type { FC } from "react";
import type { CanvasSubmissionComment } from "../../server/trpc/routers/canvasRouter";

interface SubmissionCommentsProps {
  comments: CanvasSubmissionComment[];
}

export const SubmissionComments: FC<SubmissionCommentsProps> = ({
  comments,
}) => {
  if (!comments || comments.length === 0) {
    return null;
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    });

  return (
    <section className="space-y-3">
      <div className="text-xs uppercase tracking-wide text-gray-400">
        Comments ({comments.length})
      </div>
      <div className="space-y-3">
        {comments.map((comment) => (
          <div
            key={comment.id}
            className="rounded border border-gray-700 bg-gray-800/30 p-3"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-200">
                {comment.author_name || `User #${comment.author_id}`}
              </span>
              <span className="text-xs text-gray-500">
                {fmt(comment.created_at)}
                {comment.edited_at &&
                  comment.edited_at !== comment.created_at && (
                    <span className="ml-1">(edited)</span>
                  )}
              </span>
            </div>
            <div className="text-sm text-gray-300 whitespace-pre-wrap">
              {comment.comment}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
