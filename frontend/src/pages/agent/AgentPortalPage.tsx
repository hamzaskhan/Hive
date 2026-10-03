import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  agentApi,
  agentAccessToken,
  clearAgentToken,
  setAgentToken,
} from "../../lib/api";
import "./agent-portal.css";

type Step = "id" | "secret" | "notes";

/**
 * AI-friendly portal for ChatGPT Dots / browser agents.
 * Plain steps, clear labels, markdown notes — no human chrome clutter.
 */
export function AgentPortalPage() {
  const [step, setStep] = useState<Step>("id");
  const [uniqueId, setUniqueId] = useState("");
  const [challengeToken, setChallengeToken] = useState("");
  const [secretQuestion, setSecretQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [label, setLabel] = useState("");
  const [meetingTitle, setMeetingTitle] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("");

  useEffect(() => {
    if (!agentAccessToken()) return;
    let cancelled = false;
    (async () => {
      try {
        const me = await agentApi.me();
        if (cancelled) return;
        setLabel(me.label);
        setMeetingTitle(me.meeting_title);
        setExpiresAt(me.expires_at);
        const md = await agentApi.notesMarkdown();
        if (cancelled) return;
        setMarkdown(md);
        setStep("notes");
      } catch {
        clearAgentToken();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submitId(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await agentApi.start(uniqueId.trim());
      setChallengeToken(data.challenge_token);
      setSecretQuestion(data.secret_question);
      setLabel(data.label);
      setMeetingTitle(data.meeting_title);
      setExpiresAt(data.expires_at);
      setHint(data.hint);
      setStep("secret");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unique ID rejected");
    } finally {
      setBusy(false);
    }
  }

  async function submitSecret(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await agentApi.verify(challengeToken, answer);
      setAgentToken(data.access_token);
      setLabel(data.label);
      setMeetingTitle(data.meeting_title);
      const md = await agentApi.notesMarkdown();
      setMarkdown(md);
      setStep("notes");
    } catch (err) {
      clearAgentToken();
      setChallengeToken("");
      setAnswer("");
      setStep("id");
      setError(
        err instanceof Error
          ? err.message
          : "Verification failed — account may be deleted",
      );
    } finally {
      setBusy(false);
    }
  }

  function downloadMd() {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hive-notes-${meetingTitle || "meeting"}.md`.replace(/\s+/g, "-");
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="agent-portal" data-agent-portal="true">
      <header className="agent-portal__header">
        <p className="agent-portal__brand">Hive · Agent portal</p>
        <p className="agent-portal__for">
          Agents: read <a href="/AGENTS.md">AGENTS.md</a> first, then follow the steps below.
          Humans issue invites at <Link to="/bots">/bots</Link>.
        </p>
      </header>

      <ol className="agent-portal__steps" aria-label="Login steps">
        <li className={step === "id" ? "is-current" : "is-done"}>1. Unique ID</li>
        <li
          className={
            step === "secret" ? "is-current" : step === "notes" ? "is-done" : ""
          }
        >
          2. Secret question
        </li>
        <li className={step === "notes" ? "is-current" : ""}>3. Markdown notes</li>
      </ol>

      {error ? (
        <p className="agent-portal__error" role="alert">
          {error}
        </p>
      ) : null}

      {step === "id" ? (
        <form className="agent-portal__card" onSubmit={submitId} data-step="unique-id">
          <h1>Step 1 — Enter unique ID</h1>
          <p>
            Paste the one-time <code>hive_bot_…</code> ID the human gave you. This ID can only be
            used once.
          </p>
          <label htmlFor="unique_id">
            Unique ID
            <input
              id="unique_id"
              name="unique_id"
              autoComplete="off"
              autoFocus
              required
              value={uniqueId}
              onChange={(e) => setUniqueId(e.target.value)}
              placeholder="hive_bot_…"
            />
          </label>
          <button type="submit" disabled={busy}>
            {busy ? "Checking…" : "Continue"}
          </button>
        </form>
      ) : null}

      {step === "secret" ? (
        <form className="agent-portal__card" onSubmit={submitSecret} data-step="secret-question">
          <h1>Step 2 — Secret question</h1>
          <p>
            Bot: <strong>{label}</strong> · Meeting: <strong>{meetingTitle}</strong>
          </p>
          <p className="agent-portal__warn">{hint}</p>
          <p className="agent-portal__question" data-secret-question="true">
            {secretQuestion}
          </p>
          <label htmlFor="secret_answer">
            Your answer
            <input
              id="secret_answer"
              name="secret_answer"
              autoComplete="off"
              autoFocus
              required
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
            />
          </label>
          <button type="submit" disabled={busy}>
            {busy ? "Verifying…" : "Verify (one attempt only)"}
          </button>
        </form>
      ) : null}

      {step === "notes" ? (
        <section className="agent-portal__card" data-step="notes">
          <h1>Step 3 — Meeting notes</h1>
          <p>
            Bot: <strong>{label}</strong> · Meeting: <strong>{meetingTitle}</strong>
            {expiresAt ? (
              <>
                {" "}
                · Expires: <time dateTime={expiresAt}>{new Date(expiresAt).toLocaleString()}</time>
              </>
            ) : null}
          </p>
          <div className="agent-portal__actions">
            <button type="button" onClick={downloadMd}>
              Download .md
            </button>
            <button
              type="button"
              className="agent-portal__ghost"
              onClick={() => {
                clearAgentToken();
                setMarkdown("");
                setUniqueId("");
                setStep("id");
              }}
            >
              Sign out
            </button>
          </div>
          <p>
            API for agents with a bearer token: <code>GET /agent/v1/notes.md</code>
          </p>          <pre className="agent-portal__markdown" data-notes-markdown="true">
            {markdown}
          </pre>
        </section>
      ) : null}
    </main>
  );
}
