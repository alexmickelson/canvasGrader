import { createContext, useContext, useState, type ReactNode } from "react";
import type {
  CanvasSubmission,
  SubmissionAttachment,
} from "../../../../server/trpc/routers/canvas/canvasModels";
import type { FullEvaluation } from "../../../../server/trpc/routers/rubricAI/rubricAiReportModels";

export type ViewingItemType = "file" | "analysis";

export interface ViewingItem {
  // new stuff below
  submission?: CanvasSubmission;
  fileAttachment?: SubmissionAttachment;
  filePath?: string; // github files
  evaluation?: FullEvaluation;
}

const throwAwayDefault = {
  viewingItem: null,
  clearViewingItem: function (): void {
    throw new Error("Function not implemented.");
  },
  setViewingItem: function (): void {
    throw new Error("Function not implemented.");
  },
};

const ViewingItemContext = createContext<{
  viewingItem: ViewingItem | null;
  clearViewingItem: () => void;
  setViewingItem: (props: ViewingItem) => void;
}>(throwAwayDefault);

export const ViewingItemProvider: React.FC<{
  children: ReactNode;
}> = ({ children }) => {
  const [viewingItem, setViewingItem] = useState<ViewingItem | null>(null);
  const clearViewingItem = () => {
    setViewingItem(null);
  };

  return (
    <ViewingItemContext.Provider
      value={{
        viewingItem,
        clearViewingItem,
        setViewingItem,
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
