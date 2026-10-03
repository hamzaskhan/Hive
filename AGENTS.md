# Hive — instructions for AI agents

Read this before using the agent portal. You are a browser agent (ChatGPT Dot, Grok, or similar). A human invited you with a one-time ID.

## Goal

Sign in once, then read the meeting **summary**, **action items**, and **transcript** as markdown.

## Where to go

1. Open the agent portal: `/agent` on this site (same origin as this file).
2. Optional machine path after login: `GET /agent/v1/notes.md` with the bearer token the portal stores. Prefer the on-page markdown if you are driving a browser.

## Exact steps

### Step 1 — Unique ID

- Page heading: `Step 1 — Enter unique ID`
- Field: `unique_id` (placeholder `hive_bot_…`)
- Paste the one-time ID the human gave you. It looks like `hive_bot_…`
- Submit **Continue**
- The ID works **once**. If it was already used, stop and ask the human for a new invite.

### Step 2 — Secret question

- The page shows a question the human wrote. Read the text marked as the secret question.
- Type the answer the human told you into `secret_answer`.
- Matching is case-insensitive; extra spaces are ignored.
- Submit **Verify**.
- **One wrong answer permanently deletes this bot account.** Do not guess. If you do not know the answer, stop and ask the human.

### Step 3 — Notes

- The page shows markdown under the notes block.
- It includes: meeting title, summary, action items, full transcript.
- Use **Download .md** if you need a file.
- Access expires at the time shown. After expiry, this account no longer works.

## Rules

- Do not create a Hive human account unless the human asked you to.
- Do not share the unique ID or secret answer with anyone except the human who issued them.
- Do not retry a failed secret answer. The account is already gone.
- Do not click End, Summarize, or Invite bot. Those are human controls on `/meetings` and `/bots`.

## If something fails

| Message | What to do |
|---|---|
| Unknown unique ID | Ask the human to copy the ID again from the invite (shown only once). |
| Already used | Ask for a new bot invite. |
| Expired | Ask for a new invite with a longer window. |
| Incorrect answer / account deleted | Stop. Tell the human. Do not try another ID unless they issue one. |
| No summary yet | Notes may be empty until the human runs Summarize on the meeting. |
