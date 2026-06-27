/**
 * Prodef API Client
 *
 * Provides communication between the UI and the backend. It resolves available API
 * endpoints, executes runtime requests and converts backend errors into
 * UI-friendly messages.
 */

import type { RuntimeComponentDescriptor, RuntimeExecutionRequest, RuntimeExecutionResponse } from '../types/runtimeContract';

const configuredBase = (import.meta as any)?.env?.VITE_PRODEF_API_BASE as string | undefined;
const API_BASE_CANDIDATES = configuredBase
  ? [configuredBase]
  : Array.from({ length: 11 }, (_unused, idx) => `http://localhost:${5180 + idx}`);
let resolvedApiBase: string | null = null;

function buildApiBasesInPriorityOrder() {
  if (!resolvedApiBase) {
    return [...API_BASE_CANDIDATES];
  }
  return [resolvedApiBase, ...API_BASE_CANDIDATES.filter((base) => base !== resolvedApiBase)];
}

function routeMissingOnThisServer(path: string, responseBody: string) {
  if (path === '/execute') {
    return responseBody.includes('Cannot POST /execute');
  }
  return false;
}

async function fetchFromApi(path: string, init?: RequestInit): Promise<Response> {
  const bases = buildApiBasesInPriorityOrder();
  let lastError: unknown = null;

  for (const base of bases) {
    try {
      const resp = await fetch(`${base}${path}`, init);

      if (resp.status === 404) {
        const bodyText = await resp.clone().text();
        if (routeMissingOnThisServer(path, bodyText)) {
          continue;
        }
      }

      resolvedApiBase = base;
      return resp;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }
  throw new Error('No available Prodef API endpoint found.');
}

// Extract a readable error payload from failed backend responses.
async function readErrorMessage(resp: Response): Promise<string> {
  try {
    const raw = await resp.text();
    if (!raw) {
      return `HTTP ${resp.status} ${resp.statusText}`.trim();
    }

    try {
      const parsed = JSON.parse(raw);
      const fromError = typeof parsed?.error === 'string' ? parsed.error : null;
      if (fromError && fromError.trim().length > 0) {
        return fromError;
      }
    } catch {
    }

    return raw;
  } catch {
    return `HTTP ${resp.status} ${resp.statusText}`.trim();
  }
}

/**
 * Executes a runtime operation through the backend service.
 *
 * @param request Runtime execution request payload.
 * @returns Backend execution result.
 */
export async function callRuntimeExecute(request: RuntimeExecutionRequest): Promise<RuntimeExecutionResponse> {
  const resp = await fetchFromApi('/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!resp.ok) {
    throw new Error(await readErrorMessage(resp));
  }

  return resp.json();
}
