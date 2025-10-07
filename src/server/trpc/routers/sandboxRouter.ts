import { createTRPCRouter, publicProcedure } from "../utils/trpc";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const SSH_HOST = "playwright_novnc";
const SSH_PORT = 22;
const SSH_USER = "root";
const SSH_PASS = "password";
const SESSION_NAME = "default";

async function sshExec(
  command: string
): Promise<{ stdout: string; stderr: string }> {
  const sshCommand = `sshpass -p '${SSH_PASS}' ssh -o StrictHostKeyChecking=no -p ${SSH_PORT} ${SSH_USER}@${SSH_HOST} "${command.replace(
    /"/g,
    '\\"'
  )}"`;
  return await execAsync(sshCommand);
}

export const sandboxRouter = createTRPCRouter({
  executeCommand: publicProcedure
    .input(
      z.object({
        command: z.string(),
        sessionName: z.string().default(SESSION_NAME),
      })
    )
    .mutation(async ({ input }) => {
      const { command, sessionName } = input;

      // Create session if it doesn't exist, then send command
      const tmuxCommand = `tmux has-session -t ${sessionName} 2>/dev/null || tmux new-session -d -s ${sessionName}; tmux send-keys -t ${sessionName} '${command.replace(
        /'/g,
        "'\\''"
      )}' Enter`;

      const res = await sshExec(tmuxCommand);
      console.log(res);
      return res;
    }),

  // executeCommandDetached: publicProcedure
  //   .input(
  //     z.object({
  //       command: z.string(),
  //       sessionName: z.string().default(DEFAULT_SESSION_NAME),
  //     })
  //   )
  //   .mutation(async ({ input }) => {
  //     const { command, sessionName } = input;

  //     try {
  //       // Create or attach to tmux session and run command in background
  //       const tmuxCommand = `tmux new-session -d -s ${sessionName} 2>/dev/null || tmux send-keys -t ${sessionName} C-c Enter; tmux send-keys -t ${sessionName} '${command.replace(
  //         /'/g,
  //         "'\\''"
  //       )}' Enter`;

  //       await sshExec(tmuxCommand);

  //       return {
  //         success: true,
  //         message: `Command sent to tmux session '${sessionName}'`,
  //       };
  //     } catch (error) {
  //       return {
  //         success: false,
  //         message: `Command failed: ${
  //           error instanceof Error ? error.message : String(error)
  //         }`,
  //       };
  //     }
  //   }),

  getOutput: publicProcedure.query(async () => {
    const { stdout } = await sshExec(`tmux capture-pane -t ${SESSION_NAME} -p`);

    return { output: stdout };
  }),

  // listTmuxSessions: publicProcedure.query(async () => {
  //   try {
  //     const { stdout } = await sshExec(
  //       "tmux list-sessions -F '#{session_name}'"
  //     );
  //     const sessions = stdout
  //       .trim()
  //       .split("\n")
  //       .filter((s) => s.length > 0);

  //     return { sessions };
  //   } catch {
  //     return { sessions: [] };
  //   }
  // }),
});
