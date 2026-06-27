/**
 * useFlowRunner
 *
 * React hook that connects the UI with the execution engine. It provides the
 * actions and state required to start, monitor and control workflow execution.
 */

import { useCallback, useMemo, useRef } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { FlowEdge, FlowNode, FlowNodeData, NodeKind } from '../types/flow';
import { parseJson } from '../utils/flowHelpers';
import { runPacketExecutor } from '../flow/runtime/executor/packetExecutor';

export interface UseFlowRunnerArgs {
  nodesRef: MutableRefObject<FlowNode[]>;
  edgesRef: MutableRefObject<FlowEdge[]>;
  activeIterationRef: MutableRefObject<number | null>;
  neighborhoodSizeRef: MutableRefObject<number>;
  setNodes: Dispatch<SetStateAction<FlowNode[]>>;
  setSelectedNode: Dispatch<SetStateAction<FlowNode | null>>;
  setGlobalTrace: Dispatch<SetStateAction<string[]>>;
  appendExecutionHistory: (history: number[]) => void;
  setNeighborhoodSize: (value: number) => void;
}

/**
 * Manages workflow execution lifecycle and runtime state.
 *
 * Exposes actions for starting and monitoring graph execution from the UI.
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

  const appendGlobalTrace = useCallback((message: string) => {
    const lines = (message).split('\n');
    setGlobalTrace((prev) => [...prev, ...lines]);
  }, [setGlobalTrace]);

  const appendGlobalSeparator = useCallback((label: string) => {
    setGlobalTrace((prev) => (prev.length === 0 ? [label] : [...prev, '', label]));
  }, [setGlobalTrace]);

  const setNeighborhoodLevel = useCallback((nextValue: number) => {
    const normalized = Math.max(1, Math.floor(nextValue));
    neighborhoodSizeRef.current = normalized;
    setNeighborhoodSize(normalized);
  }, [neighborhoodSizeRef, setNeighborhoodSize]);

  const getNodeByType = useCallback((type: NodeKind): FlowNode | undefined => {
    const ctx = executionContextRef.current;
    if (ctx?.targetType === type) {
      const active = nodesRef.current.find((n) => n.id === ctx.targetId);
      if (active) return active;
    }
    return nodesRef.current.find((n) => n.type === type);
  }, [nodesRef]);

  const getNodeById = useCallback((id: string): FlowNode | undefined => {
    return nodesRef.current.find((n) => n.id === id);
  }, [nodesRef]);

  const updateNodeData = useCallback((id: string, patch: Partial<FlowNodeData>) => {
    setNodes((nodes) => nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)));
    setSelectedNode((prev) => (prev?.id === id ? { ...prev, data: { ...prev.data, ...patch } } : prev));
  }, [setNodes, setSelectedNode]);

  const appendTrace = useCallback((id: string, message: string) => {
    const node = getNodeById(id);
    if (!node) return;
    if (!node.data.trace && node.data.start === true) {
      appendGlobalTrace('');
    }

    const current = node.data.trace ? `${node.data.trace}\n` : '';
    updateNodeData(id, { trace: `${current}${message}` });
    appendGlobalTrace(message);
  }, [appendGlobalTrace, getNodeById, updateNodeData]);

  const clearNodeError = useCallback((id: string) => {
    updateNodeData(id, { error: undefined });
  }, [updateNodeData]);

  const setNodeError = useCallback((id: string, error: string) => {
    updateNodeData(id, { error });
    const node = getNodeById(id);
    if (!node) return;
    const current = node.data.trace ? `${node.data.trace}\n` : '';
    updateNodeData(id, { trace: `${current}[ERROR] ${error}` });
    appendGlobalTrace(`❌ ${error}`);
  }, [appendGlobalTrace, getNodeById, updateNodeData]);

  const getProblemParsed = useCallback(() => {
    const problem = getNodeByType('problem');
    if (!problem) return null;
    return parseJson<any>(problem.data.json);
  }, [getNodeByType]);

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
  ]);

  const runFlowUntilEnd = useCallback(async () => {
    return runPacketExecutor(decisionDeps, { mode: 'full' });
  }, [decisionDeps]);

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