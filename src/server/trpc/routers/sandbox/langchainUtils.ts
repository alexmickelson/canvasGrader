import { ChatOpenAI } from "@langchain/openai";
import {
  StateGraph,
  MessagesAnnotation,
  MemorySaver,
} from "@langchain/langgraph";
import { tool } from "@langchain/core/tools";
import { BaseMessage, ToolNode } from "langchain";
import { aiModel } from "../../../../utils/aiUtils/getOpenaiClient.js";
import type { MessageStructure, MessageType } from "@langchain/core/messages";
import { sshExec } from "./sandboxSshUtils.js";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { z } from "zod";

const aiUrl = process.env.AI_URL;
const aiToken = process.env.AI_TOKEN;

export function shouldContinue({ messages }: typeof MessagesAnnotation.State) {
  console.log("checking if should continue", messages);
  const lastMessage = messages[messages.length - 1];
  // Check if the message has tool calls
  if (
    "tool_calls" in lastMessage &&
    Array.isArray(lastMessage.tool_calls) &&
    lastMessage.tool_calls.length > 0
  ) {
    return "tools";
  }
  return "__end__";
}

let mcpClient: MultiServerMCPClient | null = null;

async function getMcpClient() {
  if (!mcpClient) {
    mcpClient = new MultiServerMCPClient({
      playwright: {
        url: "http://playwright_mcp:3901/mcp",
      },
    });
  }
  return mcpClient;
}

// Format LangChain messages for ChatOpenAI invoke
export function formatMessagesForInvoke(
  messages: BaseMessage<MessageStructure, MessageType>[]
): Array<{ role: string; content: string }> {
  return messages.map((msg) => {
    const msgData = msg as {
      lc?: number;
      type?: string;
      id?: string[];
      kwargs?: {
        content?: string;
        role?: string;
        type?: string;
        name?: string;
        tool_call_id?: string;
        tool_calls?: Array<{ name: string; args: unknown }>;
        additional_kwargs?: {
          tool_calls?: Array<{
            function: { name: string; arguments: string };
          }>;
        };
      };
      role?: string;
      content?: string;
    };

    // Extract content, role, and tool calls
    const content = msgData.kwargs?.content || msgData.content || "";
    const msgType =
      msgData.kwargs?.type || msgData.kwargs?.role || msgData.role;
    const toolCalls =
      msgData.kwargs?.tool_calls ||
      msgData.kwargs?.additional_kwargs?.tool_calls;
    const toolName = msgData.kwargs?.name;

    // Format based on message type
    if (msgType === "tool") {
      return {
        role: "tool" as const,
        content: `[Tool: ${toolName}] ${content}`,
      };
    } else if (toolCalls && toolCalls.length > 0) {
      const toolCallsStr = toolCalls
        .map((tc) => {
          if ("function" in tc) {
            return `${tc.function.name}(${tc.function.arguments})`;
          }
          return `${tc.name}(${JSON.stringify(tc.args)})`;
        })
        .join(", ");
      return {
        role: "assistant" as const,
        content: `[Tool Calls: ${toolCallsStr}]`,
      };
    } else if (msgType === "ai" || msgType === "assistant") {
      return {
        role: "assistant" as const,
        content: content || "[No content]",
      };
    } else if (msgType === "human" || msgType === "user") {
      return {
        role: "user" as const,
        content,
      };
    } else if (msgType === "system") {
      return {
        role: "system" as const,
        content,
      };
    }

    return {
      role: "assistant" as const,
      content: content || "[Unknown message type]",
    };
  });
}

const executeCommandTool = tool(
  async (input) => {
    const { command } = input as { command: string };
    console.log(`Agent executing command: ${command}`);
    const { stdout, stderr } = await sshExec(command);

    if (stderr && stderr.trim()) {
      const message = `Stderr: ${stderr}\nStdout: ${stdout}`;

      console.log(message);
      return message;
    }
    const res = `Output: ${stdout}`;
    console.log(res);
    return res;
  },
  {
    name: "execute_command",
    description:
      "Execute a shell command in the /live_project directory. Use this to run code, install dependencies, check files, etc.",
    schema: z.object({
      command: z.string().describe("The shell command to execute"),
    }),
  }
);

