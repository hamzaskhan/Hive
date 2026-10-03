import { Link, NavLink } from "react-router-dom";
import { Button } from "../ui/Button";
import "./SiteNav.css";

export function SiteNav({ solid = false }: { solid?: boolean }) {
  return (
    <header className={`site-nav ${solid ? "site-nav--solid" : ""}`}>
      <Link to="/" className="site-nav__brand" aria-label="Hive home">
        <span className="site-nav__mark" aria-hidden>
          ◉
        </span>
        <span className="site-nav__word">Hive</span>
      </Link>
      <nav className="site-nav__links" aria-label="Primary">
        <a href="/#humans">Humans</a>
        <a href="/#bots">Bots</a>
        <NavLink to="/agent">Agent portal</NavLink>
        <NavLink to="/login">Log in</NavLink>
      </nav>
      <div className="site-nav__cta">
        <Button to="/signup" tone="ink">
          Start free
        </Button>
      </div>
    </header>
  );
}
