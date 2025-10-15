import z from "zod";
import { createTRPCRouter, publicProcedure } from "../../utils/trpc.js";
import { parseClassroomList, parseAssignmentList } from "./githubCliParser.js";
import { promisify } from "util";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import {
  prepareTempDir,
  cloneClassroomRepositories,
  buildGithubLookup,
  type GithubUserMapEntry,
  organizeStudentRepositories,
  cleanupTempDir,
  summarizeAndLog,
} from "./githubClassroomUtils.js";
import {
  getGithubUsernamesForCourse,
  setGithubUsername,
} from "./githubDbUtils.js";

const execAsync = promisify(exec);

export const githubClassroomRouter = createTRPCRouter({
  getClassrooms: publicProcedure.query(async () => {
    try {
      console.log("Fetching GitHub Classrooms...");

      // First check if gh CLI is available
      try {
        await execAsync("gh --version");
      } catch {
        throw new Error("GitHub CLI (gh) is not installed or not in PATH");
      }

      // Check if classroom extension is installed
      try {
        await execAsync("gh classroom --help");
      } catch {
        console.log("GitHub Classroom extension not found, installing...");
        try {
          await execAsync("gh extension install github/gh-classroom");
          console.log("GitHub Classroom extension installed successfully");
        } catch (installError) {
          throw new Error(
            `Failed to install GitHub Classroom extension: ${
              installError instanceof Error
                ? installError.message
                : String(installError)
            }`
          );
        }
      }

      const { stdout } = await execAsync("gh classroom list");

      // Parse the output using the dedicated parser function
      const classrooms = parseClassroomList(stdout);

      console.log(`Found ${classrooms.length} classrooms`);
      return classrooms;
    } catch (error) {
      console.error("Error fetching GitHub Classrooms:", error);
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(message);
    }
  }),

  getClassroomAssignments: publicProcedure
    .input(z.object({ classroomId: z.string() }))
    .query(async ({ input }) => {
      try {
        console.log(
          `Fetching assignments for classroom ${input.classroomId}...`
        );

        // Use the appropriate gh classroom command for assignments
        // Note: The exact command might vary depending on the gh-classroom extension version
        const { stdout } = await execAsync(
          `gh classroom assignments --classroom-id ${input.classroomId}`
        );

        // Parse the output using the dedicated parser function
        const assignments = parseAssignmentList(stdout);

        console.log(
          `Found ${assignments.length} assignments for classroom ${input.classroomId}`
        );
        return assignments;
      } catch (error) {
        console.error("Error fetching GitHub Classroom assignments:", error);
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Failed to fetch assignments for classroom ${input.classroomId}. Error: ${message}`
        );
      }
    }),

  downloadAndOrganizeRepositories: publicProcedure
    .input(
      z.object({
        classroomAssignmentId: z.string(),
        termName: z.string(),
        courseName: z.string(),

        assignmentId: z.number(),
        assignmentName: z.string(),

        courseId: z.number(),
        githubUserMap: z.array(
          z.object({ studentName: z.string(), githubUsername: z.string() })
        ),
      })
    )
    .mutation(async ({ input }) => {
      const {
        classroomAssignmentId,
        assignmentId,
        courseId,
        githubUserMap,
        termName,
        courseName,
        assignmentName,
      } = input;

      console.log("=== GitHub Classroom Download Started ===");
      console.log(`Input parameters:`);
      console.log(`  - Classroom Assignment ID: ${classroomAssignmentId}`);
      console.log(`  - Canvas Assignment ID: ${assignmentId}`);
      console.log(`  - Canvas Course ID: ${courseId}`);

      try {
        console.log(`\n1. Fetching course metadata for courseId: ${courseId}`);

        const tempDir = await prepareTempDir();
        const { studentRepos, reposBaseDir } = await cloneClassroomRepositories(
          classroomAssignmentId,
          tempDir
        );
        const githubLookup = buildGithubLookup(
          githubUserMap as GithubUserMapEntry[]
        );
        const organizeResult = await organizeStudentRepositories({
          studentRepos,
          githubLookup,
          termName,
          courseName,
          assignmentId,
          assignmentName,
          reposDir: reposBaseDir,
        });
        await cleanupTempDir(tempDir);
        const { output } = summarizeAndLog(organizeResult);
        return output;
      } catch (error) {
        console.log(`\n❌ === GitHub Classroom Download FAILED ===`);
        console.log(`Error occurred during download and organization process:`);
        console.log(
          `Error type: ${
            error instanceof Error ? error.constructor.name : typeof error
          }`
        );
        console.log(
          `Error message: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        if (error instanceof Error && error.stack) {
          console.log(`Error stack trace:`);
          console.log(error.stack);
        }
        console.log(`Input parameters that caused the error:`);
        console.log(`  - Classroom Assignment ID: ${classroomAssignmentId}`);
        console.log(`  - Canvas Assignment ID: ${assignmentId}`);
        console.log(`  - Canvas Course ID: ${courseId}`);

        throw new Error(
          `Failed to download and organize GitHub Classroom repositories: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }),

  getGithubUsernames: publicProcedure
    .input(
      z.object({
        courseId: z.number(),
      })
    )
    .query(async ({ input }) => {
      const { courseId } = input;
      return await getGithubUsernamesForCourse(courseId);
    }),

  setGithubUsername: publicProcedure
    .input(
      z.object({
        courseId: z.number(),
        enrollmentId: z.number(),
        githubUsername: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const { courseId, enrollmentId, githubUsername } = input;
      await setGithubUsername(courseId, enrollmentId, githubUsername);
      return { success: true };
    }),

  scanGithubClassroom: publicProcedure
    .input(z.object({ classroomAssignmentId: z.string() }))
    .query(async ({ input }): Promise<string[]> => {
      console.log("Scanning GitHub Classroom for assignment:", input);
      const tempDir = path.join(process.cwd(), "temp", "github-classroom-scan");
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
      // run a dry clone into tempDir
      const cloneCmd = `gh classroom clone student-repos -a ${input.classroomAssignmentId}`;
      try {
        const { stderr } = await execAsync(cloneCmd, { cwd: tempDir });
        if (stderr) console.warn("gh warnings:", stderr);
        // find first subdir containing repos
        const dirs = fs
          .readdirSync(tempDir)
          .filter((d) => fs.statSync(path.join(tempDir, d)).isDirectory());
        if (dirs.length === 0) return [];
        const reposBase = path.join(tempDir, dirs[0]);
        const studentRepos = fs
          .readdirSync(reposBase)
          .filter((d) => fs.statSync(path.join(reposBase, d)).isDirectory());
        // parse github usernames from repo names
        // Many classroom repo folders share a common prefix (e.g. "assignmentX-" or "prefix_")
        // Instead of always taking the last hyphen segment, compute the longest common
        // prefix across folder names and strip it. Then trim leading separators.
        const rawNames = studentRepos
          .map((r) => String(r || "").trim())
          .filter(Boolean);

        const longestCommonPrefix = (arr: string[]) => {
          if (arr.length === 0) return "";
          return arr.reduce((prefix, s) => {
            let i = 0;
            const max = Math.min(prefix.length, s.length);
            while (i < max && prefix[i] === s[i]) i++;
            return prefix.slice(0, i);
          }, arr[0]);
        };

        const common = longestCommonPrefix(rawNames);
        // remove trailing separators from the common prefix (hyphens/underscores/spaces)
        const cleanedPrefix = common.replace(/[-_\s]+$/, "");

        const rawUsernames = rawNames.map((name) => {
          let remainder =
            cleanedPrefix && name.startsWith(cleanedPrefix)
              ? name.slice(cleanedPrefix.length)
              : name;
          // strip leading separators after removing prefix
          remainder = remainder.replace(/^[-_\s]+/, "");
          // fallback: if nothing left, use last-hyphen logic
          if (!remainder) {
            const lastHyphen = name.lastIndexOf("-");
            remainder =
              lastHyphen === -1 ? name : name.substring(lastHyphen + 1);
          }
          return remainder;
        });
        // Clean and deduplicate
        const usernames = Array.from(
          new Set(rawUsernames.map((u) => u.trim()).filter(Boolean))
        );
        // cleanup
        try {
          await execAsync(`rm -rf "${tempDir}"`);
        } catch (cleanupErr) {
          console.warn("Failed to cleanup tempDir:", cleanupErr);
        }
        return usernames;
      } catch (err) {
        console.error("Failed to scan GitHub Classroom:", err);
        try {
          await execAsync(`rm -rf "${tempDir}"`);
        } catch (cleanupErr) {
          console.warn("Failed to cleanup tempDir after error:", cleanupErr);
        }
        throw err;
      }
    }),
});
