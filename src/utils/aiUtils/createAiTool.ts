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
        let parsedJson;
        try {
          parsedJson = JSON.parse(params);
        } catch (error) {
          console.error("Failed to parse tool parameters as JSON:", {
            toolName: name,
            error: error,
            params: params.substring(0, 500),
          });
          return `Error: Failed to parse parameters as JSON: ${error}. Params: ${params.substring(
            0,
            200
          )}...`;
        }

        let parsedParams;
        try {
          parsedParams = paramsSchema.parse(parsedJson);
        } catch (error) {
          console.error("Tool parameter schema validation failed:", {
            toolName: name,
            error: error,
            parsedJson: JSON.stringify(parsedJson, null, 2),
          });
          return `Error: Parameter validation failed: ${error}. Parsed JSON: ${JSON.stringify(
            parsedJson,
            null,
            2
          )}`;
        }

        const result = await fn(parsedParams);
        if (typeof result === "string") return result;
        else return JSON.stringify(result);
      } catch (error) {
        console.error("Error running tool:", {
          toolName: name,
          error: error,
          params: params.substring(0, 500),
        });
        return `Error: ${
          typeof error === "object" && error && "message" in error
            ? (error as { message: string }).message
            : String(error)
        }`;
      }
    },
  };
}
