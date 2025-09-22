import fs from "fs";
import path from "path";
import { promisify } from "util";
import { exec } from "child_process";
import { axiosClient } from "../../../../utils/axiosUtils";
import { canvasRequestOptions } from "./canvasServiceUtils";
import {
  ensureDir,
  getSubmissionDirectory,
  getAssignmentDirectory,
} from "./canvasStorageUtils";

const execAsync = promisify(exec);

export interface GithubUserMapEntry {
  studentName: string;
  githubUsername: string;
}

export interface ProcessedRepoResult {
  repoName: string;
  studentName: string;
  status: string; // 'success' | 'error'
  reason?: string;
}

export const prepareTempDir = async () => {
  const tempDir = path.join(process.cwd(), "temp", "github-classroom");
  console.log(`\n2. Creating temporary directory: ${tempDir}`);
  ensureDir(tempDir);
  console.log("   ✓ Temporary directory created/verified");
  return tempDir;
};

export const cloneClassroomRepositories = async (
  classroomAssignmentId: string,
  tempDir: string
) => {
  const cloneCommand = `gh classroom clone student-repos -a ${classroomAssignmentId}`;
  console.log(`\n3. Executing GitHub Classroom clone command:`);
  console.log(`   Command: ${cloneCommand}`);
  console.log(`   Working directory: ${tempDir}`);
  console.log("   Executing...");

  const { stdout, stderr } = await execAsync(cloneCommand, { cwd: tempDir });
  if (stderr) console.log(`   ⚠️  GitHub CLI warnings/errors:`, stderr);
  if (stdout) console.log(`   ✓ GitHub CLI output:`, stdout);
  console.log("   ✓ GitHub Classroom clone command completed");

  // GitHub Classroom may create a nested structure, so we need to discover the actual student repositories
  const topLevelDirs = (
    await fs.promises.readdir(tempDir, { withFileTypes: true })
  )
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  console.log(
    `   Found ${topLevelDirs.length} top-level directories: ${topLevelDirs.join(
      ", "
    )}`
  );

  // Check if we have individual student repos directly, or if they're nested in a parent directory
  let studentRepos: string[] = [];
  let reposBaseDir = tempDir;

  // If there's only one directory and it contains multiple subdirectories that look like student repos,
  // use the subdirectories as the student repos
  if (topLevelDirs.length === 1) {
    const potentialParentDir = path.join(tempDir, topLevelDirs[0]);
    const subDirs = (
      await fs.promises.readdir(potentialParentDir, { withFileTypes: true })
    )
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    console.log(
      `   Checking subdirectories in ${topLevelDirs[0]}: ${subDirs.join(", ")}`
    );

    // If the subdirectories look like student repositories (contain assignment prefix or github usernames)
    if (subDirs.length > 1) {
      studentRepos = subDirs;
      reposBaseDir = potentialParentDir;
      console.log(
        `   Using subdirectories as student repositories from: ${reposBaseDir}`
      );
    } else {
      studentRepos = topLevelDirs;
      console.log(`   Using top-level directories as student repositories`);
    }
  } else {
    studentRepos = topLevelDirs;
    console.log(`   Using top-level directories as student repositories`);
  }

  return { studentRepos, reposBaseDir };
};

export const buildGithubLookup = (githubUserMap: GithubUserMapEntry[] = []) => {
  const githubLookup = new Map<string, string>();
  githubUserMap.forEach((m) => {
    if (m.githubUsername)
      githubLookup.set(m.githubUsername.toLowerCase(), m.studentName);
  });
  return githubLookup;
};

export const computeCleanedPrefix = (studentRepos: string[]) => {
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
  return common.replace(/[-_\s]+$/, "");
};

export const fetchAssignmentName = async (
  canvasBaseUrl: string,
  courseId: number,
  assignmentId: number
) => {
  console.log(
    `\n5. Fetching assignment metadata for assignmentId: ${assignmentId}`
  );
  const { data: assignmentData } = await axiosClient.get(
    `${canvasBaseUrl}/api/v1/courses/${courseId}/assignments/${assignmentId}`,
    { headers: canvasRequestOptions.headers }
  );
  return assignmentData?.name || `Assignment ${assignmentId}`;
};

interface OrganizeResult {
  processedRepos: ProcessedRepoResult[];
  successCount: number;
  errorCount: number;
  errors: string[];
}

