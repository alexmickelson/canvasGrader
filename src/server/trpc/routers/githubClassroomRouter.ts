import z from "zod";
import { createTRPCRouter, publicProcedure } from "../utils/trpc.js";
import {
  parseClassroomList,
  parseAssignmentList,
} from "./canvas/githubCliParser.js";
import { promisify } from "util";
import { exec } from "child_process";
import {
  prepareTempDir,
  cloneClassroomRepositories,
  buildGithubLookup,
  organizeStudentRepositories,
  summarizeAndLog,
  cleanupTempDir,
  type GithubUserMapEntry,
} from "./canvas/githubClassroomUtils.js";

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
        throw new Error(
          "GitHub Classroom extension is not installed. Run: gh extension install github/gh-classroom"
        );
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
});
