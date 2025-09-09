import type { FC } from "react";

export const AnalysisSummary: FC<{
  criterionDescription?: string;
  model?: string;
  confidence?: number;
  recommendedPoints?: number;
  totalPoints?: number;
  description?: string;
  timestamp?: string;
}> = ({
  criterionDescription,
  model,
  confidence,
  recommendedPoints,
  totalPoints,
  description,
  timestamp,
}) => {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h4 className="font-semibold mb-3">Analysis Summary</h4>
      <div className="grid grid-cols-2 gap-4 text-sm">
        {criterionDescription && (
          <div>
            <span className="text-gray-400">Criterion:</span>
            <div className="font-medium">{criterionDescription}</div>
          </div>
        )}
        {model && (
          <div>
            <span className="text-gray-400">Model:</span>
            <div className="font-medium">{model}</div>
          </div>
        )}
        {confidence !== undefined && (
          <div>
            <span className="text-gray-400">Confidence:</span>
            <div className="font-medium">{confidence}%</div>
          </div>
        )}
        {recommendedPoints !== undefined && (
          <div>
            <span className="text-gray-400">Recommended Points:</span>
            <div className="font-medium">
              {recommendedPoints}
              {totalPoints !== undefined && ` / ${totalPoints}`}
            </div>
          </div>
        )}
        {timestamp && (
          <div className="col-span-2">
            <span className="text-gray-400">Timestamp:</span>
            <div className="font-medium">
              {new Date(timestamp).toLocaleString()}
            </div>
          </div>
        )}
      </div>
      {description && (
        <div className="mt-4">
          <span className="text-gray-400">Description:</span>
          <div className="mt-1 text-sm whitespace-pre-wrap">{description}</div>
        </div>
      )}
    </div>
  );
};
