import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";
import "./ui.css";

type Tone = "lime" | "coral" | "ink" | "ghost" | "sky";
type Size = "md" | "sm";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: Tone;
  size?: Size;
  to?: string;
  children: ReactNode;
  block?: boolean;
};

export function Button({
  tone = "lime",
  size = "md",
  to,
  children,
  block,
  className = "",
  ...rest
}: Props) {
  const cls =
    `ui-btn ui-btn--${tone} ui-btn--${size} ${block ? "ui-btn--block" : ""} ${className}`.trim();
  if (to) {
    return (
      <Link className={cls} to={to}>
        {children}
      </Link>
    );
  }
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}
