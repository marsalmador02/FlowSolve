/**
 * API Client
 * This module provides functions to communicate with the Node.js bridge that forwards requests to the Rust execution runtime.
 */

import type { RuntimeExecutionRequest, RuntimeExecutionResponse } from '../types/runtimeContract';

const API_BASE = (import.meta as any)?.env?.VITE_PRODEF_API_BASE || 'http://localhost:5180';

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
