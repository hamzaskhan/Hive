const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

type TokenBundle = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user?: unknown;
};

function accessToken() {
  return localStorage.getItem("hive_access") ?? "";
}

function refreshToken() {
  return localStorage.getItem("hive_refresh") ?? "";
}

function accessExpiresAt() {
  return Number(localStorage.getItem("hive_access_exp") ?? "0");
}

export function setTokens(access: string, refresh: string, expiresIn?: number) {
  localStorage.setItem("hive_access", access);
  localStorage.setItem("hive_refresh", refresh);
  const expMs =
    expiresIn && expiresIn > 0
      ? Date.now() + expiresIn * 1000
      : jwtExpMs(access);
  if (expMs > 0) localStorage.setItem("hive_access_exp", String(expMs));
}

export function clearTokens() {
  localStorage.removeItem("hive_access");
  localStorage.removeItem("hive_refresh");
  localStorage.removeItem("hive_access_exp");
}

export function isLoggedIn() {
  return Boolean(accessToken() || refreshToken());
}

function jwtExpMs(token: string) {
  try {
    const part = token.split(".")[1];
    if (!part) return 0;
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    const exp = Number(JSON.parse(json).exp);
    return exp > 0 ? exp * 1000 : 0;
  } catch {
    return 0;
  }
}

const SKIP_REFRESH = [
  "/human/v1/auth/login",
  "/human/v1/auth/signup",
  "/human/v1/auth/refresh",
  "/human/v1/auth/pre_forget_password",
  "/human/v1/auth/verify_otp",
  "/human/v1/auth/reset_password",
];

