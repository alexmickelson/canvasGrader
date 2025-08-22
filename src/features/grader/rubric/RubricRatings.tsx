import type { FC } from "react";

type RubricRating = {
  id: string;
  description?: string;
  long_description?: string;
  points: number;
};

export const RubricRatings: FC<{
  rating: RubricRating;
  selectedRating?: RubricRating | null;
}> = ({ rating, selectedRating }) => {
  const isSelected = selectedRating?.id === rating.id;
  return (
    <div
      className={` flex-1 flex items-center justify-between ps-2 rounded ${
        isSelected
          ? "bg-green-500/20 border border-green-500/40"
          : "bg-gray-800/30"
      }`}
    >
      <div className="flex-1">
        <div
          className={`font-medium ${
            isSelected ? "text-green-200" : "text-gray-200"
          }`}
        >
          {isSelected && "✓ "}
          {rating.description || `Rating ${rating.id}`}
        </div>
        {rating.long_description && (
          <div className="mt-1 text-sm text-gray-400">
            {rating.long_description}
          </div>
        )}
      </div>
      <div
        className={`ml-4 text-sm font-medium px-2 py-1 rounded-r ${
          isSelected
            ? "text-green-100 bg-green-700"
            : "text-gray-100 bg-gray-700"
        }`}
      >
        {rating.points} pts
      </div>
    </div>
  );
};
