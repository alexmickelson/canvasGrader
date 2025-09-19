import type { ConversationMessage } from "../../server/trpc/routers/rubricAI/rubricAiReportModels";
import { EventEmitter } from "events";
import { QueueStatusSchema } from "./queueModels";
import { parseSchema } from "../../server/trpc/routers/parseSchema";

const MAX_CONCURRENT = 2;

export interface QueueJob {
  id: string;
  execute: () => Promise<ConversationMessage>;
  resolve: (value: ConversationMessage) => void;
  reject: (error: unknown) => void;
}

const queue: QueueJob[] = [];
const running = new Set<Promise<void>>();

// EventEmitter for subscription updates
const queueEventEmitter = new EventEmitter();

// Track last logged state to avoid duplicate logs
let lastLoggedState = { queueSize: 0, runningSize: 0 };

function logQueueStateIfChanged(): void {
  const currentState = { queueSize: queue.length, runningSize: running.size };

  if (
    currentState.queueSize !== lastLoggedState.queueSize ||
    currentState.runningSize !== lastLoggedState.runningSize
  ) {
    console.log(
      `[Queue] State: Queue size: ${currentState.queueSize}, Running: ${currentState.runningSize}/${MAX_CONCURRENT}`
    );
    lastLoggedState = currentState;

    const queueStatus = parseSchema(
      QueueStatusSchema,
      {
        queueSize: queue.length,
        runningSize: running.size,
        maxConcurrent: MAX_CONCURRENT,
        queuedJobs: queue.map((job) => ({ id: job.id })),
      },
      "QueueStatusSchema"
    );
    queueEventEmitter.emit("statusUpdate", queueStatus);
  }
}

export function enqueueJob(job: QueueJob): void {
  queue.push(job);
  logQueueStateIfChanged();
  processQueue();
}

export function getQueueEventEmitter() {
  return queueEventEmitter;
}

async function processQueue(): Promise<void> {
  while (queue.length > 0 && running.size < MAX_CONCURRENT) {
    const job = queue.shift()!;
    const runningPromise = executeJob(job);
    running.add(runningPromise);
    logQueueStateIfChanged();

    runningPromise.finally(() => {
      running.delete(runningPromise);
      logQueueStateIfChanged();
      processQueue();
    });
  }
}

async function executeJob(job: QueueJob): Promise<void> {
  try {
    const startTime = Date.now();
    const result = await job.execute();
    const duration = Date.now() - startTime;
    console.log(`[Queue] Job ${job.id} completed in ${duration}ms`);
    job.resolve(result);
  } catch (error) {
    console.log(`[Queue] Job ${job.id} failed:`, error);
    job.reject(error);
  }
}
