import type { FC } from "react";
import type {
  CanvasRubric,
  CanvasRubricCriterion,
} from "../../server/trpc/routers/canvasRouter";

interface RubricDisplayProps {
  rubric: CanvasRubric;
}

const RubricCriterion: FC<{ criterion: CanvasRubricCriterion }> = ({
  criterion,
}) => {
  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      {/* Criterion Header */}
      <div className="bg-gray-800/50 px-4 py-3 border-b border-gray-700">
        <h4 className="font-medium text-gray-100">
          {criterion.description || `Criterion ${criterion.id}`}
        </h4>
        {criterion.long_description && (
          <p className="mt-1 text-sm text-gray-400">
            {criterion.long_description}
          </p>
        )}
        <div className="mt-2 text-xs text-gray-500">
          Max Points: {criterion.points}
        </div>
      </div>

      {/* Ratings */}
      <div className="p-4">
        <div className="grid gap-2">
          {criterion.ratings.map((rating) => (
            <div
              key={rating.id}
              className="flex items-center justify-between p-3 bg-gray-800/30 rounded-md"
            >
              <div className="flex-1">
                <div className="font-medium text-gray-200">
                  {rating.description || `Rating ${rating.id}`}
                </div>
                {rating.long_description && (
                  <div className="mt-1 text-sm text-gray-400">
                    {rating.long_description}
                  </div>
                )}
              </div>
              <div className="ml-4 text-sm font-medium text-gray-100 bg-gray-700 px-2 py-1 rounded">
                {rating.points} pts
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const RubricDisplay: FC<RubricDisplayProps> = ({ rubric }) => {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-400">
            Rubric
          </div>
          <h3 className="font-semibold text-gray-100">{rubric.title}</h3>
        </div>
        <div className="text-sm text-gray-400">
          Total: {rubric.points_possible} points
        </div>
      </div>

      <div className="space-y-4">
        {rubric.data.map((criterion) => (
          <RubricCriterion key={criterion.id} criterion={criterion} />
        ))}
      </div>

      {rubric.free_form_criterion_comments && (
        <div className="text-xs text-gray-500 italic">
          This rubric allows free-form comments
        </div>
      )}
    </section>
  );
};
