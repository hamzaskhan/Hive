#!/usr/bin/env node
/**
 * Cursor agent capture hook.
 * Fires on beforeSubmitPrompt and afterAgentResponse.
 * Writes prompt + final response only to .agent-logs/
 */
const fs = require("fs");
const path = require("path");

const AUTHOR = "hamzaskhan";
const TOOL = "cursor";
const PROJECT = "Fathom_Clone";

function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => chunks.push(c));
    process.stdin.on("end", () => {
      // Cursor on Windows prefixes stdin JSON with a UTF-8 BOM
      let s = chunks.join("");
      if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
      resolve(s);
    });
    process.stdin.on("error", reject);
  });
}

function resolveWorkspaceRoot(input) {
  const envRoot = process.env.CURSOR_PROJECT_DIR || process.env.CLAUDE_PROJECT_DIR;
  if (envRoot && fs.existsSync(envRoot)) return envRoot;
  if (process.cwd() && fs.existsSync(process.cwd())) return process.cwd();

  const raw =
    (Array.isArray(input.workspace_roots) && input.workspace_roots[0]) || "";
  // Cursor may send "/C:/Users/..." — normalize to a real Windows path
  let p = String(raw);
  if (/^\/[A-Za-z]:\//.test(p)) p = p.slice(1);
  p = p.replace(/\//g, path.sep);
  return p || process.cwd();
}

function utcNow() {
  return new Date().toISOString();
}

function formatSessionStamp(date) {
  // YYYY-MM-DD_HH-MM-SS in UTC
  const iso = date.toISOString();
  return iso.slice(0, 19).replace("T", "_").replace(/:/g, "-");
}

function shortSession(id) {
  return String(id || "unknown").slice(0, 8);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function loadMap(mapPath) {
  try {
    return JSON.parse(fs.readFileSync(mapPath, "utf8"));
  } catch {
    return {};
  }
}

function saveMap(mapPath, map) {
  fs.writeFileSync(mapPath, JSON.stringify(map, null, 2), "utf8");
}

function escapeFrontmatterValue(v) {
  return String(v ?? "").replace(/\r?\n/g, " ");
}

function buildHeader(meta) {
  return [
    "---",
    `session_id: ${meta.session_id}`,
    `date: ${meta.date}`,
    `author: ${meta.author}`,
    `model: ${meta.model}`,
    `tool: ${meta.tool}`,
    `project: ${meta.project}`,
    `total_exchanges: ${meta.total_exchanges}`,
    `first_prompt_time: ${meta.first_prompt_time}`,
    `last_prompt_time: ${meta.last_prompt_time}`,
    "---",
    "",
    `# Session Log - ${meta.date}`,
    "",
    `Session: \`${shortSession(meta.session_id)}\` | Project: \`${meta.project}\` | Author: \`${meta.author}\``,
    "",
    "---",
    "",
  ].join("\n");
}

function parseExisting(content) {
  const meta = {};
  const fm = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (fm) {
    for (const line of fm[1].split("\n")) {
      const idx = line.indexOf(":");
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      meta[key] = val;
    }
  }

  // Body is LOG_ENTRY sections only; decorative header is always regenerated
  const entryIdx = content.indexOf("[LOG_ENTRY");
  const body = entryIdx === -1 ? "" : content.slice(entryIdx);
  return { meta: fm ? meta : null, body };
}

function countPrompts(body) {
  const re = /\[LOG_ENTRY type=PROMPT num=(\d+)/g;
  let max = 0;
  let m;
  while ((m = re.exec(body)) !== null) {
    max = Math.max(max, Number(m[1]));
  }
  return max;
}

function upsertFile(filePath, meta, body) {
  const header = buildHeader(meta);
  fs.writeFileSync(filePath, header + body.replace(/^\n+/, ""), "utf8");
}

function replaceOrAppendResponse(body, num, sessionShort, timestamp, model, text) {
  const entry = [
    `[LOG_ENTRY type=RESPONSE num=${num} session=${sessionShort}]`,
    `timestamp: ${timestamp}`,
    `model: ${escapeFrontmatterValue(model)}`,
    "",
    text,
    "",
    "",
  ].join("\n");

  const re = new RegExp(
    `\\[LOG_ENTRY type=RESPONSE num=${num} session=${sessionShort}\\][\\s\\S]*?(?=\\[LOG_ENTRY type=|$)`
  );
  if (re.test(body)) {
    return body.replace(re, entry);
  }
  return body.replace(/\s*$/, "\n\n") + entry;
}

async function main() {
  const raw = await readStdin();
  let input;
  try {
    input = JSON.parse(raw || "{}");
  } catch (err) {
    process.stderr.write(`capture.js: invalid JSON stdin: ${err.message}\n`);
    // fail open
    if ((raw || "").includes("beforeSubmitPrompt") || process.argv.includes("--prompt")) {
      process.stdout.write(JSON.stringify({ continue: true }));
    }
    process.exit(0);
  }

  const event = input.hook_event_name || "";
  const conversationId =
    input.conversation_id || input.session_id || "unknown-session";
  const model = input.model_id || input.model || "unknown";
  const workspaceRoot = resolveWorkspaceRoot(input);

  const logsDir = path.join(workspaceRoot, ".agent-logs");
  const mapPath = path.join(logsDir, ".session-map.json");
  ensureDir(logsDir);

  const map = loadMap(mapPath);
  const now = utcNow();
  const sessionShort = shortSession(conversationId);

  if (event === "beforeSubmitPrompt") {
    const prompt = input.prompt == null ? "" : String(input.prompt);
    let entry = map[conversationId];

    if (!entry) {
      const stamp = formatSessionStamp(new Date());
      const filename = `${stamp}_${conversationId}.md`;
      entry = {
        filename,
        first_prompt_time: now,
        date: now.slice(0, 10),
      };
      map[conversationId] = entry;
      saveMap(mapPath, map);

      const meta = {
        session_id: conversationId,
        date: entry.date,
        author: AUTHOR,
        model,
        tool: TOOL,
        project: PROJECT,
        total_exchanges: 1,
        first_prompt_time: now,
        last_prompt_time: now,
      };

      const body = [
        `[LOG_ENTRY type=PROMPT num=1 session=${sessionShort}]`,
        `timestamp: ${now}`,
        `model: ${escapeFrontmatterValue(model)}`,
        "",
        prompt,
        "",
        "",
      ].join("\n");

      upsertFile(path.join(logsDir, filename), meta, body);
      process.stdout.write(JSON.stringify({ continue: true }));
      process.exit(0);
    }

    const filePath = path.join(logsDir, entry.filename);
    let content = "";
    try {
      content = fs.readFileSync(filePath, "utf8");
    } catch {
      content = "";
    }

    const parsed = parseExisting(content);
    const body = parsed.body || "\n";
    const num = countPrompts(body) + 1;

    const meta = {
      session_id: conversationId,
      date: entry.date || now.slice(0, 10),
      author: AUTHOR,
      model,
      tool: TOOL,
      project: PROJECT,
      total_exchanges: num,
      first_prompt_time: entry.first_prompt_time || now,
      last_prompt_time: now,
    };

    const promptEntry = [
      `[LOG_ENTRY type=PROMPT num=${num} session=${sessionShort}]`,
      `timestamp: ${now}`,
      `model: ${escapeFrontmatterValue(model)}`,
      "",
      prompt,
      "",
      "",
    ].join("\n");

    const newBody = body.replace(/\s*$/, "\n\n") + promptEntry;
    upsertFile(filePath, meta, newBody);

    entry.last_prompt_time = now;
    map[conversationId] = entry;
    saveMap(mapPath, map);

    process.stdout.write(JSON.stringify({ continue: true }));
    process.exit(0);
  }

  if (event === "afterAgentResponse") {
    const text = input.text == null ? "" : String(input.text);
    const entry = map[conversationId];

    if (!entry) {
      // Response without mapped session — create a file so nothing is lost
      const stamp = formatSessionStamp(new Date());
      const filename = `${stamp}_${conversationId}.md`;
      const meta = {
        session_id: conversationId,
        date: now.slice(0, 10),
        author: AUTHOR,
        model,
        tool: TOOL,
        project: PROJECT,
        total_exchanges: 0,
        first_prompt_time: now,
        last_prompt_time: now,
      };
      const body = replaceOrAppendResponse("\n", 0, sessionShort, now, model, text);
      upsertFile(path.join(logsDir, filename), meta, body);
      map[conversationId] = {
        filename,
        first_prompt_time: now,
        date: meta.date,
      };
      saveMap(mapPath, map);
      process.exit(0);
    }

    const filePath = path.join(logsDir, entry.filename);
    let content = "";
    try {
      content = fs.readFileSync(filePath, "utf8");
    } catch {
      content = "";
    }

    const parsed = parseExisting(content);
    let body = parsed.body || "\n";
    const num = countPrompts(body) || 1;

    const meta = {
      session_id: conversationId,
      date: entry.date || now.slice(0, 10),
      author: AUTHOR,
      model: model || (parsed.meta && parsed.meta.model) || "unknown",
      tool: TOOL,
      project: PROJECT,
      total_exchanges: num,
      first_prompt_time:
        entry.first_prompt_time ||
        (parsed.meta && parsed.meta.first_prompt_time) ||
        now,
      last_prompt_time:
        (parsed.meta && parsed.meta.last_prompt_time) ||
        entry.last_prompt_time ||
        now,
    };

    // Keep only the latest response text for this exchange number (final response)
    body = replaceOrAppendResponse(body, num, sessionShort, now, meta.model, text);
    upsertFile(filePath, meta, body);
    process.exit(0);
  }

  // Unknown event — no-op, fail open
  if (event === "beforeSubmitPrompt") {
    process.stdout.write(JSON.stringify({ continue: true }));
  }
  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(`capture.js fatal: ${err.stack || err}\n`);
  process.stdout.write(JSON.stringify({ continue: true }));
  process.exit(0);
});
