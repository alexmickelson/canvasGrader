import { createContext, useContext, type FC, type ReactNode } from "react";
import type { CanvasCourse } from "../../server/trpc/routers/canvas/canvasModels";

interface CourseContextValue {
  courseName: string;
  courseId: number;
  termName: string;
  course: CanvasCourse;
}

const CourseContext = createContext<CourseContextValue | undefined>(undefined);

export const CourseProvider: FC<{
  courseName: string;
  courseId: number;
  termName: string;
  course: CanvasCourse;
  children: ReactNode;
}> = ({ courseName, courseId, termName, course, children }) => {
  return (
    <CourseContext.Provider value={{ courseName, courseId, termName, course }}>
      {children}
    </CourseContext.Provider>
  );
};

export const useCurrentCourse = () => {
  const context = useContext(CourseContext);
  if (!context) {
    throw new Error("useCurrentCourse must be used within CourseProvider");
  }
  return context;
};
