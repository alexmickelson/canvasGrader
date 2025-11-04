import type z from "../../../../node_modules/zod/v3/external.d.cts";

// Utility: safely parse with Zod, log on error
export function parseSchema<T extends z.ZodTypeAny>(
  schema: T,
  obj: unknown,
  context: string = ""
): z.infer<T> {
  try {
    return schema.parse(obj);
  } catch (err) {
    console.error(`Failed to parse object${context ? ` (${context})` : ""}:`);
    console.error(obj);
    throw err;
  }
}
