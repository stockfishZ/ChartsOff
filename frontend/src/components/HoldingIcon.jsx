import React from "react";

export default function HoldingIcon({
  className = "w-4 h-4",
  color = "#1B5E20",
  filled = true,
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Outer Executive Portfolio Frame */}
      <rect
        x="3"
        y="6.5"
        width="18"
        height="14"
        rx="2"
        stroke={color}
        strokeWidth="1.8"
        fill={filled ? color : "none"}
        fillOpacity={filled ? "0.15" : "0"}
      />
      {/* Curved Handle */}
      <path
        d="M8.5 6.5V4.5C8.5 3.67157 9.17157 3 10 3H14C14.8284 3 15.5 3.67157 15.5 4.5V6.5"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {/* Precision Center Seal Clasp */}
      <rect
        x="10.5"
        y="11.5"
        width="3"
        height="3.5"
        rx="0.75"
        fill={color}
        stroke={color}
        strokeWidth="0.5"
      />
      {/* Accent Horizontal Seam */}
      <line
        x1="3"
        y1="13"
        x2="21"
        y2="13"
        stroke={color}
        strokeWidth="1.2"
        strokeDasharray="2 1.5"
      />
    </svg>
  );
}
