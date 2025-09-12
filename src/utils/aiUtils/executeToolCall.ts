import type { AiTool } from "./createAiTool";

// Generic domain model for tool calls
export interface GenericToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
}

// Generic domain model for tool message response
export interface GenericToolMessage {
  role: "tool";
  tool_call_id: string;
  content: string;
}

// Helper function to execute a single tool call and return the tool message
export async function executeToolCall(
  toolCall: GenericToolCall,
  tools: AiTool[]
): Promise<GenericToolMessage> {
  if (toolCall.type === "function") {
    console.log(`  Tool call: ${toolCall.function.name}`);
    console.log(`  Parameters: ${toolCall.function.arguments}`);

    // Find the matching tool by name
    const tool = tools.find((t) => t.name === toolCall.function.name);

    if (!tool) {
      throw new Error(
        `Tool '${toolCall.function.name}' not found in available tools`
      );
    }

    // Execute the tool function
    const result = await tool.fn(toolCall.function.arguments);

    console.log(`  Result length: ${result.length} characters`);

    return {
      role: "tool",
      tool_call_id: toolCall.id,
      content: result,
    };
  }

  throw new Error(`Unsupported tool call type: ${toolCall.type}`);
}
