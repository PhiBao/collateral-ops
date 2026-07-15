let cachedToken: string | null = null;
let expiresAt: number = 0;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

const TOKEN_REFRESH_MS = 7 * 60 * 60 * 1000;

function devnetCredentials() {
  return {
    tokenUrl: process.env.CANTON_AUTH_URL ?? "https://auth.sandbox.fivenorth.io/application/o/token/",
    clientId: process.env.CANTON_CLIENT_ID ?? "validator-devnet-m2m",
    clientSecret: process.env.CANTON_CLIENT_SECRET ?? "",
    audience: process.env.CANTON_AUDIENCE ?? "validator-devnet-m2m",
  };
}

export async function getDevnetToken(): Promise<string> {
  if (cachedToken && Date.now() < expiresAt - 60_000) {
    return cachedToken;
  }

  const { tokenUrl, clientId, clientSecret, audience } = devnetCredentials();

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      audience,
      scope: "daml_ledger_api",
    }),
  });

  if (!response.ok) {
    throw new Error(`Canton auth failed (${response.status})`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  expiresAt = Date.now() + (data.expires_in ?? 28800) * 1000;

  scheduleTokenRefresh();
  return cachedToken!;
}

function scheduleTokenRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer);
  const delay = Math.max(TOKEN_REFRESH_MS, (expiresAt - Date.now()) - 300_000);
  refreshTimer = setTimeout(() => {
    cachedToken = null;
  }, delay);
  if (refreshTimer.unref) refreshTimer.unref();
}

export function devnetBaseUrl(): string {
  return process.env.CANTON_JSON_API_URL ?? "https://ledger-api.validator.devnet.sandbox.fivenorth.io";
}
