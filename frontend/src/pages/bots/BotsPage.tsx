import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Panel, Badge } from "../../components/ui/Panel";
import { api, clearTokens, isLoggedIn } from "../../lib/api";
import "../meetings/meetings.css";
import "./bots.css";

type MeetingOpt = { meeting_id: string; title: string; role: string };

type BotRow = {
  agent_account_id: string;
  meeting_id: string;
  meeting_title: string | null;
  label: string;
  secret_question: string;
  status: string;
  expires_at: string;
  verified_at: string | null;
  created_at: string;
};

type IssuedInvite = {
  unique_id: string;
  instructions: string;
  portal_url: string;
  label: string;
};

export function BotsPage() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const presetMeeting = params.get("meeting") || "";

  const [meetings, setMeetings] = useState<MeetingOpt[]>([]);
  const [bots, setBots] = useState<BotRow[]>([]);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<IssuedInvite | null>(null);

  const [meetingId, setMeetingId] = useState(presetMeeting);
  const [label, setLabel] = useState("Research Dot");
  const [question, setQuestion] = useState("What project codeword did we agree on?");
  const [answer, setAnswer] = useState("");
  const [ttlHours, setTtlHours] = useState(24);

  const ownedMeetings = useMemo(
    () => meetings.filter((m) => m.role === "owner"),
    [meetings],
  );

  const load = useCallback(async () => {
    try {
      const [mine, accounts] = await Promise.all([
        api.listMyMeetings(),
        api.listAgentAccounts(),
      ]);
      setMeetings(mine.meetings);
      setBots(accounts.accounts);
      setError("");
      setMeetingId((prev) => {
        if (prev) return prev;
        const firstOwner = mine.meetings.find((m) => m.role === "owner");
        return firstOwner?.meeting_id || "";
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load bot accounts");
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn()) return;
    void load();
  }, [load]);

  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(""), 2500);
    return () => window.clearTimeout(t);
  }, [flash]);

  if (!isLoggedIn()) return <Navigate to="/login" replace />;

  async function createBot(e: FormEvent) {
    e.preventDefault();
    if (!meetingId) {
      setError("Pick a meeting you own");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = await api.createAgentAccount({
        meeting_id: meetingId,
        label,
        secret_question: question,
        secret_answer: answer,
        ttl_hours: ttlHours,
      });
      setIssued({
        unique_id: data.unique_id,
        instructions: data.instructions,
        portal_url: data.agent_portal_url,
        label: data.account.label,
      });
      setAnswer("");
      setFlash("Bot invite created — copy the unique ID now (shown once)");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create bot account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="meet-page">
      <header className="meet-top">
        <Link to="/meetings" className="auth-brand">
          <span className="site-nav__mark" aria-hidden>
            ◉
          </span>{" "}
          Hive
        </Link>
        <div className="meet-top__actions">
          <Button tone="ghost" size="sm" to="/agent">
            Agent portal
          </Button>
          <Button
            tone="ghost"
            size="sm"
            onClick={() => {
              clearTokens();
              nav("/");
            }}
          >
            Log out
          </Button>
        </div>
      </header>

      {flash ? (
        <div className="meet-flash" role="status">
          {flash}
        </div>
      ) : null}

      <main className="meet-main meet-main--wide">
        <Link to="/meetings" className="bots-back">
          ← Back to meetings
        </Link>
        <section className="meet-intro anim-in">
          <Badge tone="sky">Bot IAM</Badge>
          <h1>Invite a Dot</h1>
          <p>
            Mint a one-time sub-account for a browser agent (ChatGPT Dot, etc.). They log into the
            agent portal with the unique ID, answer your secret question once, then read meeting
            notes as markdown. Wrong answer burns the invite. Access expires automatically.
          </p>
        </section>

        <Panel className="bots-create anim-pop">
          <form className="meet-create__form" onSubmit={createBot}>
            <label className="ui-field">
              <span className="ui-field__label">Meeting</span>
              <select
                className="ui-input bots-select"
                value={meetingId}
                onChange={(e) => setMeetingId(e.target.value)}
                required
              >
                <option value="" disabled>
                  Select a meeting you own
                </option>
                {ownedMeetings.map((m) => (
                  <option key={m.meeting_id} value={m.meeting_id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </label>
            <Input
              label="Bot label"
              name="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
            />
            <Input
              label="Secret question"
              name="secret_question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              required
            />
            <Input
              label="Secret answer (agent must match)"
              name="secret_answer"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              required
            />
            <label className="ui-field">
              <span className="ui-field__label">Expires in (hours)</span>
              <input
                className="ui-input"
                type="number"
                min={1}
                max={168}
                value={ttlHours}
                onChange={(e) => setTtlHours(Number(e.target.value) || 24)}
              />
            </label>
            {error ? <p className="auth-error">{error}</p> : null}
            <Button type="submit" tone="coral" block disabled={busy || ownedMeetings.length === 0}>
              {busy ? "Creating…" : "Generate one-time bot ID"}
            </Button>
          </form>
        </Panel>

        {issued ? (
          <Panel tone="lime" className="bots-issued anim-pop">
            <h2>Show this to your agent once</h2>
            <p className="bots-issued__id">
              <code>{issued.unique_id}</code>
            </p>
            <div className="bots-issued__actions">
              <Button
                tone="ink"
                size="sm"
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(issued.unique_id);
                  setFlash("Unique ID copied");
                }}
              >
                Copy unique ID
              </Button>
              <Button
                tone="ghost"
                size="sm"
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(issued.instructions);
                  setFlash("Instructions copied");
                }}
              >
                Copy instructions
              </Button>
            </div>
            <pre className="bots-issued__instructions">{issued.instructions}</pre>
            <p className="bots-issued__note">
              Portal: <Link to="/agent">{issued.portal_url || "/agent"}</Link>. The unique ID is not
              stored in plaintext and will not be shown again.
            </p>
          </Panel>
        ) : null}

        <section className="meet-list">
          <div className="meet-list__head">
            <div>
              <h2>Your bot accounts</h2>
              <p className="meet-list__sub">{bots.length} invite{bots.length === 1 ? "" : "s"}</p>
            </div>
            <Button tone="ghost" size="sm" type="button" onClick={() => void load()}>
              Refresh
            </Button>
          </div>

          {bots.length === 0 ? (
            <div className="meet-empty">
              <p>No bot invites yet. Create one above after you own a meeting.</p>
            </div>
          ) : (
            <div className="meet-rows">
              {bots.map((bot) => (
                <Panel key={bot.agent_account_id} className="meet-row">
                  <div className="meet-row__top">
                    <div className="meet-row__identity">
                      <h3>{bot.label}</h3>
                      <div className="meet-row__badges">
                        <Badge
                          tone={
                            bot.status === "active"
                              ? "lime"
                              : bot.status === "pending"
                                ? "sky"
                                : "ink"
                          }
                        >
                          {bot.status}
                        </Badge>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="bots-revoke"
                      onClick={async () => {
                        try {
                          await api.revokeAgentAccount(bot.agent_account_id);
                          setFlash("Bot account revoked");
                          await load();
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "Revoke failed");
                        }
                      }}
                    >
                      Revoke
                    </button>
                  </div>
                  <p className="meet-row__meta">
                    {bot.meeting_title || bot.meeting_id} · expires{" "}
                    {new Date(bot.expires_at).toLocaleString()}
                  </p>
                  <p className="bots-q">Q: {bot.secret_question}</p>
                </Panel>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
