/**
 * React hook that bridges UI state with the packet executor.
 *
 * Purpose:
 * - Expose stable orchestration callbacks for flow execution.
 * - Keep refs and React state synchronized for node updates and traces.
 *
 * Returns:
 * - `runFlowUntilEnd`, `runFlowNextStep`, and selected node helpers.
 *
 * Invariants:
 * - Execution context always points to a single active node while executing.
 * - Trace writes are mirrored into node-local and global panels.
 */
import { useCallback, useMemo, useRef } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { FlowEdge, FlowNode, FlowNodeData, NodeKind } from '../types/flow';
import { parseJson } from '../utils/flowHelpers';
import { runPacketExecutor } from '../flow/runtime/executor/packetExecutor';

// Arguments required to bridge React state setters with imperative runner refs.
export interface UseFlowRunnerArgs {
  nodesRef: MutableRefObject<FlowNode[]>;
  edgesRef: MutableRefObject<FlowEdge[]>;
  activeIterationRef: MutableRefObject<number | null>;
  neighborhoodSizeRef: MutableRefObject<number>;
  setNodes: Dispatch<SetStateAction<FlowNode[]>>;
  setSelectedNode: Dispatch<SetStateAction<FlowNode | null>>;
  setGlobalTrace: Dispatch<SetStateAction<string[]>>;
  appendExecutionHistory: (history: number[]) => void;
  setNeighborhoodSize: Dispatch<SetStateAction<number>>;
}

/**
 * Build flow-runner actions connected to current React state and refs.
 */
export function useFlowRunner({
  nodesRef,
  edgesRef,
  activeIterationRef,
  neighborhoodSizeRef,
  setNodes,
  setSelectedNode,
  setGlobalTrace,
  appendExecutionHistory,
  setNeighborhoodSize,
}: UseFlowRunnerArgs) {
  const executionContextRef = useRef<{ targetId: string; targetType: NodeKind } | null>(null);
  const normalizeTraceMessage = useCallback((message: string) => {
    const lines = message.split('\n');
    return lines
      .map((line, index) => (index === 0 ? line.trimStart() : line))
      .join('\n');
  }, []);

  // Append one line to the global execution trace panel.
  const appendGlobalTrace = useCallback((message: string) => {
    const lines = normalizeTraceMessage(message).split('\n');
    const formatted: string[] = [];
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (line.trim().length === 0) {
        formatted.push('');
        continue;
      }
      formatted.push(line);
    }
    setGlobalTrace((prev) => [...prev, ...formatted]);
  }, [normalizeTraceMessage, setGlobalTrace]);

  // Append a visual section separator plus title to the global trace panel.
  const appendGlobalSeparator = useCallback((label: string) => {
    setGlobalTrace((prev) => (prev.length === 0 ? [label] : [...prev, '', label]));
  }, [setGlobalTrace]);

  // Clamp and synchronize neighborhood level in both ref and React state.
  const setNeighborhoodLevel = useCallback((nextValue: number) => {
    const normalized = Math.max(1, Math.floor(nextValue));
    neighborhoodSizeRef.current = normalized;
    setNeighborhoodSize(normalized);
  }, [neighborhoodSizeRef, setNeighborhoodSize]);

  // Find the first node matching a specific node kind.
  const getNodeByType = useCallback((type: NodeKind): FlowNode | undefined => {
    const executionContext = executionContextRef.current;
    if (executionContext && executionContext.targetType === type) {
      const activeTarget = nodesRef.current.find((n) => n.id === executionContext.targetId);
      if (activeTarget) {
        return activeTarget;
      }
    }
    return nodesRef.current.find((n) => n.type === type);
  }, [nodesRef]);

  // Find a node by stable node id.
  const getNodeById = useCallback((id: string): FlowNode | undefined => {
    return nodesRef.current.find((n) => n.id === id);
  }, [nodesRef]);

  // Merge a partial data patch into one node and selected-node shadow state.
  const updateNodeData = useCallback((id: string, patch: Partial<FlowNodeData>) => {
    setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)));
    setSelectedNode((prev) => (prev && prev.id === id ? { ...prev, data: { ...prev.data, ...patch } } : prev));
  }, [setNodes, setSelectedNode]);

  // Append trace output to both the node-local trace and global trace panel.
  const appendTrace = useCallback((id: string, message: string) => {
    const node = getNodeById(id);
    if (!node) {
      return;
    }

    if (!node.data.trace && node.data.start === true) {
      appendGlobalTrace('');
    }

    const normalizedMessage = normalizeTraceMessage(message);
    const current = node.data.trace ? `${node.data.trace}\n` : '';
    updateNodeData(id, { trace: `${current}${normalizedMessage}` });
    appendGlobalTrace(normalizedMessage);
  }, [appendGlobalTrace, getNodeById, normalizeTraceMessage, updateNodeData]);

  // Remove an error message from a node.
  const clearNodeError = useCallback((id: string) => updateNodeData(id, { error: undefined }), [updateNodeData]);

  // Set node error state and record it in both node and global traces.
  const setNodeError = useCallback((id: string, error: string) => {
    updateNodeData(id, { error });
    const node = getNodeById(id);
    if (!node) {
      return;
    }
    const current = node.data.trace ? `${node.data.trace}\n` : '';
    updateNodeData(id, { trace: `${current}[ERROR] ${error}` });
    appendGlobalTrace(`❌ ${error}`);
  }, [appendGlobalTrace, getNodeById, updateNodeData]);

  // Parse the JSON payload currently stored in the problem node.
  const getProblemParsed = useCallback(() => {
    const problem = getNodeByType('problem');
    if (!problem) {
      return null;
    }
    return parseJson<any>(problem.data.json);
  }, [getNodeByType]);

  // Dependency bundle consumed by packetExecutor.
  const decisionDeps = useMemo(() => ({
    getNodeById,
    getNodes: () => nodesRef.current,
    getEdges: () => edgesRef.current,
    setExecutionContext: (targetId: string, targetType: NodeKind) => {
      executionContextRef.current = { targetId, targetType };
    },
    clearExecutionContext: () => {
      executionContextRef.current = null;
    },
    getProblemParsed,
    appendExecutionHistory,
    setNodeError,
    clearNodeError,
    updateNodeData,
    appendTrace,
    appendGlobalTrace,
    appendGlobalSeparator,
    activeIterationRef,
  }), [
    getNodeById,
    getProblemParsed,
    setNodeError,
    clearNodeError,
    updateNodeData,
    appendTrace,
    appendGlobalTrace,
    appendExecutionHistory,
    appendGlobalSeparator,
    activeIterationRef,
    nodesRef,
    edgesRef,
  ]);

  // Execute the full configured graph repeatedly until stop conditions are met.
  const runFlowUntilEnd = useCallback(async () => {
    return runPacketExecutor(decisionDeps, { mode: 'full' });
  }, [decisionDeps]);

  // Execute one phase of the configured algorithm and keep state between clicks.
  const runFlowNextStep = useCallback(async () => {
    return runPacketExecutor(decisionDeps, { mode: 'iteration' });
  }, [decisionDeps]);

  return {
    getNodeByType,
    updateNodeData,
    setNeighborhoodLevel,
    runFlowUntilEnd,
    runFlowNextStep,
  };
}
