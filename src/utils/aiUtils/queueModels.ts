import { z } from "zod";

export const QueueJobSchema = z.object({
  id: z.string(),
});

export const QueueStatusSchema = z.object({
  queueSize: z.number().int().min(0),
  runningSize: z.number().int().min(0),
  maxConcurrent: z.number().int().min(1),
  queuedJobs: z.array(QueueJobSchema),
});

export type QueueJob = z.infer<typeof QueueJobSchema>;
export type QueueStatus = z.infer<typeof QueueStatusSchema>;
