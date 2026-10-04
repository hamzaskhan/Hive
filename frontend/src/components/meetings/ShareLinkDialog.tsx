import { useEffect, useState } from "react";
import { Button } from "../ui/Button";

export function meetingJoinUrl(meetingId: string) {
  return `${window.location.origin}/m/${meetingId}`;
}

export function ShareLinkDialog({
  meetingId,
  open,
  onClose,
}: {
  meetingId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const url = meetingId ? meetingJoinUrl(meetingId) : "";

  useEffect(() => {
    if (!open) {
      setCopied(false);
      return;
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !url) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="share-modal" role="presentation">
      <button type="button" className="share-modal__backdrop" aria-label="Close" onClick={onClose} />
      <div
        className="share-modal__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
      >
        <h2 id="share-modal-title">Send this link to the people you want in the meeting</h2>
        <p>
          Copy the full link and paste it into a chat, email, or text. Anyone you send it to can
          open it, sign in, and join you.
        </p>
        <p className="share-modal__url">{url}</p>
        <div className="share-modal__actions">
          <Button type="button" tone="coral" onClick={() => void copy()}>
            {copied ? "Copied" : "Copy link"}
          </Button>
          <Button type="button" tone="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