export async function getAgent() {
  if (!aiUrl || !aiToken) {
    throw new Error("AI_URL and AI_TOKEN environment variables are required");
  }

  const client = await getMcpClient();
  const mcpTools = await client.getTools();
  console.log("MCP Tools available:", mcpTools.length);
  const tools = [executeCommandTool, ...mcpTools];
  console.log(
    "Total tools:",
    tools.length,
    tools.map((t) => t.name)
  );

  // Log tool schemas to verify they're valid
  console.log(
    "Tool schemas:",
    JSON.stringify(
      tools.map((t) => ({
        name: t.name,
        description: t.description,
        schema: t.schema,
      })),
      null,
      2
    )
  );

  const model = new ChatOpenAI({
    modelName: aiModel,
    apiKey: aiToken,
    configuration: {
      baseURL: aiUrl,
    },
    temperature: 0.1,
  }).bindTools(tools);

  async function callModel(state: typeof MessagesAnnotation.State) {
    console.log("🤖 [Node: agent] LLM call started");
    console.log("Messages being sent:", state.messages.length);
    // Trim messages to prevent context overflow
    const response = await model.invoke(state.messages);
    console.log("✅ [Node: agent] LLM call completed");
    // console.log(
    //   "Response has tool_calls:",
    //   "tool_calls" in response && response.tool_calls?.length
    // );
    // if (response.tool_calls && response.tool_calls.length > 0) {
    //   console.log("Tool calls:", JSON.stringify(response.tool_calls, null, 2));
    // }
    return { messages: [response] };
  }

  async function callTools(state: typeof MessagesAnnotation.State) {
    console.log("🔧 [Node: tools] Tool execution started");

    const toolNode = new ToolNode(tools);
    const result = await toolNode.invoke(state);
    // console.log("state", state);
    // console.log("✓ [Node: tools] Tool execution completed");
    // console.log("Tool outputs:", result);
    return result;
  }

  const workflow = new StateGraph(MessagesAnnotation)
    .addNode("agent", callModel)
    .addNode("tools", callTools)
    .addEdge("__start__", "agent")
    .addConditionalEdges("agent", shouldContinue)
    .addEdge("tools", "agent");

  const checkpointer = new MemorySaver();
  const agentGraph = workflow.compile({ checkpointer });
  return agentGraph;
}

export async function* runAgent(task: string){
  const agent = await getAgent();

  const systemMessage = {
    role: "system" as const,
    content: `You are a helpful coding assistant. You have access to a student programming project in /live_project.
Your goal is to complete the given task by:
1. First understanding the project structure by executing commands
2. Reading relevant files
3. Executing commands to complete the task

Use the execute_command tool as many times as needed to:
- run projects (pnpm, npm, dotnet, docker, docker compose, etc)
   > after turning on a service in the background, sleep a few seconds, then read the log file before proceeding (e.g. "docker compose up -d; sleep 5; docker compose logs") 
   > run long running commands in the background and send the logs to a tmp logfile that you can inspect later 
   > never follow log output with -f, --follow or the command will never exit 
- List files (ls, find)
- Read files (cat)

never execute a command that will not exit (e.g. using the -f flag on docker logs)

use the playwright mcp server for loading student projects in the browser
- do not install playwright yourself

start executing tool calls immediately, do not update the user what with what is happening until the end`,
  };

  const userMessage = {
    role: "user" as const,
    content: task,
  };

  const threadId = "onlyone";
  try {
    const stream = await agent.stream(
      {
        messages: [systemMessage, userMessage],
      },
      {
        recursionLimit: 30,
        configurable: {
          thread_id: threadId,
        },
        streamMode: "messages",
      }
    );

    const allMessages: BaseMessage<MessageStructure, MessageType>[] = [];

    for await (const [message] of stream) {
      allMessages.push(message);
      yield message;
    }

    const lastMessage = allMessages[allMessages.length - 1];
  
    // swallowed by generator
    return {
      summary: lastMessage.content as string,
      messages: allMessages,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes("Recursion limit")) {
      console.log(error);
      console.warn("⚠️ Recursion limit reached, forcing agent to summarize");
      const state = await agent.getState({
        configurable: { thread_id: threadId },
      });
      const messages = state.values.messages;
      console.log("state=============================", state);

      const summaryModel = new ChatOpenAI({
        modelName: aiModel,
        apiKey: aiToken,
        configuration: {
          baseURL: aiUrl,
        },
        temperature: 0.1,
      });

      const summaryPrompt = {
        role: "user" as const,
        content: `The agent hit the recursion limit while working on: "${task}". 
        
Based on the command history executed so far, provide a summary of what was discovered and what still needs to be done. Be concise and helpful.`,
      };

      console.log("Generating summary of incomplete task...");

      const formattedMessages = formatMessagesForInvoke(messages);

      const summaryResponse = await summaryModel.invoke([
        ...formattedMessages,
        summaryPrompt,
      ]);
      console.log("Summary response:", summaryResponse);

      return {
        summary: `⚠️ Task incomplete (recursion limit reached):\n\n${
          summaryResponse.content as string
        }`,
        messages: [...messages, summaryPrompt, summaryResponse],
      };
    }

    throw error;
  }
}
