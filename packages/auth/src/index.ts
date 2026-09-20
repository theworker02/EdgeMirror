/**
 * @edgemirror/auth — session + GitHub OAuth scaffold.
 * Works in MOCK/DEV without secrets. Never claims production auth without keys.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export type AuthMode = "dev" | "github" | "AUTH_NOT_CONFIGURED";

export interface AuthUser {
  id: string;
  login: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
  provider: "dev" | "github";
}

export interface Session {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface AuthConfig {
  mode?: AuthMode;
  githubClientId?: string;
  githubClientSecret?: string;
  /** Base URL for OAuth callback, e.g. http://localhost:8787 */
  publicBaseUrl?: string;
  sessionTtlHours?: number;
}

export interface AuthService {
  mode: AuthMode;
  getLoginUrl(state?: string): { url: string; mode: AuthMode } | { error: "AUTH_NOT_CONFIGURED" };
  exchangeCode(code: string): Promise<AuthUser | { error: string }>;
  createDevSession(login?: string): Session & { user: AuthUser };
  createSession(user: AuthUser): Session;
  getSession(token: string | undefined): (Session & { user: AuthUser }) | undefined;
  revokeSession(token: string): void;
  listUsers(): AuthUser[];
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export function detectAuthMode(env: NodeJS.ProcessEnv = process.env): AuthMode {
  if (env.EDGEMIRROR_AUTH_MODE === "dev") return "dev";
  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) return "github";
  if (env.EDGEMIRROR_AUTH_MODE === "github") return "AUTH_NOT_CONFIGURED";
  return "dev"; // local default — never pretend GitHub works without keys
}

export function createAuthService(config: AuthConfig = {}): AuthService {
  const mode =
    config.mode ??
    detectAuthMode({
      EDGEMIRROR_AUTH_MODE: config.mode,
      GITHUB_CLIENT_ID: config.githubClientId,
      GITHUB_CLIENT_SECRET: config.githubClientSecret,
    } as NodeJS.ProcessEnv);

  const users = new Map<string, AuthUser>();
  const sessions = new Map<string, Session>();
  const ttlMs = (config.sessionTtlHours ?? 24) * 3600_000;

  const ensureDevUser = (login = "dev-user"): AuthUser => {
    const id = `dev:${login}`;
    let user = users.get(id);
    if (!user) {
      user = {
        id,
        login,
        name: `DEV ${login}`,
        provider: "dev",
      };
      users.set(id, user);
    }
    return user;
  };

  return {
    mode: mode === "github" && !(config.githubClientId && config.githubClientSecret)
      ? "AUTH_NOT_CONFIGURED"
      : mode,

    getLoginUrl(state = randomBytes(8).toString("hex")) {
      const effective =
        mode === "github" && config.githubClientId && config.githubClientSecret
          ? "github"
          : mode === "dev"
            ? "dev"
            : "AUTH_NOT_CONFIGURED";

      if (effective === "AUTH_NOT_CONFIGURED") {
        return { error: "AUTH_NOT_CONFIGURED" as const };
      }
      if (effective === "dev") {
        const base = config.publicBaseUrl ?? "http://localhost:8787";
        return {
          mode: "dev",
          url: `${base}/v1/auth/dev-login?login=dev-user&state=${encodeURIComponent(state)}`,
        };
      }
      const redirect = `${config.publicBaseUrl ?? "http://localhost:8787"}/v1/auth/callback`;
      const url =
        `https://github.com/login/oauth/authorize` +
        `?client_id=${encodeURIComponent(config.githubClientId!)}` +
        `&redirect_uri=${encodeURIComponent(redirect)}` +
        `&scope=${encodeURIComponent("read:user user:email")}` +
        `&state=${encodeURIComponent(state)}`;
      return { mode: "github", url };
    },

    async exchangeCode(code: string) {
      if (mode !== "github" || !config.githubClientId || !config.githubClientSecret) {
        return { error: "AUTH_NOT_CONFIGURED" };
      }
      // Real token exchange — only when keys present. Callers should mock in tests.
      const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: config.githubClientId,
          client_secret: config.githubClientSecret,
          code,
        }),
      });
      if (!tokenRes.ok) return { error: "oauth_token_failed" };
      const tokenJson = (await tokenRes.json()) as { access_token?: string; error?: string };
      if (!tokenJson.access_token) return { error: tokenJson.error ?? "no_token" };

      const userRes = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${tokenJson.access_token}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "EdgeMirror",
        },
      });
      if (!userRes.ok) return { error: "user_fetch_failed" };
      const gh = (await userRes.json()) as {
        id: number;
        login: string;
        name?: string;
        email?: string;
        avatar_url?: string;
      };
      const user: AuthUser = {
        id: `github:${gh.id}`,
        login: gh.login,
        name: gh.name,
        email: gh.email,
        avatarUrl: gh.avatar_url,
        provider: "github",
      };
      users.set(user.id, user);
      return user;
    },

    createDevSession(login = "dev-user") {
      const user = ensureDevUser(login);
      const session = this.createSession(user);
      return { ...session, user };
    },

    createSession(user: AuthUser) {
      users.set(user.id, user);
      const token = `em_${randomBytes(24).toString("hex")}`;
      const now = Date.now();
      const session: Session = {
        token,
        userId: user.id,
        createdAt: new Date(now).toISOString(),
        expiresAt: new Date(now + ttlMs).toISOString(),
      };
      sessions.set(sha256(token), session);
      return session;
    },

    getSession(token: string | undefined) {
      if (!token) return undefined;
      const session = sessions.get(sha256(token));
      if (!session) return undefined;
      if (Date.parse(session.expiresAt) < Date.now()) {
        sessions.delete(sha256(token));
        return undefined;
      }
      const user = users.get(session.userId);
      if (!user) return undefined;
      return { ...session, user };
    },

    revokeSession(token: string) {
      sessions.delete(sha256(token));
    },

    listUsers() {
      return [...users.values()];
    },
  };
}

/** Constant-time token compare helper for webhook-style secrets. */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
