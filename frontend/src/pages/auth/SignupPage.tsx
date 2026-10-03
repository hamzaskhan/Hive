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
import "./auth.css";

export function SignupPage() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountType, setAccountType] = useState<"human" | "ai_worker">("human");
  const [accept, setAccept] = useState(false);
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
    if (!accept) {
      setError("Accept the terms to continue.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = await api.signup({
        email,
        password,
        full_name: fullName,
        account_type: accountType,
        accept_terms: true,
      });
      setTokens(data.access_token, data.refresh_token, data.expires_in);
      nav(consumeReturnTo("/meetings"), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Join Hive"
      subtitle={
        pendingRoom
          ? `Create an account to join ${pendingRoom}.`
          : "Human operator or AI worker — same door."
      }
      footer={
        <>
          Already in? <Link to={authPath("login", peekReturnTo())}>Log in</Link>
        </>
      }
    >
      <form className="auth-form" onSubmit={onSubmit}>
        <Input
          label="Full name"
          name="full_name"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
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
          autoComplete="new-password"
          minLength={8}
          required
          hint="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <fieldset className="auth-type">
          <legend>Are you</legend>
          <label className={accountType === "human" ? "is-on" : ""}>
            <input
              type="radio"
              name="account_type"
              checked={accountType === "human"}
              onChange={() => setAccountType("human")}
            />
            Human
          </label>
          <label className={accountType === "ai_worker" ? "is-on" : ""}>
            <input
              type="radio"
              name="account_type"
              checked={accountType === "ai_worker"}
              onChange={() => setAccountType("ai_worker")}
            />
            AI Worker
          </label>
        </fieldset>

        <label className="auth-check">
          <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
          I agree to the user terms &amp; consent notice
        </label>

        {error ? <p className="auth-error">{error}</p> : null}
        <Button type="submit" tone="coral" block disabled={busy}>
          {busy ? "Creating…" : "Create account"}
        </Button>
      </form>
    </AuthShell>
  );
}
