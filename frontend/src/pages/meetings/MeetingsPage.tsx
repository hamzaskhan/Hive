import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Panel, Badge } from "../../components/ui/Panel";
import { api, clearTokens, isLoggedIn } from "../../lib/api";
import "./meetings.css";

type MeetingRow = {
  meeting_id: string;
  title: string;
  role: "owner" | "participant";
  tag: string;
  status: string;
  share_path: string;
  share_url: string;
  last_seen_at: string;
  created_at: string;
};

type MeetInfoView = {
  meeting_id: string;
  transcript_id: string;
  participants: Array<{
    user_id: string;
    display_name: string;
    role: string;
    joined_at: string;
  }>;
  audio_s3_url: string | null;
  audio_s3_key?: string | null;
  audio_status: string;
  egress_id?: string | null;
  transcript_shared?: boolean;
};

type SharePreview = {
  meeting_id: string;
  transcript_id: string;
  transcript_status: string;
  already_shared: boolean;
  shared_at: string | null;
  participants: Array<{
    user_id: string;
    display_name: string;
    email: string;
    role: string;
  }>;
};

type TranscriptView = {
  status: string;
  summary: string | null;
  text: string | null;
  action_items: string[];
  shared?: boolean;
};

type PanelKind = "info" | "share" | "notes";

function statusTone(status: string): "lime" | "coral" | "ink" | "sky" {
  if (status === "live") return "lime";
  if (status === "ended") return "ink";
  return "sky";
}

