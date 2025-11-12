import type z from "zod";
import { getAiCompletion } from "./getAiCompletion";
import type { ConversationMessage } from "../../server/trpc/routers/rubricAI/rubricAiReportModels";

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

export async function runToolCallingLoop(
  params: Parameters<typeof getAiCompletion>[0],
  {
    maxIterations = 10,
    currentItteration = 0,
  }: { maxIterations?: number; currentItteration?: number } = {}
): Promise<ConversationMessage[] | null> {
  const { messages, tools, responseFormat, model, temperature, tool_choice } =
    params;

  if (currentItteration >= maxIterations) {
    console.warn(`Tool calling loop reached max iterations (${maxIterations})`);
    return messages;
  }

  console.log(`Tool calling loop iteration ${currentItteration + 1}`);

  const completion = await getAiCompletion({
    messages,
    tools,
    responseFormat,
    model,
    temperature,
    tool_choice,
  });

  const noToolCalls =
    !completion.tool_calls || completion.tool_calls.length === 0;
  if (noToolCalls) {
    console.log("No more tool calls, ending loop");
    return [...messages, completion];
  }

  const toolCalls = completion.tool_calls ?? [];
  const toolResults = await Promise.all(
    toolCalls.map((toolCall) => runTool(toolCall, tools))
  );

  console.log("tool results", toolResults);

  if (toolResults.some((tr) => tr.exitLoop)) {
    console.log("Exit loop signal received from tool, ending loop");

    const toolCallsWithoutExit = toolResults.map((tr) => {
      if (tr.exitLoop) {
        return {
          role: tr.role,
          tool_call_id: tr.tool_call_id,
          content: tr.content,
        };
      }
      return tr;
    });
    return [...messages, completion, ...toolCallsWithoutExit];
  }

  return runToolCallingLoop(
    {
      messages: [...messages, completion, ...toolResults],
      tools,
      responseFormat,
      model,
      temperature,
      tool_choice,
    },
    { maxIterations, currentItteration: currentItteration + 1 }
  );
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

  if (isExitMessage(toolResult))
    return {
      role: "tool" as const,
      tool_call_id: toolCallId,
      content: toolResult,
      exitLoop: true,
    };

  return {
    role: "tool" as const,
    tool_call_id: toolCallId,
    content: toolResult,
  };
}

export function isExitMessage(content: string | undefined | null) {
  if (!content || typeof content !== "string") return false;
  try {
    const parsed = JSON.parse(content);
    return !!parsed.exitLoop;
  } catch {
    return false;
  }
}
