import axios from "axios";

export const BACKEND = "https://focustimer-backend.onrender.com";
export const SIDECAR = "http://127.0.0.1:54321";

export const backend = axios.create({ baseURL: BACKEND });
export const sidecar = axios.create({ baseURL: SIDECAR });

export function setAuthHeader(token: string | null): void {
  if (token) {
    backend.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete backend.defaults.headers.common["Authorization"];
  }
}

// ---------- types ----------

export interface AuthResponse {
  token: string;
  username: string;
  userId: number;
}

export interface SidecarStatus {
  active: boolean;
  paused: boolean;
  remaining_seconds: number;
  total_seconds: number;
  mode: string;
  xp_total: number;
  session_xp: number;
  streak: number;
  whitelist: string[];
  token: string;
}

export interface PendingRequest {
  friendshipId: number;
  requesterId: number;
  requesterUsername: string;
  createdAt: string;
}

export interface FriendStatus {
  userId: number;
  username: string;
  sessionState: "idle" | "active" | "paused" | "hidden";
  remainingSeconds: number;
  totalSeconds: number;
  xpTotal: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: number;
  username: string;
  xpTotal: number;
  level: number;
}

export interface RunningApp {
  name: string;
  key: string;
  exe: string;
}

export interface UserProfile {
  id: number;
  username: string;
  displayName: string;
  email: string;
  xpTotal: number;
  liveStatusVisible: boolean;
}

export interface RoomMember {
  userId: number;
  username: string;
}

export interface Room {
  id: number;
  name: string;
  code: string;
  hostId: number;
  hostUsername: string;
  isPublic: boolean;
  memberCount: number;
  members: RoomMember[];
  createdAt: string;
}
