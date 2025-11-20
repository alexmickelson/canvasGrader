"use client";
import {
  type ReactNode,
  type Dispatch,
  type SetStateAction,
  useState,
} from "react";

export function Expandable({
  children,
  ExpandableElement,
  defaultExpanded = false,
}: {
  children: ReactNode;
  ExpandableElement: (props: {
    setIsExpanded: Dispatch<SetStateAction<boolean>>;
    isExpanded: boolean;
  }) => ReactNode;
  defaultExpanded?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <>
      <ExpandableElement
        setIsExpanded={setIsExpanded}
        isExpanded={isExpanded}
      />
      <div
        className={`overflow-hidden transition-all ${
          isExpanded ? "max-h-screen" : "max-h-0"
        }`}
      >
        {children}
      </div>
    </>
  );
}
