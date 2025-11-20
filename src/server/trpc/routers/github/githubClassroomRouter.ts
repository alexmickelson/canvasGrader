import z from "zod";
import { createTRPCRouter, publicProcedure } from "../../utils/trpc.js";
import {
  parseClassroomList,
  parseAssignmentList,
  parseAcceptedAssignmentList,
} from "./githubCliParser.js";
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
import {
  getAssignment,
  getAssignmentSubmissions,
} from "../canvas/course/assignment/assignmentDbUtils.js";
import {
  getAssignmentGitRepositories,
  getGithubClassroomAssignmentsByCanvasAssignmentId,
  getGithubClassroomCoursesByCanvasCourseId,
  getGithubStudentUsernames,
  getPreviousAssignmentRepositoriesForUser,
  removeStudentUsernameAssignment,
  setSubmissionGitRepository,
  removeSubmissionGitRepository,
  storeGithubClassroomAssignment,
  removeGithubClassroomAssignment,
  storeGithubClassroomCourse,
  removeGithubClassroomCourse,
  storeGithubStudentUsername,
} from "./gitDbUtils.js";
import { getCourse } from "../canvas/course/canvasCourseDbUtils.js";
import {
  createAiTool,
  runToolCallingLoop,
} from "../../../../utils/aiUtils/createAiTool.js";
import { getSubmissionDirectory } from "../canvas/canvasStorageUtils.js";

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
    .input(z.object({ classroomId: z.number() }))
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

  getClassroomAssignmentGitUrls: publicProcedure
    .input(z.object({ classroomAssignmentId: z.number() }))
    .query(async ({ input }) => {
      const commandString = `gh classroom accepted-assignments -a ${input.classroomAssignmentId}`;
      const { stdout } = await execAsync(commandString);

      const acceptedAssignments = parseAcceptedAssignmentList(stdout);

      return acceptedAssignments;
    }),

  downloadAndOrganizeRepositories: publicProcedure
    .input(
      z.object({
        classroomAssignmentId: z.number(),
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

  downloadAssignedRepositories: publicProcedure
    .input(
      z.object({
        assignmentId: z.number(),
        courseId: z.number(),
      })
    )
    .mutation(async ({ input: { assignmentId, courseId } }) => {
      const assignment = await getAssignment(assignmentId);
      if (!assignment) {
        throw new Error(`Assignment with ID ${assignmentId} not found`);
      }

      const course = await getCourse(courseId);
      if (!course) {
        throw new Error(`Course with ID ${courseId} not found`);
      }

      const submissions = await getAssignmentSubmissions(assignmentId);
      const githubRepositories = await getAssignmentGitRepositories(
        assignmentId
      );

      const results = await Promise.all(
        submissions.map(async (submission) => {
          const repo = githubRepositories.find(
            (r) => r.user_id === submission.user_id
          );

          if (!repo) {
            console.log(
              `No repository assigned for ${submission.user.name}, skipping`
            );
            return {
              success: false,
              studentName: submission.user.name,
              repoUrl: null,
              path: null,
              reason: "No repository assigned",
            };
          }

          const termName = course.term.name;
          const courseName = course.name;
          const assignmentName = assignment.name;
          const studentName = submission.user.name;

          const submissionDirectory = getSubmissionDirectory({
            termName,
            courseName,
            assignmentId,
            assignmentName,
            studentName,
          });
          const targetPath = submissionDirectory + "/githubClassroom";
          const absoluteTargetPath = path.resolve(targetPath);

          if (fs.existsSync(targetPath)) {
            console.log(
              `Repository already exists at ${targetPath}, pulling latest...`
            );
            await execAsync(`gh repo sync`, {
              cwd: absoluteTargetPath,
              shell: "/bin/bash",
            });
          } else {
            console.log(
              `Cloning ${repo.repo_url} for ${studentName} to ${targetPath}`
            );

            fs.mkdirSync(submissionDirectory, { recursive: true });
            await execAsync(
              `gh repo clone "${repo.repo_url}" "${absoluteTargetPath}" && cd "${absoluteTargetPath}" && gh repo set-default "${repo.repo_url}"`,
              {
                shell: "/bin/bash",
              }
            );
          }

          return {
            success: true,
            studentName,
            repoUrl: repo.repo_url,
            path: targetPath,
          };
        })
      );

      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      console.log(`=== Download Complete ===`);
      console.log(`Successful: ${successful}`);
      console.log(`Failed: ${failed}`);

      return {
        success: true,
        total: results.length,
        successful,
        failed,
        results,
      };
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

  getGithubStudentUsernames: publicProcedure
    .input(
      z.object({
        courseId: z.number(),
      })
    )
    .query(async ({ input }) => {
      const { courseId } = input;
      return await getGithubStudentUsernames(courseId);
    }),

  storeGithubStudentUsername: publicProcedure
    .input(
      z.object({
        courseId: z.number(),
        userId: z.number(),
        githubUsername: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const { courseId, userId, githubUsername } = input;
      await storeGithubStudentUsername({
        courseId,
        userId,
        githubUsername,
      });
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

  getAssignedGithubClassroomId: publicProcedure
    .input(
      z.object({
        courseId: z.number(),
      })
    )
    .query(async ({ input }) => {
      const courseGithubClassroom =
        await getGithubClassroomCoursesByCanvasCourseId(input.courseId);
      return { classroom: courseGithubClassroom };
    }),

  setAssignedGithubClassroom: publicProcedure
    .input(
      z.object({
        courseId: z.number(),
        githubClassroomId: z.number(),
        name: z.string(),
        url: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      await storeGithubClassroomCourse({
        courseId: input.courseId,
        githubClassroomId: input.githubClassroomId,
        name: input.name,
        url: input.url,
      });
    }),

  removeAssignedGithubClassroom: publicProcedure
    .input(
      z.object({
        courseId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      await removeGithubClassroomCourse(input.courseId);
    }),

  getAssignedGithubClassroomAssignment: publicProcedure
    .input(
      z.object({
        assignmentId: z.number(),
      })
    )
    .query(async ({ input }) => {
      const githubClassroomAssignment =
        await getGithubClassroomAssignmentsByCanvasAssignmentId(
          input.assignmentId
        );
      return { githubClassroomAssignment };
    }),

  setAssignedGithubClassroomAssignment: publicProcedure
    .input(
      z.object({
        assignmentId: z.number(),
        githubClassroomAssignmentId: z.number(),
        githubClassroomId: z.number(),
        name: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      await storeGithubClassroomAssignment({
        assignmentId: input.assignmentId,
        githubClassroomAssignmentId: input.githubClassroomAssignmentId,
        githubClassroomId: input.githubClassroomId,
        name: input.name,
      });
    }),

  removeAssignedGithubClassroomAssignment: publicProcedure
    .input(
      z.object({
        assignmentId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      await removeGithubClassroomAssignment(input.assignmentId);
    }),

  removeStudentRepository: publicProcedure
    .input(
      z.object({
        userId: z.number(),
        assignmentId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      await removeSubmissionGitRepository({
        userId: input.userId,
        assignmentId: input.assignmentId,
      });
    }),

  getAssignedStudentRepositories: publicProcedure
    .input(
      z.object({
        assignmentId: z.number(),
      })
    )
    .query(async ({ input }) => {
      const githubRepositories = await getAssignmentGitRepositories(
        input.assignmentId
      );
      return { githubRepositories };
    }),
  setAssignedStudentRepository: publicProcedure
    .input(
      z.object({
        userId: z.number(),
        assignmentId: z.number(),
        repoUrl: z.string(),
        repoPath: z.string().nullable(),
      })
    )
    .mutation(async ({ input }) => {
      const { userId, assignmentId, repoUrl, repoPath } = input;
      await setSubmissionGitRepository({
        userId,
        assignmentId,
        repoUrl,
        repoPath: repoPath || undefined,
      });
    }),

  removeAssignedStudentUsername: publicProcedure
    .input(
      z.object({
        userId: z.number(),
        courseId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const { userId, courseId } = input;
      await removeStudentUsernameAssignment({ userId, courseId });
    }),

  guessRepositoryFromSubmission: publicProcedure
    .input(
      z.object({
        submisisonId: z.number(),
        assignmentId: z.number(),
        checkPreviousAssignments: z.boolean().optional(),
      })
    )
    .mutation(
      async ({
        input: { submisisonId, assignmentId, checkPreviousAssignments },
      }) => {
        const submissions = await getAssignmentSubmissions(assignmentId);
        const submission = submissions.find((s) => s.id === submisisonId);
        if (!submission) {
          throw new Error(
            `Submission with ID ${submisisonId} not found for assignment ${assignmentId}`
          );
        }
        const assignment = await getAssignment(assignmentId);
        if (!assignment) {
          throw new Error(`Assignment with ID ${assignmentId} not found`);
        }

        const prompt =
          `Given the following ` +
          `Canvas submission data: ${JSON.stringify(submission)} ` +
          `and the assignment details: ${JSON.stringify(assignment)}, ` +
          `identify the most likely GitHub repository URL associated with this submission. ` +
          `if no url is in the submission, you may check previous repositories, ` +
          `if the assignments seem to be associated with the same project the github repositories may be the same ` +
          `If no repository can be determined, respond with { repoUrl: null, reason: "could not find url" }.`;

        const checkPreviousAssignmentsTool = createAiTool({
          name: "get_previous_repositories",
          description:
            "Get repositories assigned to this student for previous assignments in the same course (with earlier due dates)",
          paramsSchema: z.object({}),
          fn: async () => {
            console.log(
              "checking previous repositories for",
              submission.user.name
            );
            const previousRepos =
              await getPreviousAssignmentRepositoriesForUser({
                userId: submission.user_id,
                assignmentId,
              });
            return previousRepos;
          },
        });

        const loopResult = await runToolCallingLoop(
          {
            messages: [{ role: "system", content: prompt }],
            tools: checkPreviousAssignments
              ? [checkPreviousAssignmentsTool]
              : [],
            responseFormat: z.object({
              repoUrl: z.string().optional().nullable(),
              reason: z
                .string()
                .optional()
                .nullable()
                .describe(
                  "where did you find the repoUrl, if you were unable to find it, state where you checked"
                ),
            }),
          },
          {
            maxIterations: 7,
          }
        );
        return loopResult;
      }
    ),

  // figureOutStudentRepositories: publicProcedure
  //   .input(
  //     z.object({
  //       assignmentId: z.number(),
  //     })
  //   )
  //   .mutation(async function* ({ input }) {
  //     const { assignmentId } = input;

  //     const assignment = await getAssignment(assignmentId);
  //     if (!assignment)
  //       throw new Error(`Assignment with ID ${assignmentId} not found`);
  //     yield "got assignment";

  //     const submissions = await getAssignmentSubmissions(assignmentId); // could me missing students without a submission, but with a git repo

  //     const enrollments = await getCourseEnrollments(assignment.course_id);

  //     const courseGithubClassroom =
  //       await getGithubClassroomCoursesByCanvasCourseId(assignment.course_id);

  //     if (!courseGithubClassroom) {
  //       // attempt to link the classroom, reset and try again?
  //     }

  //     const githubClassroomAssignment =
  //       getGithubClassroomAssignmentsByCanvasAssignmentId(assignmentId);

  //     if (!githubClassroomAssignment) {
  //       // attempt to link the assignment, reset and try again?
  //     }
  //     const githubUsernames = await getGithubUsernamesForCourse(
  //       assignment.course_id
  //     );

  //     const githubRepositories = await getAssignmentGitRepositories(
  //       assignmentId
  //     );

  //     const unAssignedEnrollments = enrollments.filter((enrollment) => {
  //       const gitRepo = githubRepositories.find(
  //         (repo) => repo.user_id === enrollment.user_id
  //       );
  //       return !gitRepo;
  //     });

  //     await Promise.all(
  //       unAssignedEnrollments.map(async (enrollment) => {
  //         // try to figure out repo
  //       })
  //     );

  //     // get assignment object
  //     // get submission objects
  //     // if course has been previously linked to github classroom, add it
  //     // if not, do an agentic task to try to link it
  //     // if assignment has been previously linked to github classroom assignment, add it
  //     // if not, do an agentic task to try to link it

  //     // detect github classroom name
  //     // detect github classroom assignment
  //     // if found
  //     // foreach submission
  //     // figure out github usernames -> student names

  //     // if not found
  //     // does any part of the submission point to repo?
  //     // do previous related assignments point to repo?
  //     // if so assign
  //     // if still not found
  //     // go back to UI and have user find something
  //     // maybe let user provide additional instructions (like get it from previous assignment)

  //     // tables: assignment -> github assignment
  //     //         submission -> github repo
  //     // do i need to cross reference previous data? maybe have mutual exclusive or check for recurring

  //     // send status back as yields
  //     // store repos in a "unconfirmed" status in table, have user confirm
  //     // need to store rational as well
  //   }),
});
