import { createContext, useContext, type FC, type ReactNode } from "react";

interface CourseContextValue {
  courseName: string;
  courseId: number;
}

const CourseContext = createContext<CourseContextValue>({
  courseName: "",
  courseId: 0,
});

export const CourseProvider: FC<{
  courseName: string;
  courseId: number;
  children: ReactNode;
}> = ({ courseName, courseId, children }) => {
  return (
    <CourseContext.Provider value={{ courseName, courseId }}>
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
