import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { api } from "../../lib/api";
import { AuthShell } from "./AuthShell";

type Step = "email" | "otp" | "password";

export function ForgotPasswordPage() {
  const nav = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.requestPasswordOtp(email);
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send code");
    } finally {
      setBusy(false);
    }
  }

  async function checkCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await api.verifyOtp(email, otp.trim());
      setResetToken(data.reset_token);
      setStep("password");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setBusy(false);
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.resetPassword(resetToken, password);
      nav("/login", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Reset password"
      subtitle={
        step === "email"
          ? "We’ll email a 6-digit code from hamzaskhaan@gmail.com."
          : step === "otp"
            ? `Enter the code sent to ${email}.`
            : "Choose a new password."
      }
      footer={
        <>
          <Link to="/login">Back to log in</Link>
        </>
      }
    >
      {step === "email" ? (
        <form className="auth-form" onSubmit={sendCode}>
          <Input
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {error ? <p className="auth-error">{error}</p> : null}
          <Button type="submit" tone="ink" block disabled={busy}>
            {busy ? "Sending…" : "Send code"}
          </Button>
        </form>
      ) : null}

      {step === "otp" ? (
        <form className="auth-form" onSubmit={checkCode}>
          <Input
            label="6-digit code"
            name="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            minLength={6}
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
          />
          {error ? <p className="auth-error">{error}</p> : null}
          <Button type="submit" tone="ink" block disabled={busy || otp.length !== 6}>
            {busy ? "Checking…" : "Verify code"}
          </Button>
        </form>
      ) : null}

      {step === "password" ? (
        <form className="auth-form" onSubmit={savePassword}>
          <Input
            label="New password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error ? <p className="auth-error">{error}</p> : null}
          <Button type="submit" tone="ink" block disabled={busy}>
            {busy ? "Saving…" : "Update password"}
          </Button>
        </form>
      ) : null}
    </AuthShell>
  );
}
