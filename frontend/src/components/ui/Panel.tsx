import type { ReactNode } from "react";
import "./ui.css";

export function Panel({
  children,
  className = "",
  tone = "paper",
}: {
  children: ReactNode;
  className?: string;
  tone?: "paper" | "lime" | "sky" | "coral";
}) {
  return <div className={`ui-panel ui-panel--${tone} ${className}`.trim()}>{children}</div>;
}

export function Badge({ children, tone = "ink" }: { children: ReactNode; tone?: "ink" | "lime" | "coral" | "sky" }) {
  return <span className={`ui-badge ui-badge--${tone}`}>{children}</span>;
}
