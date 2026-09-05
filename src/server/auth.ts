const AUTH_URL = "https://auth.qoqa.ch";
const MAX_BODY_LENGTH = 200;

interface QoqaError {
  title?: string;
  detail?: string;
}

export function authFailureMessage(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body) as { errors?: QoqaError[] };
    const [error] = parsed.errors ?? [];
    const reason = error?.detail || error?.title;
    if (reason) return reason;
  } catch {}

  const trimmed = body.trim().slice(0, MAX_BODY_LENGTH);
  return trimmed ? `HTTP ${status} — ${trimmed}` : `HTTP ${status}`;
}

/**
 * Authenticates with QoQa and returns a bearer token.
 * Throws on failure with a descriptive message.
 */
export async function authenticate(email: string, password: string): Promise<string> {
  const deviceId = crypto.randomUUID();

  const resp = await fetch(`${AUTH_URL}/v2/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-qoqa-device-identifier": deviceId,
    },
    body: JSON.stringify({
      user: { login: email, password },
      device_identifier: deviceId,
      remember_me: true,
    }),
  });

  if (!resp.ok) {
    throw new Error(authFailureMessage(resp.status, await resp.text()));
  }

  const data = (await resp.json()) as Record<string, unknown>;
  const token = data.token as string | undefined;
  if (!token) {
    throw new Error(`No token in auth response: ${JSON.stringify(data)}`);
  }

  return token;
}
