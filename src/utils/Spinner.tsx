import React from "react";
import { FaSpinner } from "react-icons/fa";

const Spinner: React.FC<{
  size?: number | string;
  color?: string;
  className?: string;
  "aria-label"?: string;
}> = ({
  size = 32,
  color = "#333",
  className = "",
  "aria-label": ariaLabel = "Loading...",
}) => (
  <span
    className={`spinner ${className}`}
    style={{ display: "inline-block", lineHeight: 0 }}
    role="status"
    aria-label={ariaLabel}
  >
    <FaSpinner
      size={size}
      color={color}
      style={{
        animation: "spin 1s linear infinite",
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

export default Spinner;
