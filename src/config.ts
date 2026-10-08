/** Deployment configuration. Kept out of the clinical tools so URLs and limits can change without touching them. */
export function getConsultationUrl(): string | undefined {
  const raw = process.env.CLP_CONSULTATION_URL?.trim();
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export interface HttpConfig {
  port: number;
  host: string;
  /** Hostnames (no port) accepted in the Host header. */
  allowedHosts: string[];
  /** Hostnames (no scheme/port) accepted in the Origin header when one is sent. */
  allowedOrigins: string[];
  maxBodyBytes: number;
  rateLimitPerMinute: number;
  /** Trust X-Forwarded-For for the client address (set only behind a trusted proxy). */
  trustProxy: boolean;
}

const LOCALHOST_NAMES = ["localhost", "127.0.0.1", "[::1]"];

function list(value: string | undefined, fallback: string[]): string[] {
  if (value === undefined) return fallback;
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

function positiveInt(name: string, value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`${name} must be a positive integer.`);
  return n;
}

/** Render injects the service hostname; allow it automatically so a first deployment needs no manual host entry. */
function withPlatformHost(hosts: string[], env: NodeJS.ProcessEnv): string[] {
  const platformHost = env.RENDER_EXTERNAL_HOSTNAME?.trim().toLowerCase();
  return platformHost && !hosts.includes(platformHost) ? [...hosts, platformHost] : hosts;
}

/** Reads HTTP settings from environment variables. Defaults are localhost-only. */
export function loadHttpConfig(env: NodeJS.ProcessEnv = process.env): HttpConfig {
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("PORT must be an integer between 0 and 65535.");
  return {
    port,
    host: env.HOST?.trim() || "127.0.0.1",
    allowedHosts: withPlatformHost(list(env.ALLOWED_HOSTS, LOCALHOST_NAMES), env),
    allowedOrigins: list(env.ALLOWED_ORIGINS, LOCALHOST_NAMES),
    maxBodyBytes: positiveInt("MAX_BODY_BYTES", env.MAX_BODY_BYTES, 65536),
    rateLimitPerMinute: positiveInt("RATE_LIMIT_PER_MINUTE", env.RATE_LIMIT_PER_MINUTE, 120),
    trustProxy: env.TRUST_PROXY === "true"
  };
}
