import type { FC } from "react";

type RubricRating = {
  id: string;
  description?: string;
  long_description?: string;
  points: number;
};

export const CriterionPointInput: FC<{
  maxPoints: number;
  currentPoints?: number;
  selectedRating?: RubricRating | null;
  ratings: RubricRating[];
  onPointsChange: (points: number) => void;
  onRatingSelect: (ratingId: string, points: number) => void;
}> = ({
  maxPoints,
  currentPoints,
  selectedRating,
  ratings,
  onPointsChange,
  onRatingSelect,
}) => {
  return (
    <>
      {/* Rating Options */}
      <div className=" flex justify-between">
        <div className="flex flex-wrap gap-2">
          {ratings
            .sort((a, b) => a.points - b.points)
            .map((rating) => {
              const isSelected = selectedRating?.id === rating.id;
              return (
                <button
                  key={rating.id}
                  onClick={() => onRatingSelect(rating.id, rating.points)}
                  className={`
                    unstyled cursor-pointer
                    px-3 rounded border-1 transition-all
                    ${
                      isSelected
                        ? "bg-blue-950 border-blue-700 text-white"
                        : "border-gray-600 text-gray-300 hover:bg-gray-600 hover:border-gray-500"
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
          <div className="flex flex-col">
            <label className="text-xs text-gray-400 pb-1 ">
              Other
            </label>
            <input
              type="number"
              min={0}
              max={maxPoints}
              step={0.5}
              value={currentPoints ?? ""}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                if (!isNaN(value)) {
                  onPointsChange(value);
                }
              }}
              placeholder="0"
              className="w-20 px-2 py-1 text-xs border border-gray-600 rounded text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
      </div>
    </>
  );
};
