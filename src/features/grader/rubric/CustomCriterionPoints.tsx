import type { FC } from "react";

export const CustomCriterionPoints: FC<{
  customPoints: number | undefined;
  criterionPoints: number;
  onCustomPointsChange: (points: number) => void;
  onPointsClear: () => void;
}> = ({
  customPoints,
  criterionPoints,
  onCustomPointsChange,
  onPointsClear,
}) => {
  return (
    <div className="min-w-24 ps-2">
      <label className="block text-xs font-medium text-gray-300 mb-1">
        Custom Points
      </label>
      <div className="flex items-center space-x-2">
        <input
          type="number"
          min="0"
          max={criterionPoints}
          step="0.25"
          value={customPoints ?? ""}
          onChange={(e) => {
            const value = e.target.value;
            if (value === "") {
              onPointsClear();
            } else {
              const points = parseFloat(value);
              if (!isNaN(points)) {
                onCustomPointsChange(points);
              }
            }
          }}
          className="w-16 px-1 py-1 border border-gray-600 rounded text-xs text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="0"
        />
        <span className="text-xs text-gray-400">/ {criterionPoints}</span>
      </div>
    </div>
  );
};
