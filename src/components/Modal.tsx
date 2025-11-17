import type { FC, ReactNode } from "react";
import { useState } from "react";
import { createPortal } from "react-dom";

const widthClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "4xl": "max-w-4xl",
} as const;

export const Modal: FC<{
  Button: (props: { onClick: () => void }) => ReactNode;
  title: string;
  width?: keyof typeof widthClasses;
  children: (props: { isOpen: boolean; onClose: () => void }) => ReactNode;
}> = ({ Button, title, width = "md", children }) => {
  const [isOpen, setIsOpen] = useState(false);

  const onClose = () => setIsOpen(false);

  return (
    <>
      <Button onClick={() => setIsOpen(true)} />
      {isOpen &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={onClose}
          >
            <div
              className={`bg-gray-800 rounded-lg shadow-xl ${widthClasses[width]} w-full mx-4`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-700">
                <h2 className="text-lg font-semibold">{title}</h2>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-200 rounded cursor-pointer"
                  aria-label="Close"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              <div className="p-4">{children({ isOpen, onClose })}</div>
            </div>
          </div>,
          document.getElementById("modal-root")!
        )}
    </>
  );
};
