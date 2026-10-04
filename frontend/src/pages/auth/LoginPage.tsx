import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { api, setTokens } from "../../lib/api";
import {
  authPath,
  consumeReturnTo,
  isSafeReturnPath,
  peekReturnTo,
  rememberReturnTo,
} from "../../lib/sessionReturn";
import { AuthShell } from "./AuthShell";

export function LoginPage() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const nextFromQuery = params.get("next");
  const pendingRoom = peekReturnTo();

  useEffect(() => {
    if (isSafeReturnPath(nextFromQuery)) {
      rememberReturnTo(nextFromQuery);
    }
  }, [nextFromQuery]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await api.login({ email, password });
      setTokens(data.access_token, data.refresh_token, data.expires_in);
      nav(consumeReturnTo("/meetings"), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle={
        pendingRoom
          ? "Sign in and we will take you into the meeting."
          : "Log in to see your meetings and start a new one."
      }
      footer={
        <>
          New here? <Link to={authPath("signup", peekReturnTo())}>Create an account</Link>
          {" · "}
          <Link to="/forgot">Forgot password</Link>
        </>
      }
    >
      <form className="auth-form" onSubmit={onSubmit}>
        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error ? <p className="auth-error">{error}</p> : null}
        <Button type="submit" tone="ink" block disabled={busy}>
          {busy ? "Logging in…" : "Log in"}
        </Button>
      </form>
    </AuthShell>
  );
}
