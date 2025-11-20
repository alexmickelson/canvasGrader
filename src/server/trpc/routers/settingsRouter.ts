import z from "zod";
import { createTRPCRouter, publicProcedure } from "../utils/trpc";
import {
  getFavoriteCourses,
  addFavoriteCourse,
  removeFavoriteCourse,
} from "./settingsDbUtils";

export const settingsRouter = createTRPCRouter({
  getFavoriteCourses: publicProcedure.query(async () => {
    return await getFavoriteCourses();
  }),

  addFavoriteCourse: publicProcedure
    .input(z.object({ courseId: z.number(), courseName: z.string() }))
    .mutation(async ({ input }) => {
      await addFavoriteCourse(input.courseId, input.courseName);
    }),

  removeFavoriteCourse: publicProcedure
    .input(z.object({ courseId: z.number() }))
    .mutation(async ({ input }) => {
      await removeFavoriteCourse(input.courseId);
    }),
});