export const organizeStudentRepositories = async ({
  studentRepos,
  reposDir,
  githubLookup,
  termName,
  courseName,
  assignmentId,
  assignmentName,
}: {
  studentRepos: string[];
  reposDir: string;
  githubLookup: Map<string, string>;
  termName: string;
  courseName: string;
  assignmentId: number;
  assignmentName: string;
}): Promise<OrganizeResult> => {
  console.log(`\n6. Processing and organizing student repositories:`);
  console.log(`   Total repositories to process: ${studentRepos.length}`);

  const processedRepos: ProcessedRepoResult[] = [];
  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  // Check if student folder exists in assignment directory
  const assignmentDirectory = getAssignmentDirectory({
    termName,
    courseName,
    assignmentId,
    assignmentName,
  });

  const assignmentDirContents = fs.existsSync(assignmentDirectory)
    ? fs
        .readdirSync(assignmentDirectory, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name)
    : [];

  for (const repoName of studentRepos) {
    const repoIndex = studentRepos.indexOf(repoName) + 1;
    console.log(
      `\n   Processing repository ${repoIndex}/${studentRepos.length}: ${repoName}`
    );
    try {
      let studentName = "Unknown Student";
      let githubUsername = "";

      // Extract GitHub username from repository name
      // Repository names typically follow pattern: assignment-prefix-githubusername
      // e.g., "exam1-1-StudentUser" -> "StudentUser"

      // First try to match against the github user map by checking if any username appears in the repo name
      for (const [username, mappedStudentName] of githubLookup) {
        if (repoName.toLowerCase().includes(username.toLowerCase())) {
          studentName = mappedStudentName;
          githubUsername = username;
          break;
        }
      }

      // If no match found in the map, try to extract the GitHub username from the repo name
      if (studentName === "Unknown Student") {
        // Try to extract username after the last dash
        const parts = repoName.split("-");
        if (parts.length > 1) {
          const potentialUsername = parts[parts.length - 1];
          githubUsername = potentialUsername;

          // Check if this username exists in our map
          const mappedName = githubLookup.get(potentialUsername.toLowerCase());
          if (mappedName) {
            studentName = mappedName;
          } else {
            // Use the GitHub username as the student name if no mapping exists
            studentName = potentialUsername;
          }
        }
      }

      console.log(`     → GitHub username extracted: "${githubUsername}"`);
      console.log(`     → Student name resolved: "${studentName}"`);

      if (!assignmentDirContents.includes(studentName)) {
        const warningMsg = `Student folder "${studentName}" does not exist in assignment directory. Skipping repository: ${repoName}`;
        console.log(`     ⚠️  ${warningMsg}`);
        processedRepos.push({
          repoName,
          studentName,
          status: "error",
          reason: warningMsg,
        });
        errorCount++;
        continue;
      }

      console.log(
        `     ✓ Student folder "${studentName}" found in assignment directory`
      );

      const sourceDir = path.join(reposDir, repoName);
      const submissionDirectory = getSubmissionDirectory({
        termName,
        courseName,
        assignmentId,
        assignmentName,
        studentName,
      });

      const targetDir = path.join(submissionDirectory, "githubClassroom");

      ensureDir(targetDir);

      console.log(`     → Source directory: ${sourceDir}`);
      console.log(`     → Target directory: ${targetDir}`);

      const sourceStats = fs.statSync(sourceDir);
      if (!sourceStats.isDirectory())
        throw new Error(`Source path is not a directory: ${sourceDir}`);

      const sourceContents = fs.readdirSync(sourceDir);
      console.log(
        `     → Source contains ${sourceContents.length} items: ${sourceContents
          .slice(0, 5)
          .join(", ")}${sourceContents.length > 5 ? "..." : ""}`
      );

      const existingContents = fs.existsSync(targetDir)
        ? fs.readdirSync(targetDir)
        : [];
      if (existingContents.length > 0) {
        console.log(
          `     → Target directory already contains ${existingContents.length} items (will be overwritten)`
        );
      }

      const copyCommand = `cp -r "${sourceDir}"/* "${targetDir}"/`;
      console.log(`     → Executing copy command: ${copyCommand}`);
      await execAsync(copyCommand);

      const copiedContents = fs.readdirSync(targetDir);
      console.log(
        `     → Copy completed. Target now contains ${copiedContents.length} items`
      );

      processedRepos.push({
        repoName,
        studentName,
        status: "success",
        reason: `Successfully copied ${sourceContents.length} items to ${targetDir}`,
      });
      console.log(
        `     ✅ Successfully organized repository for student: ${studentName}`
      );
      successCount++;
    } catch (error) {
      const errorMsg = `Failed to organize repository ${repoName}: ${
        error instanceof Error ? error.message : String(error)
      }`;
      console.log(`     ❌ Error processing repository ${repoName}:`);
      console.log(`        ${errorMsg}`);
      processedRepos.push({
        repoName,
        studentName: repoName,
        status: "error",
        reason: errorMsg,
      });
      errors.push(errorMsg);
      errorCount++;
    }
  }

  return { processedRepos, successCount, errorCount, errors };
};

export const summarizeAndLog = (result: OrganizeResult) => {
  const { successCount, errorCount, processedRepos, errors } = result;
  console.log(`\n7. Repository processing summary:`);
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Failed: ${errorCount}`);
  console.log(`   📊 Total processed: ${successCount + errorCount}`);

  if (processedRepos.length > 0) {
    console.log(`\n   Detailed results:`);
    processedRepos.forEach((repo, index) => {
      const statusIcon = repo.status === "success" ? "✅" : "❌";
      console.log(
        `     ${index + 1}. ${statusIcon} ${repo.repoName} → ${
          repo.studentName
        }`
      );
      if (repo.reason) console.log(`        Reason: ${repo.reason}`);
    });
  }

  const finalMessage = `Successfully organized ${successCount} repositories${
    errorCount > 0 ? ` (${errorCount} errors occurred)` : ""
  }.`;
  console.log(`\n=== GitHub Classroom Download Completed ===`);
  console.log(`Final result: ${finalMessage}`);

  return {
    finalMessage,
    output: {
      success: true,
      message: finalMessage,
      successCount,
      errorCount,
      errors: errors.length > 0 ? errors : undefined,
      processedRepositories: processedRepos,
    },
  };
};

export const cleanupTempDir = async (tempDir: string) => {
  console.log(`\n8. Cleaning up temporary directory: ${tempDir}`);
  try {
    await execAsync(`rm -rf "${tempDir}"`);
    console.log("   ✅ Temporary directory cleaned up successfully");
  } catch (cleanupError) {
    console.log("   ⚠️  Failed to clean up temporary directory:", cleanupError);
  }
};
