import React from "react";
import { FaSpinner } from "react-icons/fa";

type SpinnerSize = "sm" | "md" | "lg";

const Spinner: React.FC<{
  size?: SpinnerSize;
  color?: string;
  className?: string;
  "aria-label"?: string;
}> = ({
  size = "sm",
  color = "#e2e8f0",
  className = "",
  "aria-label": ariaLabel = "Loading...",
}) => {
  const sizeMap = {
    sm: 14, // Fits inline with text
    md: 20,
    lg: 32,
  };

  const spinnerSize = sizeMap[size];

  return (
    <span
      className={`spinner ${className}`}
      style={{ display: "inline-block", lineHeight: 0 }}
      role="status"
      aria-label={ariaLabel}
    >
      <FaSpinner
        size={spinnerSize}
        color={color}
        style={{
          animation: "spin 2s linear infinite", // Slower: 2s instead of 1s
          verticalAlign: "middle",
        }}
      />
      <style>
        {`
          @keyframes spin {
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </span>
  );
};

export default Spinner;
