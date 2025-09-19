import type { FC } from "react";
import { useAiQueueStatusSubscription } from "../../utils/aiUtils/aiQueueHooks";
import Spinner from "../../utils/Spinner";

export const AiQueueStatus: FC = () => {
  const { data: queueStatus, status, error } = useAiQueueStatusSubscription();

  if (status === "connecting") return <Spinner />;
  if (error) return <div>Error loading queue status: {error}</div>;
  if (!queueStatus) return <div>Waiting for queue data...</div>;

  const { queueSize, runningSize, maxConcurrent, queuedJobs } = queueStatus;
  const isIdle = queueSize === 0 && runningSize === 0;

  return (
    <div className="border rounded border-slate-700 p-2">
      <div className="flex justify-between items-center gap-4 text-sm mb-1">
        <span className="text-xs">
          AI Queue{" "}
          {status === "connected" ? "🟢" : status === "error" ? "🔴" : "🟡"}
        </span>
      </div>
      <div className="flex justify-between gap-4 text-sm">
        <div>
          <span className="ml-1 font-medium">{queueSize}</span> Jobs
        </div>

        <div>
          <span className="ml-1 font-medium">
            {runningSize}/{maxConcurrent} Running
          </span>
        </div>

        <span className="ml-1 font-medium">{isIdle ? "Idle" : "Active"}</span>
      </div>

      {queuedJobs.length > 0 && (
        <div className="mt-3">
          <span className="text-xs">
            Queued jobs:{" "}
            {queuedJobs.map((job) => job.id.split("-")[1]).join(", ")}
          </span>
        </div>
      )}
    </div>
  );
};