let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const token = refreshToken();
    if (!token) return false;
    const res = await fetch(`${API_BASE}/human/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: token }),
    });
    if (!res.ok) {
      clearTokens();
      return false;
    }
    const data = (await res.json()) as TokenBundle;
    setTokens(data.access_token, data.refresh_token, data.expires_in);
    return true;
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

function accessIsStale() {
  const exp = accessExpiresAt();
  if (!exp) return false;
  return Date.now() > exp - 60_000;
}

async function request<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
  const skip = SKIP_REFRESH.some((p) => path.startsWith(p));
  if (!skip && !retried && refreshToken() && accessIsStale()) {
    await refreshSession();
  }

  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const token = accessToken();
  if (token && !skip) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (res.status === 401 && !skip && !retried && refreshToken()) {
    const ok = await refreshSession();
    if (ok) return request<T>(path, init, true);
  }

  if (!res.ok) {
    const detail =
      typeof body === "object" && body && "detail" in body
        ? String((body as { detail: unknown }).detail)
        : res.statusText;
    throw new Error(detail || `Request failed (${res.status})`);
  }
  return body as T;
}

export const api = {
  signup(payload: {
    email: string;
    password: string;
    full_name: string;
    account_type: "human" | "ai_worker";
    accept_terms: boolean;
  }) {
    return request<TokenBundle>("/human/v1/auth/signup", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  login(payload: { email: string; password: string }) {
    return request<TokenBundle>("/human/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  requestPasswordOtp(email: string) {
    return request<{ message: string }>("/human/v1/auth/pre_forget_password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },
  verifyOtp(email: string, otp: string) {
    return request<{ otp_verified: boolean; reset_token: string }>("/human/v1/auth/verify_otp", {
      method: "POST",
      body: JSON.stringify({ email, otp }),
    });
  },
  resetPassword(resetToken: string, newPassword: string) {
    return request<{ message: string }>("/human/v1/auth/reset_password", {
      method: "POST",
      body: JSON.stringify({ reset_token: resetToken, new_password: newPassword }),
    });
  },
  createMeeting(title: string) {
    return request<{
      meeting: {
        meeting_id: string;
        title: string;
        share_path: string;
        share_url: string;
        status: string;
      };
      livekit_url: string;
      token: string;
    }>("/human/v1/meetings", {
      method: "POST",
      body: JSON.stringify({ title }),
    });
  },
  joinMeeting(meetingId: string) {
    return request<{
      meeting: {
        meeting_id: string;
        title: string;
        share_path: string;
        share_url: string;
        status: string;
      };
      livekit_url: string;
      token: string;
      role: string;
    }>(`/human/v1/meetings/${meetingId}/join`, { method: "POST" });
  },
  getMeetInfo(meetingId: string) {
    return request<{
      meeting_id: string;
      transcript_id: string;
      participants: Array<{
        user_id: string;
        display_name: string;
        role: string;
        joined_at: string;
      }>;
      audio_s3_url: string | null;
      audio_s3_key: string | null;
      audio_status: string;
      egress_id: string | null;
      transcript_shared?: boolean;
      transcript_shared_at?: string | null;
    }>(`/human/v1/meetings/${meetingId}/info`);
  },
  endMeeting(meetingId: string) {
    return request<{
      meeting_id: string;
      title: string;
      status: string;
      share_path: string;
      share_url: string;
    }>(`/human/v1/meetings/${meetingId}/end`, { method: "POST" });
  },
  downloadAudio(meetingId: string) {
    return request<{
      meeting_id: string;
      download_url: string;
      audio_s3_key: string | null;
      filename: string;
    }>(`/human/v1/meetings/${meetingId}/audio/download`);
  },
  summarizeMeeting(meetingId: string) {
    return request<{
      transcript_id: string;
      meeting_id: string;
      status: string;
      text: string | null;
      summary: string | null;
      action_items: string[];
      language: string | null;
      shared?: boolean;
    }>(`/human/v1/meetings/${meetingId}/summarize`, { method: "POST" });
  },
  getTranscript(meetingId: string) {
    return request<{
      transcript_id: string;
      meeting_id: string;
      status: string;
      text: string | null;
      summary: string | null;
      action_items: string[];
      language: string | null;
      shared: boolean;
    }>(`/human/v1/meetings/${meetingId}/transcript`);
  },
  previewShareTranscript(meetingId: string) {
    return request<{
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
    }>(`/human/v1/meetings/${meetingId}/transcript/share`);
  },
  shareTranscript(meetingId: string) {
    return request<{
      meeting_id: string;
      transcript_id: string;
      shared: boolean;
      shared_at: string;
      shared_with: Array<{
        user_id: string;
        display_name: string;
        email: string;
        role: string;
      }>;
      transcript: {
        transcript_id: string;
        meeting_id: string;
        status: string;
        text: string | null;
        summary: string | null;
        action_items: string[];
        shared: boolean;
      };
    }>(`/human/v1/meetings/${meetingId}/transcript/share`, { method: "POST" });
  },
  listMyMeetings() {
    return request<{
      meetings: Array<{
        meeting_id: string;
        title: string;
        role: "owner" | "participant";
        tag: string;
        status: string;
        share_path: string;
        share_url: string;
        last_seen_at: string;
        created_at: string;
      }>;
    }>("/human/v1/meetings/mine");
  },
  createAgentAccount(payload: {
    meeting_id: string;
    label: string;
    secret_question: string;
    secret_answer: string;
    ttl_hours: number;
  }) {
    return request<{
      account: {
        agent_account_id: string;
        meeting_id: string;
        meeting_title: string | null;
        label: string;
        secret_question: string;
        status: string;
        expires_at: string;
        created_at: string;
      };
      unique_id: string;
      agent_portal_path: string;
      agent_portal_url: string;
      instructions: string;
    }>("/human/v1/agent-accounts", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  listAgentAccounts() {
    return request<{
      accounts: Array<{
        agent_account_id: string;
        meeting_id: string;
        meeting_title: string | null;
        label: string;
        secret_question: string;
        status: string;
        expires_at: string;
        verified_at: string | null;
        created_at: string;
      }>;
    }>("/human/v1/agent-accounts");
  },
  revokeAgentAccount(agentAccountId: string) {
    return request<{ ok: boolean; deleted: string }>(
      `/human/v1/agent-accounts/${agentAccountId}`,
      { method: "DELETE" },
    );
  },
};

/** Agent portal calls — separate token from human auth. */
export function setAgentToken(token: string) {
  sessionStorage.setItem("hive_agent_access", token);
}

export function clearAgentToken() {
  sessionStorage.removeItem("hive_agent_access");
}

export function agentAccessToken() {
  return sessionStorage.getItem("hive_agent_access") ?? "";
}

async function agentRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const token = agentAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const detail =
      typeof body === "object" && body && "detail" in body
        ? String((body as { detail: unknown }).detail)
        : typeof body === "string"
          ? body
          : res.statusText;
    throw new Error(detail || `Request failed (${res.status})`);
  }
  return body as T;
}

export const agentApi = {
  start(uniqueId: string) {
    return agentRequest<{
      challenge_token: string;
      secret_question: string;
      label: string;
      meeting_title: string;
      expires_at: string;
      hint: string;
    }>("/agent/v1/session/start", {
      method: "POST",
      body: JSON.stringify({ unique_id: uniqueId }),
    });
  },
  verify(challengeToken: string, answer: string) {
    return agentRequest<{
      access_token: string;
      expires_in: number;
      agent_account_id: string;
      label: string;
      meeting_id: string;
      meeting_title: string;
      notes_path: string;
    }>("/agent/v1/session/verify", {
      method: "POST",
      body: JSON.stringify({ challenge_token: challengeToken, answer }),
    });
  },
  me() {
    return agentRequest<{
      agent_account_id: string;
      label: string;
      meeting_id: string;
      meeting_title: string;
      status: string;
      expires_at: string;
    }>("/agent/v1/me");
  },
  async notesMarkdown() {
    const headers = new Headers();
    const token = agentAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(`${API_BASE}/agent/v1/notes.md`, { headers });
    const text = await res.text();
    if (!res.ok) {
      let detail = text;
      try {
        const j = JSON.parse(text);
        detail = j.detail || text;
      } catch {
        /* keep text */
      }
      throw new Error(detail || `Request failed (${res.status})`);
    }
    return text;
  },
};
