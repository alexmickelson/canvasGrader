import { createTRPCRouter, publicProcedure } from "../utils/trpc";
import { z } from "zod";
import { Client } from "ssh2";

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
});
