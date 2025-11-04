import { createTRPCRouter, publicProcedure } from "../../utils/trpc.js";
import { z } from "zod";
import { getSubmissionDirectory } from "../canvas/canvasStorageUtils.js";
import fs from "fs";
import path from "path";
import { sshExec, ansiToHtml } from "./sandboxSshUtils.js";
import { runAgent } from "./langchainUtils.js";
import type { BaseMessage, MessageStructure, MessageType } from "@langchain/core/messages";

let currentDirectory = "~";
const commandHistory: Array<{
  command: string;
  stdout: string;
  stderr: string;
  timestamp: number;
  directory: string;
}> = [];

export const sandboxRouter = createTRPCRouter({
  executeCommand: publicProcedure
    .input(
      z.object({
        command: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const { command } = input;

      const { stdout: pwdOutput } = await sshExec("pwd");
      currentDirectory = pwdOutput.trim();

      const { stdout, stderr } = await sshExec(command);
      commandHistory.push({
        command,
        stdout: ansiToHtml(stdout),
        stderr: ansiToHtml(stderr),
        timestamp: Date.now(),
        directory: currentDirectory,
      });

      console.log("sandbox command", command, { stdout, stderr });
      return { stdout: ansiToHtml(stdout), stderr: ansiToHtml(stderr) };
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
      // Copy all files including hidden files - properly escape paths with spaces
      execSync(`cp -r "${submissionDir}"/. "${liveProjectDir}"/`, {
        stdio: "inherit",
      });

      console.log("Submission loaded to /live_project successfully");

      // List contents to verify
      const contents = fs.readdirSync(liveProjectDir);

      console.log("Contents of /live_project:", contents);

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
        messageLimit: z.number(),
      })
    )
    .mutation(async function* ({ input }) {
      const { task, messageLimit } = input;

      console.log("AI Task received:", task);

      const itterable = runAgent(task, messageLimit);

      let value: IteratorResult<
        BaseMessage<MessageStructure, MessageType>,
        {
          summary: string;
          messages: unknown[];
        }
      > = await itterable.next();
      while (!value.done) {
        yield value.value;
        value = await itterable.next();
      }

      const endResult = value.value;
      return endResult;
    }),
});
