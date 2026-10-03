import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { LandingPage } from "../pages/marketing/LandingPage";
import { LoginPage } from "../pages/auth/LoginPage";
import { SignupPage } from "../pages/auth/SignupPage";
import { ForgotPasswordPage } from "../pages/auth/ForgotPasswordPage";
import { MeetingsPage } from "../pages/meetings/MeetingsPage";
import { MeetingRoomPage } from "../pages/meetings/MeetingRoomPage";
import { BotsPage } from "../pages/bots/BotsPage";
import { AgentPortalPage } from "../pages/agent/AgentPortalPage";

/**
 * Alike routes live in the same pages/* folder and are registered as a group here.
 * marketing → /
 * auth → /login, /signup
 * meetings → /meetings, /m/:meetingId
 * bots (human IAM) → /bots
 * agent portal → /agent
 */
export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot" element={<ForgotPasswordPage />} />
        <Route path="/meetings" element={<MeetingsPage />} />
        <Route path="/m/:meetingId" element={<MeetingRoomPage />} />
        <Route path="/bots" element={<BotsPage />} />
        <Route path="/agent" element={<AgentPortalPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
