import { createContext, useContext, type FC, type ReactNode } from "react";

interface AssignmentContextValue {
  assignmentId: number;
  assignmentName: string;
}

const AssignmentContext = createContext<AssignmentContextValue>({
  assignmentId: 0,
  assignmentName: "",
});

export const AssignmentProvider: FC<{
  assignmentId: number;
  assignmentName: string;
  children: ReactNode;
}> = ({ assignmentId, assignmentName, children }) => {
  return (
    <AssignmentContext.Provider value={{ assignmentId, assignmentName }}>
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
