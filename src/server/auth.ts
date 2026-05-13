const AUTH_URL = "https://auth.qoqa.ch";

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
    const text = await resp.text();
    throw new Error(`Auth failed: ${resp.status} ${text}`);
  }

  const data = (await resp.json()) as Record<string, unknown>;
  const token = data.token as string | undefined;
  if (!token) {
    throw new Error(`No token in auth response: ${JSON.stringify(data)}`);
  }

  return token;
}
