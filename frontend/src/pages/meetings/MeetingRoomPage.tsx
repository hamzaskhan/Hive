import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Panel";
import { MeetStage } from "../../components/meetings/MeetStage";
import { ShareLinkDialog } from "../../components/meetings/ShareLinkDialog";
import { api, isLoggedIn } from "../../lib/api";
import { authPath, rememberReturnTo } from "../../lib/sessionReturn";
import endedArt from "../../assets/meeting-ended.jpg";
import "./meetings.css";

type JoinPayload = { token: string; livekit_url: string; title?: string; role?: string };

export function MeetingRoomPage() {
  const loggedIn = isLoggedIn();
  const { meetingId = "" } = useParams();
  const nav = useNavigate();
  const location = useLocation();
  const [join, setJoin] = useState<JoinPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);

  const returnTo = meetingId ? `/m/${meetingId}` : "/meetings";

  useEffect(() => {
    const state = location.state as { showShare?: boolean } | null;
    if (!state?.showShare) return;
    setShareOpen(true);
    nav(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, nav]);

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
        const message = err instanceof Error ? err.message : "Join failed";
        const ended = /ended/i.test(message);
        if (ended) sessionStorage.removeItem(`hive_join_${meetingId}`);
        const cached = ended ? null : sessionStorage.getItem(`hive_join_${meetingId}`);
        if (cached && !cancelled) {
          setJoin(JSON.parse(cached));
        } else if (!cancelled) {
          setError(message);
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

  if (!loading && /ended/i.test(error)) {
    return (
      <div className="meet-page meet-ended">
        <header className="meet-top">
          <Link to="/meetings" className="auth-brand">
            <span className="site-nav__mark" aria-hidden>
              ◉
            </span>{" "}
            Hive
          </Link>
        </header>
        <main className="meet-ended__main">
          <figure className="meet-ended__art">
            <img src={endedArt} alt="A sleepy goat and a waving figure under a full moon" />
          </figure>
          <div className="meet-ended__copy">
            <h1>This meeting has ended</h1>
            <p>
              The call is over, so there is nothing left to join. Head back to your meetings. If the
              host shared the notes, they will be waiting there.
            </p>
            <Button to="/meetings" tone="ink">
              Back to meetings
            </Button>
          </div>
        </main>
      </div>
    );
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
            <button type="button" className="meet-row__link" onClick={() => setShareOpen(true)}>
              Share this meeting
            </button>
          </p>
        </div>

        {loading ? <p className="meet-status">Connecting you to the meeting.</p> : null}
        {error ? <p className="auth-error">{error}</p> : null}

        {join ? (
          <MeetStage
            serverUrl={join.livekit_url}
            token={join.token}
            onLeave={() => nav("/meetings")}
          />
        ) : null}
      </main>
      <ShareLinkDialog meetingId={meetingId} open={shareOpen} onClose={() => setShareOpen(false)} />
    </div>
  );
}
