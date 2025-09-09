import type z from "zod";

export interface AiTool {
  name: string;
  description: string;
  paramsSchema: z.ZodTypeAny;
  fn: (params: string) => Promise<string>;
}

export function createAiTool<T>({
  name,
  description,
  paramsSchema,
  fn,
}: {
  name: string;
  description: string;
  paramsSchema: z.ZodType<T>;
  fn: (params: T) => Promise<unknown>;
}): AiTool {
  return {
    name,
    description,
    paramsSchema,
    fn: async (params: string): Promise<string> => {
      try {
        const parsedParams = paramsSchema.parse(JSON.parse(params));
        const result = await fn(parsedParams);
        if (typeof result === "string") return result;
        else return JSON.stringify(result);
      } catch (error) {
        console.error("Error running tool:", error);
        return `Error: ${
          typeof error === "object" && error && "message" in error
            ? (error as { message: string }).message
            : String(error)
        }`;
      }
    },
  };
}
