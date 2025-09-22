import { useState, type FC } from "react";
import { useSubmitCommentMutation } from "../gradeSubmissionHooks";
import Spinner from "../../../utils/Spinner";

export const SubmissionCommentForm: FC<{
  courseId: number;
  assignmentId: number;
  userId: number;
}> = ({ courseId, assignmentId, userId }) => {
  const [comment, setComment] = useState("");
  const submitCommentMutation = useSubmitCommentMutation();

  const handleSubmitComment = () => {
    if (!comment.trim()) return;

    submitCommentMutation.mutate({
      courseId,
      assignmentId,
      userId,
      comment: comment.trim(),
    });

    setComment("");
  };

  return (
    <div className="mt-4 p-2  ">
      <label className="block text-sm font-medium text-gray-300 mb-2">
        New Comment
      </label>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Add a comment about this submission..."
        rows={3}
        className="w-full px-3 py-2 border border-gray-600 rounded-md text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-900"
      />
      <div className="mt-2 flex justify-end">
        <button
          onClick={handleSubmitComment}
          disabled={!comment.trim() || submitCommentMutation.isPending}
        >
          {submitCommentMutation.isPending ? (
            <>
              <Spinner size="sm" />
              Submitting...
            </>
          ) : (
            "Submit Comment"
          )}
        </button>
      </div>
    </div>
  );
};
