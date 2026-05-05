/*
 * Archivo: prodefApi.ts
 *
 * Que contiene:
 * - Cliente HTTP de la UI para comunicarse con el backend local de Prodef.
 * - Resolucion de base URL (puerto configurable y fallback por rango de puertos).
 * - Ejecucion del contrato runtime (/execute).
 * - Normalizacion y lectura de errores HTTP para trazas mas claras en UI.
 *
 * Funcion en el flujo (inicio -> ejecucion de grafo):
 * - Durante la carga inicial, App llama aqui para obtener el catalogo remoto.
 * - Durante la ejecucion del grafo, los nodos runtime llaman aqui para delegar
 *   semantica algoritmica al runtime Rust mediante el contrato unificado.
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
    // Read body once and then parse opportunistically to avoid stream re-read errors.
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
      // Non-JSON body: fall through and return raw text.
    }

    return raw;
  } catch {
    return `HTTP ${resp.status} ${resp.statusText}`.trim();
  }
}

// Execute a runtime request in Rust using a single endpoint.
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
