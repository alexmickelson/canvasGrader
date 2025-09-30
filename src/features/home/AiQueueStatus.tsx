import type { FC } from "react";
import { useAiQueueStatusSubscription } from "../../utils/aiUtils/aiQueueHooks";
import Spinner from "../../utils/Spinner";

export const AiQueueStatus: FC = () => {
  const { data: queueStatus, status, error } = useAiQueueStatusSubscription();

  if (status === "connecting") return <Spinner />;
  if (error) return <div>Error loading queue status: {error}</div>;
  if (!queueStatus) return <div>Waiting for queue data...</div>;

  const { queueSize, runningSize, queuedJobs } = queueStatus;
  const isIdle = queueSize === 0 && runningSize === 0;

  return (
    <div className="border rounded-md border-slate-700 px-2 py-1">
      <div className="flex justify-between items-center gap-4 text-sm ">
        <span className="text-xs">AI Queue</span>
        {runningSize > 0 && (
          <span className="">
            {runningSize}/{queuedJobs.length + runningSize} in progress
          </span>
        )}

        <span
          className={`px-2 py-1 rounded text-xs font-medium ${
            isIdle
              ? "bg-gray-600/20 text-gray-400 border border-gray-600/30"
              : "bg-green-800/20 text-green-400 border border-green-600/30"
          }`}
        >
          {isIdle ? "Idle" : "Active"}
        </span>
      </div>
    </div>
  );
};
