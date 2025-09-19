import { useTRPCClient } from "../../server/trpc/trpcClient";
import { useEffect, useState, useRef } from "react";
import { QueueStatusSchema, type QueueStatus } from "./queueModels";
import { parseSchema } from "../../server/trpc/routers/parseSchema";

export const useAiQueueStatusSubscription = () => {
  const trpcClient = useTRPCClient();
  const [data, setData] = useState<QueueStatus>({
    queueSize: 0,
    runningSize: 0,
    maxConcurrent: 0,
    queuedJobs: [],
  });
  const [status, setStatus] = useState<
    "idle" | "connecting" | "connected" | "error"
  >("connecting");
  const [error, setError] = useState<string | null>(null);
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);

  useEffect(() => {
    setStatus("connecting");

    const subscription = trpcClient.aiQueue.onStatusUpdate.subscribe(
      undefined,
      {
        onStarted: () => {
          setStatus("connected");
          setError(null);
        },
        onData: (trackedData) => {
          // TrackedData contains [id, data] - we want just the data

          try {
            // Validate the received data with Zod
            const validatedStatus = parseSchema(
              QueueStatusSchema,
              trackedData.data,
              "QueueStatusSchema"
            );
            setData(validatedStatus);
            setStatus("connected");
          } catch (validationError) {
            console.error("Queue status validation error:", validationError);
            console.error("Received data:", trackedData.data);
            setError("Invalid queue status data received");
            setStatus("error");
          }
        },
        onError: (err) => {
          console.error("Queue subscription error:", err);
          setError(err.message || "Subscription error");
          setStatus("error");
        },
        onStopped: () => {
          setStatus("idle");
        },
      }
    );

    subscriptionRef.current = subscription;

    return () => {
      subscription.unsubscribe();
    };
  }, [trpcClient]);

  return { data, status, error };
};
