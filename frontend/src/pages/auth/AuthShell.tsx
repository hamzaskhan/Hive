import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Panel } from "../../components/ui/Panel";
import "./auth.css";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="auth-page">
      <Link to="/" className="auth-brand">
        <span className="site-nav__mark">◉</span> Hive
      </Link>
      <Panel className="auth-card anim-pop">
        <h1>{title}</h1>
        <p className="auth-sub">{subtitle}</p>
        {children}
        <div className="auth-foot">{footer}</div>
      </Panel>
    </div>
  );
}
