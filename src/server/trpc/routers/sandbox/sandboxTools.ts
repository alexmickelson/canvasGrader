import { tool } from "@langchain/core/tools";
import { z } from "zod";
import {
  sshExec,
  sshExecInTmux,
  readTmuxOutput,
  killTmuxSession,
} from "./sandboxSshUtils.js";

export const executeCommandTool = tool(
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

export const executeBackgroundTmuxCommandTool = tool(
  async (input) => {
    const { command, tmuxSessionName } = input as {
      command: string;
      tmuxSessionName: string;
    };
    console.log(`Agent executing background tmux command: ${command}`);
    const { stdout, stderr } = await sshExecInTmux({
      command,
      sessionName: tmuxSessionName,
    });

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
    name: "execute_background_tmux_command",
    description:
      "Execute a shell command in a persistent tmux session in the /live_project directory. Use this to run long-running commands in the background, such as starting servers or services.",
    schema: z.object({
      command: z.string().describe("The shell command to execute in tmux"),
      tmuxSessionName: z
        .string()
        .describe("The name of the tmux session to use (default: sandbox)"),
    }),
  }
);

export const viewTmuxSessionOutputTool = tool(
  async (input) => {
    const { tmuxSessionName } = input as {
      tmuxSessionName: string;
    };
    console.log(`Agent viewing tmux session output: ${tmuxSessionName}`);
    const { stdout, stderr } = await readTmuxOutput({
      sessionName: tmuxSessionName,
    });

    if (stderr && stderr.trim()) {
      const message = `Stderr: ${stderr}\nStdout: ${stdout}`;
      console.log(message);
      return message;
    }
    const res = `Session Output: ${stdout}`;
    console.log(res);
    return res;
  },
  {
    name: "view_tmux_session_output",
    description:
      "View the current output of a tmux session. Use this to check the status of background commands or services running in tmux.",
    schema: z.object({
      tmuxSessionName: z
        .string()
        .describe("The name of the tmux session to view (default: sandbox)"),
    }),
  }
);

export const endTmuxBackgroundSessionTool = tool(
  async (input) => {
    const { tmuxSessionName } = input as {
      tmuxSessionName: string;
    };
    console.log(`Agent ending tmux session: ${tmuxSessionName}`);
    const { stdout, stderr } = await killTmuxSession({
      sessionName: tmuxSessionName,
    });

    if (stderr && stderr.trim()) {
      const message = `Stderr: ${stderr}\nStdout: ${stdout}`;
      console.log(message);
      return message;
    }
    const res = `Session ended successfully. ${stdout}`;
    console.log(res);
    return res;
  },
  {
    name: "end_tmux_background_session",
    description:
      "Kill a tmux session to stop any background processes running in it. Use this to clean up after background tasks are complete.",
    schema: z.object({
      tmuxSessionName: z
        .string()
        .describe("The name of the tmux session to kill (default: sandbox)"),
    }),
  }
);
