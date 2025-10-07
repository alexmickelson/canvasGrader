import { createTRPCRouter, publicProcedure } from "../utils/trpc";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const SSH_HOST = "playwright_novnc";
const SSH_PORT = 22;
const SSH_USER = "root";
const SSH_PASS = "password";
const DEFAULT_SESSION_NAME = "default";

// Helper to execute SSH command using sshpass
async function sshExec(
  command: string
): Promise<{ stdout: string; stderr: string }> {
  const sshCommand = `sshpass -p '${SSH_PASS}' ssh -o StrictHostKeyChecking=no -p ${SSH_PORT} ${SSH_USER}@${SSH_HOST} "${command.replace(
    /"/g,
    '\\"'
  )}"`;
  return execAsync(sshCommand);
}

export const sandboxRouter = createTRPCRouter({
  executeCommand: publicProcedure
    .input(
      z.object({
        command: z.string(),
        sessionName: z.string().default(DEFAULT_SESSION_NAME),
      })
    )
    .mutation(async ({ input }) => {
      const { command, sessionName } = input;

      // Create or attach to tmux session and execute command
      const tmuxCommand = `tmux new-session -A -s ${sessionName} '${command.replace(
        /'/g,
        "'\\''"
      )}; echo ""; echo "Command completed. Press enter to continue..."; read'`;

      return sshExec(tmuxCommand);
    }),

  executeCommandDetached: publicProcedure
    .input(
      z.object({
        command: z.string(),
        sessionName: z.string().default(DEFAULT_SESSION_NAME),
      })
    )
    .mutation(async ({ input }) => {
      const { command, sessionName } = input;

      try {
        // Create or attach to tmux session and run command in background
        const tmuxCommand = `tmux new-session -d -s ${sessionName} 2>/dev/null || tmux send-keys -t ${sessionName} C-c Enter; tmux send-keys -t ${sessionName} '${command.replace(
          /'/g,
          "'\\''"
        )}' Enter`;

        await sshExec(tmuxCommand);

        return {
          success: true,
          message: `Command sent to tmux session '${sessionName}'`,
        };
      } catch (error) {
        return {
          success: false,
          message: `Command failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        };
      }
    }),

  getTmuxOutput: publicProcedure
    .input(
      z.object({
        sessionName: z.string().default(DEFAULT_SESSION_NAME),
      })
    )
    .query(async ({ input }) => {
      const { sessionName } = input;

      const { stdout } = await sshExec(
        `tmux capture-pane -t ${sessionName} -p`
      );

      return { output: stdout };
    }),

  listTmuxSessions: publicProcedure.query(async () => {
    try {
      const { stdout } = await sshExec(
        "tmux list-sessions -F '#{session_name}'"
      );
      const sessions = stdout
        .trim()
        .split("\n")
        .filter((s) => s.length > 0);

      return { sessions };
    } catch {
      return { sessions: [] };
    }
  }),
});
