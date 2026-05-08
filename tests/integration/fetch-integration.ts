const jsonAccept = {
  Accept: 'application/json',
} as const;

export type IntegrationReadResult = {
  status: number;
  ok: boolean;
  json: unknown;
  rawText: string;
};

/**
 * GET/POST against deploy — parses JSON when possible. Does not throw on HTTP errors (use for 403/401 checks).
 */
export async function fetchIntegration(
  fullUrl: string,
  init?: RequestInit,
): Promise<IntegrationReadResult> {
  const response = await fetch(fullUrl, {
    ...init,
    cache: init?.cache ?? 'no-store',
    headers: {
      ...jsonAccept,
      ...(init?.headers || {}),
    },
  });
  const rawText = await response.text();
  let json: unknown;
  try {
    json = rawText.length ? JSON.parse(rawText) : null;
  } catch {
    json = { _nonJsonBody: rawText.slice(0, 500) };
  }
  return { status: response.status, ok: response.ok, json, rawText };
}

/** Fails unless `response.ok` — for happy-path integration checks. */
export async function fetchIntegrationOk(fullUrl: string, init?: RequestInit): Promise<unknown> {
  const { status, json, ok } = await fetchIntegration(fullUrl, init);
  if (!ok) {
    throw new Error(`${fullUrl} → HTTP ${status}: ${JSON.stringify(json).slice(0, 400)}`);
  }
  return json;
}
