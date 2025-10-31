import type { FC } from "react";
import { useState } from "react";
import { CriterionPointInput } from "./CriterionPointInput";
import { CustomCriterionPoints } from "./CustomCriterionPoints";
import type { CanvasRubricCriterion } from "../../../server/trpc/routers/canvas/canvasModels";
import { RunAnalysisButton } from "./RunAnalysisButton";
import { Expandable } from "../../../utils/Expandable";
import ExpandIcon from "../../../utils/ExpandIcon";

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
  const [customPoints, setCustomPoints] = useState<number | undefined>(
    assessment?.rating_id ? undefined : assessment?.points
  );

  const handleRatingSelect = (ratingId: string | undefined, points: number) => {
    setCustomPoints(points);
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
    setCustomPoints(points);
    onChange({
      ...assessment,
      rating_id: criterion.ratings.find((r) => r.points === points)?.id,
      points: points,
    });
  };

  const handlePointsClear = () => {
    setCustomPoints(undefined);
    onChange({
      ...assessment,
      rating_id: undefined,
      points: undefined,
    });
  };

  return (
    <div className="w-full ">
      <div className="px-1 pb-1 flex justify-between w-full ">
        <div className="font-medium text-gray-300 flex-1 ">
          {criterion.description}
        </div>
        <div className="text-gray-500">
          <span className="font-bold text-green-300 ps-2">
            {assessment?.points ?? 0}
          </span>
          /<span className="font-bold text-slate-200">{criterion.points}</span>{" "}
          pts
        </div>
      </div>

      <Expandable
        ExpandableElement={({ isExpanded, setIsExpanded }) => (
          <div className="flex flex-row justify-between cursor-pointer p-1">
            <div className="px-1 flex-1">
              <CriterionPointInput
                customPoints={customPoints}
                ratings={criterion.ratings}
                onRatingSelect={handleRatingSelect}
                courseId={courseId}
                assignmentId={assignmentId}
                studentName={studentName}
                termName={termName}
                courseName={courseName}
                assignmentName={assignmentName}
                criterionId={criterion.id}
              />
            </div>
            <button
              className="unstyled"
              onClick={() => setIsExpanded((e) => !e)}
            >
              <ExpandIcon
                style={{
                  ...(isExpanded ? { rotate: "-90deg" } : {}),
                }}
              />
            </button>
          </div>
        )}
      >
        <div className="rounded bg-slate-900 my-2 ms-2">
          <div className="p-1 flex">
            <textarea
              value={localComments}
              onChange={(e) => handleCommentsChange(e.target.value)}
              placeholder="Add comments about this criterion..."
              rows={2}
              className="w-full px-2 py-1 text-xs border border-gray-600 rounded text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />

            <CustomCriterionPoints
              customPoints={customPoints}
              criterionPoints={criterion.points}
              onCustomPointsChange={handleCustomPointsChange}
              onPointsClear={handlePointsClear}
            />
          </div>

          {assessment?.comments && (
            <div className="px-3 pb-2 bg-blue-500/10 rounded">
              <div className="text-xs text-blue-300 mb-1">
                Current Comments:
              </div>
              <div className="text-xs text-gray-300 whitespace-pre-wrap">
                {assessment.comments}
              </div>
            </div>
          )}
          <div className="px-1 pb-2">
            <RunAnalysisButton
              courseId={courseId}
              assignmentId={assignmentId}
              studentName={studentName}
              criterionDescription={criterion.description ?? ""}
              criterionPoints={criterion.points}
              termName={termName}
              courseName={courseName}
              assignmentName={assignmentName}
              criterionId={criterion.id}
            />
          </div>
        </div>
      </Expandable>

      {/* Previous Analysis Section */}
      {/* <div className="px-1 ms-8">
        <CriterionPreviousAnalysis
          criterion={criterion}
          assignmentId={assignmentId}
          assignmentName={assignmentName}
          courseName={courseName}
          termName={termName}
          studentName={studentName}
        />
      </div> */}
    </div>
  );
};
