import { createContext, useContext, type FC, type ReactNode } from "react";
import type { CanvasAssignment } from "../../server/trpc/routers/canvas/canvasModels";

interface AssignmentContextValue {
  assignmentId: number;
  assignmentName: string;
  assignment: CanvasAssignment;
}

const AssignmentContext = createContext<AssignmentContextValue | undefined>(
  undefined
);

export const AssignmentProvider: FC<{
  assignmentId: number;
  assignmentName: string;
  assignment: CanvasAssignment;
  children: ReactNode;
}> = ({ assignmentId, assignmentName, assignment, children }) => {
  return (
    <AssignmentContext.Provider
      value={{ assignmentId, assignmentName, assignment }}
    >
      {children}
    </AssignmentContext.Provider>
  );
};

export const useCurrentAssignment = () => {
  const context = useContext(AssignmentContext);
  if (!context) {
    throw new Error("useAssignment must be used within AssignmentProvider");
  }
  return context;
};
