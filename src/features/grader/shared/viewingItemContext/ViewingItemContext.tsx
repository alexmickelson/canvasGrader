import { createContext, useContext, useState, type ReactNode } from "react";
import type { CanvasSubmission } from "../../../../server/trpc/routers/canvas/canvasModels";

export type ViewingItemType = "file" | "analysis";

export interface ViewingItem {
  type: ViewingItemType;
  name: string;
}

const throwAwayDefault = {
  viewingItem: null,
  submission: {} as CanvasSubmission,
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
  setViewingFile: (fileName: string) => void;
  setViewingAnalysis: (analysisName: string) => void;
  clearViewingItem: () => void;
}>(throwAwayDefault);

export const ViewingItemProvider: React.FC<{
  children: ReactNode;
}> = ({ children }) => {
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


  return (
    <ViewingItemContext.Provider
      value={{
        viewingItem,
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
  return context;
};
