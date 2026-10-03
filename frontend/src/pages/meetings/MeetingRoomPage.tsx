import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Panel";
import { MeetStage } from "../../components/meetings/MeetStage";
import { api, isLoggedIn } from "../../lib/api";
import { authPath, rememberReturnTo } from "../../lib/sessionReturn";
import "./meetings.css";

type JoinPayload = { token: string; livekit_url: string; title?: string; role?: string };

export function MeetingRoomPage() {
  const loggedIn = isLoggedIn();
  const { meetingId = "" } = useParams();
  const nav = useNavigate();
  const [join, setJoin] = useState<JoinPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const returnTo = meetingId ? `/m/${meetingId}` : "/meetings";

  useEffect(() => {
    if (loggedIn || !meetingId) return;
    // Persist the share link so login/signup can send them back here.
    rememberReturnTo(returnTo);
  }, [loggedIn, meetingId, returnTo]);

  useEffect(() => {
    if (!loggedIn || !meetingId) return;
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError("");
      try {
        const data = await api.joinMeeting(meetingId);
        const payload: JoinPayload = {
          token: data.token,
          livekit_url: data.livekit_url,
          title: data.meeting.title,
          role: data.role,
        };
        sessionStorage.setItem(`hive_join_${meetingId}`, JSON.stringify(payload));
        if (!cancelled) setJoin(payload);
      } catch (err) {
        const cached = sessionStorage.getItem(`hive_join_${meetingId}`);
        if (cached && !cancelled) {
          setJoin(JSON.parse(cached));
        } else if (!cancelled) {
          setError(err instanceof Error ? err.message : "Join failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [meetingId, loggedIn]);

  if (!loggedIn) {
    return <Navigate to={authPath("login", returnTo)} replace />;
  }

  return (
    <div className="meet-page meet-page--room">
      <header className="meet-top">
        <Link to="/meetings" className="auth-brand">
          <span className="site-nav__mark" aria-hidden>
            ◉
          </span>{" "}
          Hive
        </Link>
        <div className="meet-top__actions">
          <Badge tone="sky">{join?.role ?? "…"}</Badge>
          <Button tone="ghost" size="sm" onClick={() => nav("/meetings")}>
            Leave
          </Button>
        </div>
      </header>

      <main className="meet-main meet-room meet-room--live">
        <div className="meet-room__head">
          <h1>{join?.title ?? "Meeting"}</h1>
          <p className="meet-room__id">
            Share{" "}
            <button
              type="button"
              className="meet-row__link"
              onClick={() => {
                const url = `${window.location.origin}/m/${meetingId}`;
                void navigator.clipboard.writeText(url);
              }}
            >
              /m/{meetingId}
            </button>
          </p>
        </div>

        {loading ? <p className="meet-status">Connecting to room…</p> : null}
        {error ? <p className="auth-error">{error}</p> : null}

        {join ? (
          <MeetStage
            serverUrl={join.livekit_url}
            token={join.token}
            onLeave={() => nav("/meetings")}
          />
        ) : null}
      </main>
    </div>
  );
}
