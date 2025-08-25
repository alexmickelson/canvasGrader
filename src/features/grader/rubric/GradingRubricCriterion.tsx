import type { FC } from "react";
import { useState } from "react";
import type { CanvasRubricCriterion } from "../../../server/trpc/routers/canvasRouter";
import { AICriterionAnalysis } from "./AICriterionAnalysis";

interface GradingRubricCriterionProps {
  criterion: CanvasRubricCriterion;
  assessment?: {
    rating_id?: string;
    points?: number;
    comments?: string;
  };
  onChange: (assessment: {
    rating_id?: string;
    points?: number;
    comments?: string;
  }) => void;
  courseId: number;
  assignmentId: number;
  studentName: string;
}

export const GradingRubricCriterion: FC<GradingRubricCriterionProps> = ({
  criterion,
  assessment,
  onChange,
  courseId,
  assignmentId,
  studentName,
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

      {/* Custom Points Input */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400">Custom Points:</label>
          <input
            type="number"
            min={0}
            max={criterion.points}
            step={0.5}
            value={assessment?.rating_id ? "" : assessment?.points ?? ""}
            onChange={(e) => {
              const value = parseFloat(e.target.value);
              if (!isNaN(value)) {
                handleCustomPointsChange(value);
              }
            }}
            placeholder="0"
            className="w-20 px-2 py-1 text-xs bg-gray-800 border border-gray-600 rounded text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <span className="text-xs text-gray-400">
            / {criterion.points} pts
          </span>
        </div>
      </div>

      {/* Rating Options */}
      <div className="ps-3 pt-1 pb-2">
        <div className="flex flex-wrap gap-2">
          {criterion.ratings
            .sort((a, b) => a.points - b.points)
            .map((rating) => {
              const isSelected = selectedRating?.id === rating.id;
              return (
                <button
                  key={rating.id}
                  onClick={() => handleRatingSelect(rating.id, rating.points)}
                  className={`
                    unstyled
                    px-3 py-2 rounded-md text-sm font-medium border-2 transition-all
                    ${
                      isSelected
                        ? "bg-blue-900 border-blue-700 text-white"
                        : "bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-600 hover:border-gray-500"
                    }
                  `}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{rating.points}</span>
                    {rating.description && (
                      <span className="text-xs opacity-80">
                        {rating.description}
                      </span>
                    )}
                  </div>
                  {rating.long_description && (
                    <div className="text-xs opacity-70 mt-1 max-w-32 truncate">
                      {rating.long_description}
                    </div>
                  )}
                </button>
              );
            })}
        </div>
      </div>

      {/* Comments */}
      <div className="px-3 pb-2">
        <label className="block text-xs text-gray-400 mb-1">Comments:</label>
        <textarea
          value={localComments}
          onChange={(e) => handleCommentsChange(e.target.value)}
          placeholder="Add comments about this criterion..."
          rows={2}
          className="w-full px-2 py-1 text-xs bg-gray-900 border border-gray-600 rounded text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
      <div className="px-3 pb-2">
        {!showAiAnalysis ? (
          <button
            onClick={() => setShowAiAnalysis(true)}
            className="w-full px-3 py-2 bg-purple-800 hover:bg-purple-700 text-purple-200 text-sm font-medium rounded transition-colors"
          >
            🤖 Get AI Analysis
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
            />
          </div>
        )}
      </div>
    </div>
  );
};
