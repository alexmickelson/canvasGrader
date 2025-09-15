import { createContext, useContext, useState, type ReactNode } from "react";
import type { CanvasSubmission } from "../../../../server/trpc/routers/canvas/canvasModels";
import { userName } from "../../userUtils";

export type ViewingItemType = "file" | "analysis";

export interface ViewingItem {
  type: ViewingItemType;
  name: string;
}

const throwAwayDefault = {
  viewingItem: null,
  submission: {} as CanvasSubmission,
  assignmentName: "",
  courseName: "",
  studentName: "",
  submissionName: "",
  setViewingFile: function (): void {
    throw new Error("Function not implemented.");
  },
  setViewingAnalysis: function (): void {
    throw new Error("Function not implemented.");
  },
  clearViewingItem: function (): void {
    throw new Error("Function not implemented.");
  },
};

const ViewingItemContext = createContext<{
  viewingItem: ViewingItem | null;
  submission: CanvasSubmission;
  assignmentName: string;
  courseName: string;
  studentName: string;
  submissionName: string;
  setViewingFile: (fileName: string) => void;
  setViewingAnalysis: (analysisName: string) => void;
  clearViewingItem: () => void;
}>(throwAwayDefault);

export const ViewingItemProvider: React.FC<{
  children: ReactNode;
  submission: CanvasSubmission;
  assignmentName: string;
  courseName: string;
  studentName: string;
}> = ({ children, submission, assignmentName, courseName, studentName }) => {
  const [viewingItem, setViewingItem] = useState<ViewingItem | null>(null);

  const setViewingFile = (fileName: string) => {
    setViewingItem({
      type: "file",
      name: fileName,
    });
  };

  const setViewingAnalysis = (analysisName: string) => {
    setViewingItem({
      type: "analysis",
      name: analysisName,
    });
  };

  const clearViewingItem = () => {
    setViewingItem(null);
  };

  const submissionName = userName(submission);

  return (
    <ViewingItemContext.Provider
      value={{
        viewingItem,
        submission,
        assignmentName,
        courseName,
        studentName,
        submissionName,
        setViewingFile,
        setViewingAnalysis,
        clearViewingItem,
      }}
    >
      {children}
    </ViewingItemContext.Provider>
  );
};

export const useViewingItem = () => {
  const context = useContext(ViewingItemContext);
  if (context === undefined) {
    throw new Error("useViewingItem must be used within a ViewingItemProvider");
  }
  return context;
};
