# CAPTURE-TEST

## Tool and model (step 1)

- **Tool:** Cursor (Agent chat)
- **Models:** Session 1 reported `default` (Composer / Auto agent). Session 2 reported `grok-4.7`. Planning and execution run in the same agent turn; Task subagents can use other models when spawned.
- **Auto mechanism:** Yes — Cursor project Hooks (`beforeSubmitPrompt` + `afterAgentResponse`)

## Mechanism and config changed

- **Mechanism:** Cursor Hooks — command hooks fire automatically on every user prompt submit and every final agent response. Script appends only prompt + final response (no thinking, no tool calls) to `.agent-logs/`.
- **Config file:** `.cursor/hooks.json`
- **Capture script:** `.cursor/hooks/capture.js`
- **Also checked:** Cursor session transcripts under `~/.cursor/projects/.../agent-transcripts/` (include tool calls/thinking — not used as the primary capture path). Cursor Hooks docs confirm `beforeSubmitPrompt` / `afterAgentResponse` exist and reload from project `.cursor/hooks.json` in trusted workspaces.

## Log file paths (canaries landed here)

- Session 1: `.agent-logs/2026-10-03_07-41-28_d7ce8c29-e358-4a60-9d03-39fc5a7e627d.md`
- Session 2: `.agent-logs/2026-10-03_07-42-50_6bf72f88-c84e-4d53-b8a8-49b356d0db66.md`

## Canary entries (raw)

### Canary 1 — session `d7ce8c29`

```
[LOG_ENTRY type=PROMPT num=1 session=d7ce8c29]
timestamp: 2026-10-03T07:41:37.795Z
model: default

CAPTURE TEST â€” 8x assignment, hamzaskhan

[LOG_ENTRY type=RESPONSE num=1 session=d7ce8c29]
timestamp: 2026-10-03T07:42:12.909Z
model: default

**Canary 1 prompt landed.** Auto-capture is working.

Log file: `.agent-logs/2026-10-03_07-41-28_d7ce8c29-e358-4a60-9d03-39fc5a7e627d.md`

- PROMPT num=1: `CAPTURE TEST â€” 8x assignment, hamzaskhan` (em dash may show as mojibake â€” known Cursor Windows stdin UTF-8 issue; ASCII content is intact)
- This reply should append as RESPONSE num=1 when the turn ends

**Next:** open a **new** Agent chat in this repo and send exactly:

```text
CAPTURE TEST â€” 8x assignment, hamzaskhan â€” session 2
```

Do not start the assignment yet. After session 2 lands, I will write `CAPTURE-TEST.md`.
```

### Canary 2 — session `6bf72f88` (separate conversation)

```
[LOG_ENTRY type=PROMPT num=1 session=6bf72f88]
timestamp: 2026-10-03T07:42:50.355Z
model: grok-4.7

CAPTURE TEST â€” 8x assignment, hamzaskhan â€” session 2

[LOG_ENTRY type=RESPONSE num=1 session=6bf72f88]
timestamp: 2026-10-03T07:43:22.727Z
model: grok-4.7

**Session 2 canary landed** in a new conversation, separate from session 1.

Log file: `.agent-logs/2026-10-03_07-42-50_6bf72f88-c84e-4d53-b8a8-49b356d0db66.md`

- Session id: `6bf72f88` (session 1 was `d7ce8c29`)
- PROMPT num=1: `CAPTURE TEST â€” 8x assignment, hamzaskhan â€” session 2` (the em dash may show as mojibake in the log; the ASCII text is intact)
- This reply should append as RESPONSE num=1 when the turn ends

Capture is working across two sessions. The assignment has not been started. Go back to the first chat and say the new-session canary landed; that chat will write `CAPTURE-TEST.md`.
```

## What did not work first

1. **UTF-8 BOM on Windows stdin.** First real hook runs fired (`beforeSubmitPrompt` / `afterAgentResponse` visible in Cursor Hooks output channel) but `capture.js` failed with `Unexpected token '﻿'` because Cursor prefixes hook stdin with a BOM. Fixed by stripping U+FEFF before `JSON.parse`.
2. **Same-chat “session 2”.** Sending the session-2 canary in the original thread only appended to `d7ce8c29` (PROMPT num=2). Required a true **New Agent Chat** to prove cross-session install — that produced `6bf72f88-…md`.
3. **Em dash mojibake.** Non-ASCII characters in prompts (e.g. `—`) arrive corrupted on Windows hook stdin (`â€”`). Known Cursor-on-Windows hooks UTF-8 issue; ASCII canary text remains readable and unambiguous.
4. **Early parse failure before first successful write.** Until the BOM fix, `.agent-logs/` stayed empty despite hooks executing. After the fix, the prior turn’s `afterAgentResponse` wrote an orphan `RESPONSE num=0` (honest debris left in the log).
