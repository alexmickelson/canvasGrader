import { createTRPCRouter, publicProcedure } from "../utils/trpc";
import { z } from "zod";
import { Client } from "ssh2";
import { getSubmissionDirectory } from "./canvas/canvasStorageUtils.js";
import fs from "fs";
import path from "path";
import { ChatOpenAI } from "@langchain/openai";
import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";
import { tool } from "@langchain/core/tools";
import { ToolNode } from "langchain";
import { aiModel } from "../../../utils/aiUtils/getOpenaiClient.js";

const SSH_HOST = "playwright_novnc";
const SSH_PORT = 22;
const SSH_USER = "root";
const SSH_PASS = "password";

let sshClient: Client | null = null;
let isConnected = false;
let currentDirectory = "~";
const commandHistory: Array<{
  command: string;
  stdout: string;
  stderr: string;
  timestamp: number;
  directory: string;
}> = [];

function stripAnsiCodes(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

async function getSSHConnection(): Promise<Client> {
  if (sshClient && isConnected) {
    return sshClient;
  }

  return new Promise((resolve, reject) => {
    const conn = new Client();

    conn.on("ready", () => {
      console.log("SSH connection established");
      sshClient = conn;
      isConnected = true;
      resolve(conn);
    });

    conn.on("error", (err) => {
      console.error("SSH connection error:", err);
      isConnected = false;
      reject(err);
    });

    conn.on("close", () => {
      console.log("SSH connection closed");
      isConnected = false;
      sshClient = null;
    });

    conn.connect({
      host: SSH_HOST,
      port: SSH_PORT,
      username: SSH_USER,
      password: SSH_PASS,
    });
  });
}

async function sshExec(
  command: string
): Promise<{ stdout: string; stderr: string }> {
  const conn = await getSSHConnection();

  return new Promise((resolve, reject) => {
    // Prepend cd command to ensure we're in /live_project
    const fullCommand = `cd /live_project && ${command}`;

    conn.exec(fullCommand, { pty: true }, (err, stream) => {
      if (err) return reject(err);

      let stdout = "";
      let stderr = "";

      stream.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      stream.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      stream.on("close", () => {
        resolve({ stdout, stderr });
      });
    });
  });
}

const aiUrl = process.env.AI_URL;
const aiToken = process.env.AI_TOKEN;

function getAgent() {
  if (!aiUrl || !aiToken) {
    throw new Error("AI_URL and AI_TOKEN environment variables are required");
  }

  const executeCommandTool = tool(
    async ({ command }: { command: string }) => {
      console.log(`Agent executing command: ${command}`);
      const { stdout, stderr } = await sshExec(command);

      if (stderr && stderr.trim()) {
        return `Command: ${command}\nStderr: ${stderr}\nStdout: ${stdout}`;
      }
      return `Command: ${command}\nOutput: ${stdout}`;
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

  const tools = [executeCommandTool];
  const model = new ChatOpenAI({
    modelName: aiModel,
    openAIApiKey: aiToken,
    configuration: {
      baseURL: aiUrl,
    },
    temperature: 0.1,
  }).bindTools(tools);

  function shouldContinue({ messages }: typeof MessagesAnnotation.State) {
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

  async function callModel(state: typeof MessagesAnnotation.State) {
    const response = await model.invoke(state.messages);
    return { messages: [response] };
  }

  const workflow = new StateGraph(MessagesAnnotation)
    .addNode("agent", callModel)
    .addNode("tools", new ToolNode(tools))
    .addEdge("__start__", "agent")
    .addConditionalEdges("agent", shouldContinue)
    .addEdge("tools", "agent");

  const agentGraph = workflow.compile();
  return agentGraph;
}

async function runAgent(task: string): Promise<string> {
  const agent = getAgent();

  const systemMessage = {
    role: "system" as const,
    content: `You are a helpful coding assistant. You have access to a project in /live_project.
Your goal is to complete the given task by:
1. First understanding the project structure by executing commands
2. Reading relevant files
3. Executing commands to complete the task
4. Verifying the results
5. Continue using tools until the task is fully complete

Use the execute_command tool as many times as needed to:
- List files (ls, find)
- Read files (cat)
- run projects (pnpm, npm, dotnet, docker, docker compose, etc)

When you have successfully completed the task and verified the results, provide a clear summary of what was done.
Do NOT stop until the task is fully complete or failed`,
  };

  const userMessage = {
    role: "user" as const,
    content: task,
  };

  const result = await agent.invoke(
    {
      messages: [systemMessage, userMessage],
    },
    {
      recursionLimit: 50, // Allow up to 50 tool calls
    }
  );

  const messages = result.messages;

  console.log("langgraph result", result.messages);
  
  const lastMessage = messages[messages.length - 1];

  return lastMessage.content as string;
}

export const sandboxRouter = createTRPCRouter({
  executeCommand: publicProcedure
    .input(
      z.object({
        command: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const { command } = input;

      // Get current directory
      const { stdout: pwdOutput } = await sshExec("pwd");
      currentDirectory = stripAnsiCodes(pwdOutput.trim());

      // Execute command directly via SSH
      const { stdout, stderr } = await sshExec(command);

      // Store in history with cleaned output
      commandHistory.push({
        command,
        stdout: stripAnsiCodes(stdout),
        stderr: stripAnsiCodes(stderr),
        timestamp: Date.now(),
        directory: currentDirectory,
      });

      console.log("sandbox command", command, { stdout, stderr });
      return { stdout: stripAnsiCodes(stdout), stderr: stripAnsiCodes(stderr) };
    }),
  getOutput: publicProcedure.query(async () => {
    return { history: commandHistory };
  }),

  loadSubmissionToSandbox: publicProcedure
    .input(
      z.object({
        termName: z.string(),
        courseName: z.string(),
        assignmentId: z.number(),
        assignmentName: z.string(),
        studentName: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const {
        termName,
        courseName,
        assignmentId,
        assignmentName,
        studentName,
      } = input;

      // Get the submission directory
      const submissionDir = getSubmissionDirectory({
        termName,
        courseName,
        assignmentId,
        assignmentName,
        studentName,
      });

      if (!fs.existsSync(submissionDir)) {
        throw new Error(`Submission directory not found: ${submissionDir}`);
      }

      const liveProjectDir = "/live_project";

      // Clear /live_project directory first
      console.log("Clearing /live_project directory...");
      if (fs.existsSync(liveProjectDir)) {
        const entries = fs.readdirSync(liveProjectDir);
        for (const entry of entries) {
          const fullPath = path.join(liveProjectDir, entry);
          fs.rmSync(fullPath, { recursive: true, force: true });
        }
      } else {
        fs.mkdirSync(liveProjectDir, { recursive: true });
      }

      // Copy submission files to /live_project using cp command
      console.log(
        `Copying submission from ${submissionDir} to ${liveProjectDir}...`
      );

      const { execSync } = await import("child_process");
      // Use sh -c with glob patterns to include hidden files
      execSync(
        `sh -c 'cp -r ${submissionDir}/* ${submissionDir}/.[!.]* ${liveProjectDir}/ 2>/dev/null || true'`,
        {
          stdio: "inherit",
        }
      );

      console.log("Submission loaded to /live_project successfully");

      // List contents to verify
      const contents = fs.readdirSync(liveProjectDir);

      return {
        success: true,
        message: "Submission loaded successfully",
        contents: contents.join(", "),
      };
    }),

  aiTask: publicProcedure
    .input(
      z.object({
        task: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const { task } = input;

      console.log("AI Task received:", task);

      const result = await runAgent(task);

      return {
        success: true,
        result,
      };
    }),
});
