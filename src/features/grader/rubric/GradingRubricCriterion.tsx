import type { FC } from "react";
import { useState } from "react";
import { AICriterionAnalysis } from "./AICriterionAnalysis";
import { CriterionPointInput } from "./CriterionPointInput";
import type { CanvasRubricCriterion } from "../../../server/trpc/routers/canvas/canvasModels";

export const GradingRubricCriterion: FC<{
  criterion: CanvasRubricCriterion;
  assessment?: {
    rating_id?: string;
    points?: number;
    comments?: string;
  };
  courseId: number;
  assignmentId: number;
  studentName: string;
  termName: string;
  courseName: string;
  assignmentName: string;
  onChange: (assessment: {
    rating_id?: string;
    points?: number;
    comments?: string;
  }) => void;
}> = ({
  criterion,
  assessment,
  onChange,
  courseId,
  assignmentId,
  studentName,
  termName,
  courseName,
  assignmentName,
}) => {
  const [localComments, setLocalComments] = useState(
    assessment?.comments || ""
  );
  const [showAiAnalysis, setShowAiAnalysis] = useState(false);

  const selectedRating = assessment?.rating_id
    ? criterion.ratings.find((r) => r.id === assessment.rating_id)
    : null;

  const handleRatingSelect = (ratingId: string, points: number) => {
    onChange({
      ...assessment,
      rating_id: ratingId,
      points: points,
    });
  };

  const handleCommentsChange = (comments: string) => {
    setLocalComments(comments);
    onChange({
      ...assessment,
      comments: comments.trim() || undefined,
    });
  };

  const handleCustomPointsChange = (points: number) => {
    onChange({
      ...assessment,
      rating_id: undefined, // Clear rating when using custom points
      points: points,
    });
  };

  return (
    <div className="overflow-hidden border-b-2 border-slate-800">
      {/* Criterion Header */}
      <div className="px-1 pb-1 flex justify-between">
        <div>
          <div className="font-medium text-gray-300">
            {criterion.description || `Criterion ${criterion.id}`}
          </div>
          {criterion.long_description && (
            <p className="mt-1 text-sm text-gray-400">
              {criterion.long_description}
            </p>
          )}
        </div>
        <div className="text-gray-500">
          <span>
            <span className="font-bold text-green-300">
              {assessment?.points ?? 0}
            </span>
            /
            <span className="font-bold text-slate-200">{criterion.points}</span>{" "}
            pts
          </span>
        </div>
      </div>

      <div className="px-1">
        {/* Custom Points Input and Rating Options */}
        <CriterionPointInput
          maxPoints={criterion.points}
          currentPoints={assessment?.points}
          selectedRating={selectedRating}
          ratings={criterion.ratings}
          onPointsChange={handleCustomPointsChange}
          onRatingSelect={handleRatingSelect}
        />
      </div>

      {/* Comments */}
      <div className="p-1">
        <textarea
          value={localComments}
          onChange={(e) => handleCommentsChange(e.target.value)}
          placeholder="Add comments about this criterion..."
          rows={2}
          className="w-full px-2 py-1 text-xs border border-gray-600 rounded text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Show existing comments if any */}
      {assessment?.comments && (
        <div className="px-3 pb-2 bg-blue-500/10 rounded">
          <div className="text-xs text-blue-300 mb-1">Current Comments:</div>
          <div className="text-xs text-gray-300 whitespace-pre-wrap">
            {assessment.comments}
          </div>
        </div>
      )}

      {/* AI Analysis Section */}
      <div className="px-1 pb-2">
        {!showAiAnalysis ? (
          <button
            onClick={() => setShowAiAnalysis(true)}
            className={
              " unstyled cursor-pointer w-full " +
              "  bg-purple-950 hover:bg-purple-900 text-purple-200 " +
              "  rounded p-1"
            }
          >
            AI Report
          </button>
        ) : (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-medium text-purple-300">
                AI Analysis
              </h4>
              <button
                onClick={() => setShowAiAnalysis(false)}
                className="text-xs text-gray-400 hover:text-gray-300"
              >
                Hide
              </button>
            </div>
            <AICriterionAnalysis
              courseId={courseId}
              assignmentId={assignmentId}
              studentName={studentName}
              criterionDescription={
                criterion.description || `Criterion ${criterion.id}`
              }
              criterionPoints={criterion.points}
              termName={termName}
              courseName={courseName}
              assignmentName={assignmentName}
              criterionId={criterion.id}
            />
          </div>
        )}
      </div>
    </div>
  );
};
