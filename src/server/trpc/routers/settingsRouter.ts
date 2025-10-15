import z from "zod";
import { createTRPCRouter, publicProcedure } from "../utils/trpc";
import fs from "fs";
import path from "path";
import yaml from "yaml";
import axios from "axios";
import { canvasApi, canvasRequestOptions } from "./canvas/canvasServiceUtils";

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
