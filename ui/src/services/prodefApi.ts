/**
 * prodefApi.ts
 * 
 * This file defines the API service for interacting with the execution endpoint.
 */

import type { RuntimeExecutionRequest, RuntimeExecutionResponse } from '../types/runtimeContract';

const API_BASE = (import.meta as any)?.env?.VITE_PRODEF_API_BASE || 'http://localhost:5180';

/**
 * Calls the runtime execution endpoint with the provided request.
 * 
 * @param request The execution request to send to the backend.
 * @returns A promise that resolves to the execution response from the backend.
 * @throws An error if the request fails or the response is not OK.
 */
export async function callRuntimeExecute(request: RuntimeExecutionRequest): Promise<RuntimeExecutionResponse> {
  const response = await fetch(`${API_BASE}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(await response.text() || response.statusText);
  }

  return response.json();
}
