import fs from "fs";
import path from "path";
import { promisify } from "util";
import { exec } from "child_process";
import { axiosClient } from "../../../../utils/axiosUtils";
import { canvasRequestOptions } from "./canvasServiceUtils";
import { ensureDir, sanitizeName } from "./canvasStorageUtils";

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
  await ensureDir(tempDir);
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
};

export const discoverRepositories = (tempDir: string) => {
  console.log(
    `\n4. Scanning for downloaded repository directories in: ${tempDir}`
  );
  const reposDirs = fs
    .readdirSync(tempDir)
    .filter((dir) => fs.statSync(path.join(tempDir, dir)).isDirectory());

  console.log(
    `   Found ${reposDirs.length} directories: ${reposDirs.join(", ")}`
  );
  if (reposDirs.length === 0)
    throw new Error("No repositories were downloaded");

  const reposDir = path.join(tempDir, reposDirs[0]);
  console.log(`   Using repository directory: ${reposDir}`);

  const studentRepos = fs
    .readdirSync(reposDir)
    .filter((dir) => fs.statSync(path.join(reposDir, dir)).isDirectory());

  console.log(`   Found ${studentRepos.length} student repositories:`);
  studentRepos.forEach((repo, index) =>
    console.log(`     ${index + 1}. ${repo}`)
  );

  return { reposDir, studentRepos };
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

export const buildAssignmentDir = async (
  storageDirectory: string,
  courseMeta: { termName: string; courseName: string },
  assignmentId: number,
  assignmentName: string
) => {
  const assignmentDir = path.join(
    storageDirectory,
    sanitizeName(courseMeta.termName),
    sanitizeName(courseMeta.courseName),
    sanitizeName(`${assignmentId} - ${assignmentName}`),
    "submissions"
  );
  console.log(`\n5. Setting up target assignment directory:`);
  console.log(`   Path: ${assignmentDir}`);
  await ensureDir(assignmentDir);
  console.log("   ✓ Assignment submissions directory created/verified");
  return assignmentDir;
};

interface OrganizeParams {
  studentRepos: string[];
  reposDir: string;
  cleanedPrefix: string;
  githubLookup: Map<string, string>;
  assignmentDir: string; // points to .../<assignment>/submissions
}

export interface OrganizeResult {
  processedRepos: ProcessedRepoResult[];
  successCount: number;
  errorCount: number;
  errors: string[];
}

export const organizeStudentRepositories = async ({
  studentRepos,
  reposDir,
  cleanedPrefix,
  githubLookup,
  assignmentDir,
}: OrganizeParams): Promise<OrganizeResult> => {
  console.log(`\n6. Processing and organizing student repositories:`);
  console.log(`   Total repositories to process: ${studentRepos.length}`);

  const processedRepos: ProcessedRepoResult[] = [];
  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  for (const repoName of studentRepos) {
    const repoIndex = studentRepos.indexOf(repoName) + 1;
    console.log(
      `\n   Processing repository ${repoIndex}/${studentRepos.length}: ${repoName}`
    );
    try {
      // Extract student name
      let studentNameCandidate = repoName;
      if (cleanedPrefix && repoName.startsWith(cleanedPrefix)) {
        studentNameCandidate = repoName
          .slice(cleanedPrefix.length)
          .replace(/^[-_\s]+/, "");
      } else {
        const parts = repoName.split("-");
        if (parts.length > 1) studentNameCandidate = parts.slice(1).join("-");
      }

      const usernameCandidate = studentNameCandidate.toLowerCase();
      const resolvedStudentName =
        githubLookup.get(usernameCandidate) || studentNameCandidate;
      const sanitizedStudentName = sanitizeName(resolvedStudentName);

      console.log(
        `     → Raw student name extracted: "${studentNameCandidate}"`
      );
      console.log(`     → Sanitized student name: "${sanitizedStudentName}"`);

      const sourceDir = path.join(reposDir, repoName);
      const assignmentBase = path.dirname(assignmentDir);
      const targetDir = path.join(
        assignmentBase,
        sanitizedStudentName,
        "githubClassroom"
      );

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

      await ensureDir(targetDir);
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
        studentName: sanitizedStudentName,
        status: "success",
        reason: `Successfully copied ${sourceContents.length} items to ${targetDir}`,
      });
      console.log(
        `     ✅ Successfully organized repository for student: ${sanitizedStudentName}`
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

export const summarizeAndLog = (
  result: OrganizeResult,
  assignmentDir: string
) => {
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
  console.log(`Assignment directory: ${assignmentDir}`);

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
