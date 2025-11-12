import type z from "zod";
import { getAiCompletion } from "./getAiCompletion";
import type { ConversationMessage } from "../../server/trpc/routers/rubricAI/rubricAiReportModels";
import { parseSchema } from "../../server/trpc/routers/parseSchema";

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
export async function runToolCallingLoop<T>(
  params: {
    messages: ConversationMessage[];
    tools?: AiTool[];
    responseFormat: z.ZodType<T>;
    model?: string;
    temperature?: number;
    tool_choice?:
      | "auto"
      | "required"
      | { type: "function"; function: { name: string } };
  },
  {
    maxIterations = 10,
    currentItteration = 0,
  }: {
    maxIterations?: number;
    currentItteration?: number;
  } = {}
): Promise<{
  result: T | undefined;
  messages: ConversationMessage[];
}> {
  console.log(`Tool calling loop iteration ${currentItteration + 1}`);
  if (currentItteration >= maxIterations) {
    console.error(
      `Tool calling loop reached max iterations (${maxIterations})`
    );
    return {
      messages: params.messages,
      result: undefined,
    };
  }

  const completion = await getAiCompletion(params);

  const doneWithLoop =
    !completion.tool_calls || completion.tool_calls.length === 0;

  if (doneWithLoop) {
    const contentStr =
      typeof completion.content === "string" ? completion.content : undefined;
    if (!contentStr)
      throw new Error("Completion content is not a string, it should be json");

    if (!params.responseFormat) {
      return {
        messages: [...params.messages, completion],
        result: undefined,
      };
    }

    return {
      messages: [...params.messages, completion],
      result: parseSchema(
        params.responseFormat,
        JSON.parse(contentStr),
        "Tool Calling Loop Result"
      ),
    };
  }

  const toolResults = await Promise.all(
    (completion.tool_calls ?? []).map((toolCall) =>
      runTool(toolCall, params.tools)
    )
  );

  const result = await runToolCallingLoop(
    {
      ...params,
      messages: [...params.messages, completion, ...toolResults],
    },
    {
      maxIterations,
      currentItteration: currentItteration + 1,
    }
  );
  return result;
}

export async function runTool(
  toolCall: {
    id?: string;
    type?: string;
    function?: { name: string; arguments?: string };
  },
  tools?: AiTool[]
) {
  const toolCallId = toolCall.id || "unknown";
  const toolName = toolCall.function?.name;
  const toolArgs = toolCall.function?.arguments;

  if (!toolName) {
    console.error("Tool call missing function name");
    return {
      role: "tool" as const,
      tool_call_id: toolCallId,
      content: "Error: Tool call missing function name",
    };
  }

  const tool = tools?.find((t) => t.name === toolName);

  if (!tool) {
    console.error(`Tool not found: ${toolName}`);
    return {
      role: "tool" as const,
      tool_call_id: toolCallId,
      content: `Error: Tool '${toolName}' not found`,
    };
  }

  console.log(`Executing tool: ${toolName}`);
  const toolResult = await tool.fn(toolArgs || "{}");

  return {
    role: "tool" as const,
    tool_call_id: toolCallId,
    content: toolResult,
  };
}
