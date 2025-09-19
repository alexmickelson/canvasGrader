import type { FC } from "react";

type RubricRating = {
  id: string;
  description?: string;
  long_description?: string;
  points: number;
};

export const CriterionPointInput: FC<{
  selectedRating?: RubricRating | null;
  ratings: RubricRating[];
  onRatingSelect: (ratingId: string, points: number) => void;
}> = ({ selectedRating, ratings, onRatingSelect }) => {
  return (
    <div className="flex gap-2">
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
                py-2 px-3 rounded border-1 transition-all flex-1
                ${
                  isSelected
                    ? "bg-blue-950 border-blue-700 text-white"
                    : "border-gray-600 text-gray-300 hover:bg-gray-800 hover:border-gray-500"
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
  );
};
