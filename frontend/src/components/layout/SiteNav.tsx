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
        <a href="/#humans">People</a>
        <a href="/#bots">Bots</a>
        <NavLink to="/agent">Agent portal</NavLink>
      </nav>
      <div className="site-nav__cta">
        <Link to="/login" className="site-nav__login">
          Log in
        </Link>
        <Button to="/signup" tone="ink">
          Sign up
        </Button>
      </div>
    </header>
  );
}
