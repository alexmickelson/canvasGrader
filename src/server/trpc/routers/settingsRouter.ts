import z from "zod";
import { createTRPCRouter, publicProcedure } from "../utils/trpc";
import fs from "fs";
import path from "path";
import yaml from "yaml";
import axios from "axios";
import { canvasApi, canvasRequestOptions } from "./canvas/canvasServiceUtils";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const storageDirectory = process.env.STORAGE_DIRECTORY || "./storage";

function ensureStorageDirExists() {
  if (!fs.existsSync(storageDirectory)) {
    fs.mkdirSync(storageDirectory, { recursive: true });
  }
}

// Sanitize a string to be safe as a folder/file name
function sanitizeName(name: string): string {
  return name
    .replace(/[\n\r\t]/g, " ") // remove control whitespace
    .replace(/[\\/:*?"<>|]/g, "_") // invalid filename chars on most OS
    .replace(/\s+/g, " ") // collapse whitespace
    .trim();
}

async function getCourseTermName(courseId: number): Promise<string> {
  try {
    const url = `${canvasApi}/courses/${courseId}`;
    const { data } = await axios.get(url, {
      ...canvasRequestOptions,
      params: { include: "term" },
    });
    const termName: string | undefined =
      (data?.term?.name as string) || undefined;
    return termName && termName !== "The End of Time"
      ? termName
      : "Unknown Term";
  } catch {
    return "Unknown Term";
  }
}

function ensureCourseDir(termName: string, courseName: string) {
  const term = sanitizeName(termName || "Unknown Term");
  const course = sanitizeName(courseName || "Course");
  const dir = path.join(storageDirectory, term, course);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

const settingsSchema = z.object({
  courses: z
    .array(
      z.object({
        name: z.string(),
        canvasId: z.number(),
        githubUserMap: z
          .array(
            z.object({ studentName: z.string(), githubUsername: z.string() })
          )
          .optional(),
      })
    )
    .default([]),
});

export type Settings = z.infer<typeof settingsSchema>;
export type SettingsCourse = Settings["courses"][number];

export const settingsRouter = createTRPCRouter({
  getSettings: publicProcedure.query(async () => {
    const settingsPath = path.join(storageDirectory, "settings.yml");

    // Ensure storage directory exists
    ensureStorageDirExists();

    // Ensure settings.yml exists with default schema
    if (!fs.existsSync(settingsPath)) {
      const defaultSettings = settingsSchema.parse({});
      fs.writeFileSync(settingsPath, yaml.stringify(defaultSettings), "utf8");
    }

    // Read and parse settings.yml
    const fileContents = fs.readFileSync(settingsPath, "utf8");
    const settings = settingsSchema.parse(yaml.parse(fileContents) || {});

    return settings;
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
        // parse github usernames from repo names (assume assignment-username)
        // Username is typically the last hyphen-separated segment, so take that
        const rawUsernames = studentRepos.map((r) => {
          const name = String(r || "").trim();
          if (!name) return "";
          const lastHyphen = name.lastIndexOf("-");
          return lastHyphen === -1 ? name : name.substring(lastHyphen + 1);
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

  updateSettings: publicProcedure
    .input(settingsSchema)
    .mutation(async ({ input }) => {
      const settingsPath = path.join(storageDirectory, "settings.yml");

      // Ensure storage directory exists
      ensureStorageDirExists();

      // Determine newly added courses (to create folders for)
      let previous: Settings = { courses: [] };
      if (fs.existsSync(settingsPath)) {
        try {
          const prevFile = fs.readFileSync(settingsPath, "utf8");
          previous = settingsSchema.parse(yaml.parse(prevFile) || {});
        } catch {
          previous = { courses: [] };
        }
      }

      const prevIds = new Set(previous.courses.map((c) => c.canvasId));
      const added = input.courses.filter((c) => !prevIds.has(c.canvasId));

      // For each newly tracked course, create storage folder as termName/courseName
      await Promise.all(
        added.map(async (c) => {
          const termName = await getCourseTermName(c.canvasId);
          ensureCourseDir(termName, c.name);
        })
      );

      // Write updated settings to settings.yml
      fs.writeFileSync(settingsPath, yaml.stringify(input), "utf8");

      return input;
    }),
});
