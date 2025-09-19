import { createTRPCRouter, publicProcedure } from "../utils/trpc";
import {
  getQueueEventEmitter,
} from "../../../utils/aiUtils/AiQueue";
import { QueueStatusSchema } from "../../../utils/aiUtils/queueModels";
import { z } from "zod";
import { tracked } from "@trpc/server";
import { on } from "events";
import { parseSchema } from "./parseSchema";

export const aiQueueRouter = createTRPCRouter({

  onStatusUpdate: publicProcedure
    .input(
      z
        .object({
          lastEventId: z.string().nullish(),
        })
        .optional()
    )
    .subscription(async function* (opts) {
      const eventEmitter = getQueueEventEmitter();

      // Listen for status updates
      for await (const [data] of on(eventEmitter, "statusUpdate", {
        signal: opts.signal,
      })) {
        const validatedData = parseSchema(
          QueueStatusSchema,
          data,
          "QueueStatusSchema"
        );
        const eventId = Date.now().toString();
        yield tracked(eventId, validatedData);
      }
    }),
});
