import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RuntimeExecutionRequest } from '../types/runtimeContract';

function makeJsonResponse(body: unknown, init: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

describe('callRuntimeExecute', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('posts JSON to /execute and returns the parsed response', async () => {
    // Mocking fetch to return a successful JSON response when `callRuntimeExecute` is called, allowing us to
    // verify that the function correctly sends the request and processes the response without needing a real
    // backend server.
    const fetchMock = vi.mocked(fetch);
    // We use `makeJsonResponse` to create a Response object with the desired JSON body and status code, simulating
    // a successful API response.
    fetchMock.mockResolvedValueOnce(makeJsonResponse({ result: { problemName: 'demo' } }, { status: 200 }));

    // Dynamically importing `callRuntimeExecute` after setting up the fetch mock ensures that when `callRuntimeExecute`
    // makes a fetch call, it hits our mocked version, allowing us to test its behavior in isolation.
    const { callRuntimeExecute } = await import('./prodefApi');
    // We call `callRuntimeExecute` with a sample request and await its response, which should be the parsed JSON from our mock.
    const request: RuntimeExecutionRequest = {
      execution: { mode: 'catalog' },
    };

    const response = await callRuntimeExecute(request);

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:5180/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    expect(response.result?.problemName).toBe('demo');
  });

  it('tries another endpoint when /execute is missing on the first server', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(new Response('Cannot POST /execute', { status: 404, statusText: 'Not Found' }))
      .mockResolvedValueOnce(makeJsonResponse({ payload: { ok: true } }, { status: 200 }));

    const { callRuntimeExecute } = await import('./prodefApi');

    await callRuntimeExecute({ execution: { mode: 'catalog' } });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:5180/execute');
    expect(fetchMock.mock.calls[1][0]).toBe('http://localhost:5181/execute');
  });
});