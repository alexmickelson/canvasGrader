import z from "zod";
import { createTRPCRouter, publicProcedure } from "../utils/trpc";
import fs from "fs";
import path from "path";
import yaml from "yaml";

const storageDirectory = process.env.STORAGE_DIRECTORY || "./storage";

function ensureStorageDirExists() {
  if (!fs.existsSync(storageDirectory)) {
    fs.mkdirSync(storageDirectory, { recursive: true });
  }
}

const settingsSchema = z.object({
  courses: z
    .array(
      z.object({
        name: z.string(),
        canvasId: z.number(),
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

      // Write updated settings to settings.yml
      fs.writeFileSync(settingsPath, yaml.stringify(input), "utf8");

      return input;
    }),
});