export function MeetingsPage() {
  const nav = useNavigate();
  const [title, setTitle] = useState("Product sync");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [rows, setRows] = useState<MeetingRow[]>([]);
  const [listError, setListError] = useState("");
  const [openPanel, setOpenPanel] = useState<{ id: string; kind: PanelKind } | null>(null);
  const [moreFor, setMoreFor] = useState<string | null>(null);
  const [infoById, setInfoById] = useState<Record<string, MeetInfoView | "loading" | "error">>({});
  const [notesById, setNotesById] = useState<
    Record<string, TranscriptView | "loading" | "error">
  >({});
  const [shareById, setShareById] = useState<
    Record<string, SharePreview | "loading" | "error" | "sharing">
  >({});

  const loadMine = useCallback(async () => {
    try {
      const data = await api.listMyMeetings();
      setRows(data.meetings);
      setListError("");
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Could not load meetings");
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn()) return;
    void loadMine();
  }, [loadMine]);

  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(""), 2200);
    return () => window.clearTimeout(t);
  }, [flash]);

  if (!isLoggedIn()) return <Navigate to="/login" replace />;

  function isOpen(id: string, kind: PanelKind) {
    return openPanel?.id === id && openPanel.kind === kind;
  }

  function togglePanel(id: string, kind: PanelKind) {
    setOpenPanel((prev) => (prev?.id === id && prev.kind === kind ? null : { id, kind }));
  }

  async function createRoom(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await api.createMeeting(title);
      const share =
        data.meeting.share_url || `${window.location.origin}${data.meeting.share_path}`;
      await navigator.clipboard.writeText(share).catch(() => undefined);
      setFlash("Room ready — share link copied");
      sessionStorage.setItem(
        `hive_join_${data.meeting.meeting_id}`,
        JSON.stringify({
          token: data.token,
          livekit_url: data.livekit_url,
          title: data.meeting.title,
        }),
      );
      await loadMine();
      nav(`/m/${data.meeting.meeting_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create meeting");
    } finally {
      setBusy(false);
    }
  }

  async function openDetails(meetingId: string) {
    togglePanel(meetingId, "info");
    if (infoById[meetingId] && infoById[meetingId] !== "error") return;
    setInfoById((prev) => ({ ...prev, [meetingId]: "loading" }));
    try {
      const info = await api.getMeetInfo(meetingId);
      setInfoById((prev) => ({ ...prev, [meetingId]: info }));
    } catch {
      setInfoById((prev) => ({ ...prev, [meetingId]: "error" }));
    }
  }

  async function downloadAudio(meetingId: string) {
    try {
      const data = await api.downloadAudio(meetingId);
      const a = document.createElement("a");
      a.href = data.download_url;
      a.download = data.filename || `${meetingId}-recording.ogg`;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setFlash("Download started");
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Could not download audio");
    }
  }

  async function summarizeMeeting(meetingId: string) {
    setOpenPanel({ id: meetingId, kind: "notes" });
    setNotesById((prev) => ({ ...prev, [meetingId]: "loading" }));
    try {
      const data = await api.summarizeMeeting(meetingId);
      setNotesById((prev) => ({
        ...prev,
        [meetingId]: {
          status: data.status,
          summary: data.summary,
          text: data.text,
          action_items: data.action_items || [],
          shared: data.shared,
        },
      }));
      setFlash("Summary ready");
    } catch (err) {
      setNotesById((prev) => ({ ...prev, [meetingId]: "error" }));
      setListError(err instanceof Error ? err.message : "Summarize failed");
    }
  }

  async function openShareSheet(meetingId: string) {
    setOpenPanel({ id: meetingId, kind: "share" });
    setShareById((prev) => ({ ...prev, [meetingId]: "loading" }));
    try {
      const preview = await api.previewShareTranscript(meetingId);
      setShareById((prev) => ({ ...prev, [meetingId]: preview }));
    } catch (err) {
      setShareById((prev) => ({ ...prev, [meetingId]: "error" }));
      setListError(err instanceof Error ? err.message : "Could not open share sheet");
    }
  }

  async function confirmShare(meetingId: string) {
    setShareById((prev) => ({ ...prev, [meetingId]: "sharing" }));
    try {
      const result = await api.shareTranscript(meetingId);
      setShareById((prev) => ({
        ...prev,
        [meetingId]: {
          meeting_id: result.meeting_id,
          transcript_id: result.transcript_id,
          transcript_status: result.transcript.status,
          already_shared: true,
          shared_at: result.shared_at,
          participants: result.shared_with,
        },
      }));
      setNotesById((prev) => ({
        ...prev,
        [meetingId]: {
          status: result.transcript.status,
          summary: result.transcript.summary,
          text: result.transcript.text,
          action_items: result.transcript.action_items || [],
          shared: true,
        },
      }));
      setFlash("Transcript shared with participants");
    } catch (err) {
      setShareById((prev) => ({ ...prev, [meetingId]: "error" }));
      setListError(err instanceof Error ? err.message : "Share failed");
    }
  }

  async function viewTranscript(meetingId: string) {
    setOpenPanel({ id: meetingId, kind: "notes" });
    setNotesById((prev) => ({ ...prev, [meetingId]: "loading" }));
    try {
      const data = await api.getTranscript(meetingId);
      setNotesById((prev) => ({
        ...prev,
        [meetingId]: {
          status: data.status,
          summary: data.summary,
          text: data.text,
          action_items: data.action_items || [],
          shared: data.shared,
        },
      }));
    } catch (err) {
      setNotesById((prev) => ({ ...prev, [meetingId]: "error" }));
      setListError(err instanceof Error ? err.message : "Could not load transcript");
    }
  }

  async function copyLink(row: MeetingRow) {
    const url = row.share_url || `${window.location.origin}${row.share_path}`;
    await navigator.clipboard.writeText(url).catch(() => undefined);
    setFlash("Link copied");
  }

  return (
    <div className="meet-page">
      <header className="meet-top">
        <Link to="/" className="auth-brand">
          <span className="site-nav__mark" aria-hidden>
            ◉
          </span>{" "}
          Hive
        </Link>
        <div className="meet-top__actions">
          <Button tone="sky" size="sm" to="/bots">
            Invite bot
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
        <section className="meet-intro anim-in">
          <Badge tone="lime">Your rooms</Badge>
          <h1>Meetings</h1>
          <p>Create a room, share the link, then summarize and share notes with everyone who joined.</p>
        </section>

        <Panel className="meet-create anim-pop">
          <form className="meet-create__form" onSubmit={createRoom}>
            <Input
              label="New meeting title"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            {error ? <p className="auth-error">{error}</p> : null}
            <Button type="submit" tone="coral" block disabled={busy}>
              {busy ? "Creating…" : "Create & join"}
            </Button>
          </form>
        </Panel>

        <section className="meet-list">
          <div className="meet-list__head">
            <div>
              <h2>All meetings</h2>
              <p className="meet-list__sub">
                {rows.length === 0 ? "Nothing here yet" : `${rows.length} room${rows.length === 1 ? "" : "s"}`}
              </p>
            </div>
            <Button tone="ghost" size="sm" type="button" onClick={() => void loadMine()}>
              Refresh
            </Button>
          </div>

          {listError ? <p className="auth-error">{listError}</p> : null}

          {rows.length === 0 && !listError ? (
            <div className="meet-empty">
              <p>Start a room above, or open a share link someone sent you.</p>
            </div>
          ) : null}

          <div className="meet-rows">
            {rows.map((row) => {
              const info = infoById[row.meeting_id];
              const shareSheet = shareById[row.meeting_id];
              const notes = notesById[row.meeting_id];
              const showInfo = isOpen(row.meeting_id, "info");
              const showShare = isOpen(row.meeting_id, "share");
              const showNotes = isOpen(row.meeting_id, "notes");

              return (
                <Panel key={row.meeting_id} className="meet-row anim-pop">
                  <div className="meet-row__top">
                    <div className="meet-row__identity">
                      <h3>{row.title}</h3>
                      <div className="meet-row__badges">
                        <Badge tone={row.role === "owner" ? "coral" : "sky"}>{row.tag}</Badge>
                        <Badge tone={statusTone(row.status)}>{row.status}</Badge>
                      </div>
                    </div>
                  </div>

                  <div className="meet-row__bar">
                    <Link className="meet-row__join" to={`/m/${row.meeting_id}`}>
                      {row.status === "ended" ? "Open" : "Join"}
                    </Link>
                    <nav className="meet-row__links" aria-label={`${row.title} actions`}>
                      <button
                        type="button"
                        className={showNotes ? "is-on" : ""}
                        onClick={() => void viewTranscript(row.meeting_id)}
                      >
                        Notes
                      </button>
                      <button
                        type="button"
                        className={showInfo ? "is-on" : ""}
                        onClick={() => void openDetails(row.meeting_id)}
                      >
                        Details
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyLink(row)}
                      >
                        Copy link
                      </button>
                      {row.role === "owner" ? (
                        <button
                          type="button"
                          className={showShare ? "is-on" : ""}
                          onClick={() => void openShareSheet(row.meeting_id)}
                        >
                          Share
                        </button>
                      ) : null}
                      {row.role === "owner" ? (
                        <div className="meet-more">
                          <button
                            type="button"
                            aria-expanded={moreFor === row.meeting_id}
                            onClick={() =>
                              setMoreFor((id) => (id === row.meeting_id ? null : row.meeting_id))
                            }
                          >
                            More
                          </button>
                          {moreFor === row.meeting_id ? (
                            <div className="meet-more__menu" role="menu">
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setMoreFor(null);
                                  void summarizeMeeting(row.meeting_id);
                                }}
                              >
                                Summarize
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setMoreFor(null);
                                  void downloadAudio(row.meeting_id);
                                }}
                              >
                                Download audio
                              </button>
                              <Link role="menuitem" to={`/bots?meeting=${row.meeting_id}`}>
                                Invite bot
                              </Link>
                              {row.status !== "ended" ? (
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="is-danger"
                                  onClick={async () => {
                                    setMoreFor(null);
                                    try {
                                      await api.endMeeting(row.meeting_id);
                                      setFlash("Meeting ended — audio saving");
                                      await loadMine();
                                    } catch (err) {
                                      setListError(
                                        err instanceof Error ? err.message : "Could not end meeting",
                                      );
                                    }
                                  }}
                                >
                                  End meeting
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </nav>
                  </div>

                  {showInfo ? (
                    <div className="meet-drawer">
                      {info === "loading" ? <p className="meet-drawer__muted">Loading details…</p> : null}
                      {info === "error" ? <p className="auth-error">Could not load details</p> : null}
                      {info && info !== "loading" && info !== "error" ? (
                        <div className="meet-details">
                          <div className="meet-details__grid">
                            <div>
                              <span className="meet-details__label">Audio</span>
                              <strong>{info.audio_status}</strong>
                            </div>
                            <div>
                              <span className="meet-details__label">Notes</span>
                              <strong>
                                {info.transcript_shared ? "Shared" : "Owner only"}
                              </strong>
                            </div>
                            <div>
                              <span className="meet-details__label">People</span>
                              <strong>{info.participants.length}</strong>
                            </div>
                          </div>
                          <ul className="meet-people">
                            {info.participants.length === 0 ? (
                              <li className="meet-drawer__muted">No one has joined yet.</li>
                            ) : (
                              info.participants.map((p) => (
                                <li key={p.user_id}>
                                  <span>{p.display_name}</span>
                                  <Badge tone={p.role === "owner" ? "coral" : "sky"}>{p.role}</Badge>
                                </li>
                              ))
                            )}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {showShare ? (
                    <div className="meet-drawer meet-drawer--share">
                      {shareSheet === "loading" ? (
                        <p className="meet-drawer__muted">Loading participants…</p>
                      ) : null}
                      {shareSheet === "sharing" ? (
                        <p className="meet-drawer__muted">Sharing…</p>
                      ) : null}
                      {shareSheet === "error" ? (
                        <p className="auth-error">Could not load share sheet</p>
                      ) : null}
                      {shareSheet &&
                      shareSheet !== "loading" &&
                      shareSheet !== "error" &&
                      shareSheet !== "sharing" ? (
                        <>
                          <div className="meet-share-sheet__head">
                            <h4>Share notes with</h4>
                            <Badge tone={shareSheet.already_shared ? "lime" : "ink"}>
                              {shareSheet.already_shared ? "Shared" : "Private"}
                            </Badge>
                          </div>
                          {shareSheet.participants.length === 0 ? (
                            <p className="meet-drawer__muted">
                              No participants yet — they appear after someone joins.
                            </p>
                          ) : (
                            <ul className="meet-share-sheet__list">
                              {shareSheet.participants.map((p) => (
                                <li key={p.user_id}>
                                  <div>
                                    <span className="meet-share-sheet__name">{p.display_name}</span>
                                    <span className="meet-share-sheet__email">{p.email}</span>
                                  </div>
                                  <Badge tone={p.role === "owner" ? "coral" : "sky"}>{p.role}</Badge>
                                </li>
                              ))}
                            </ul>
                          )}
                          <div className="meet-share-sheet__actions">
                            {!shareSheet.already_shared ? (
                              <Button
                                tone="coral"
                                type="button"
                                disabled={shareSheet.participants.length === 0}
                                onClick={() => void confirmShare(row.meeting_id)}
                              >
                                Confirm share
                              </Button>
                            ) : (
                              <p className="meet-share-sheet__note">
                                Participants can open Notes on their meetings list.
                              </p>
                            )}
                            <Button
                              tone="ghost"
                              size="sm"
                              type="button"
                              onClick={() => setOpenPanel(null)}
                            >
                              Close
                            </Button>
                          </div>
                        </>
                      ) : null}
                    </div>
                  ) : null}

                  {showNotes ? (
                    <div className="meet-drawer meet-drawer--notes">
                      {notes === "loading" ? (
                        <p className="meet-drawer__muted">Loading notes…</p>
                      ) : null}
                      {notes === "error" ? (
                        <p className="auth-error">
                          {row.role === "participant"
                            ? "Notes aren’t shared yet — ask the owner to share."
                            : "Notes unavailable"}
                        </p>
                      ) : null}
                      {notes && notes !== "loading" && notes !== "error" ? (
                        <article className="meet-notes">
                          <header className="meet-notes__head">
                            <h4>Meeting notes</h4>
                            <Badge tone={notes.shared ? "lime" : "ink"}>
                              {notes.shared ? "Shared" : notes.status}
                            </Badge>
                          </header>
                          <p className="meet-notes__summary">
                            {notes.summary ||
                              (row.role === "owner"
                                ? "No summary yet — hit Summarize after the call."
                                : "No summary yet.")}
                          </p>
                          {notes.action_items?.length ? (
                            <div className="meet-notes__actions">
                              <span className="meet-details__label">Action items</span>
                              <ul>
                                {notes.action_items.map((item) => (
                                  <li key={item}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                          {notes.text ? (
                            <details className="meet-notes__transcript">
                              <summary>Full transcript</summary>
                              <p>{notes.text}</p>
                            </details>
                          ) : null}
                        </article>
                      ) : null}
                    </div>
                  ) : null}
                </Panel>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
