import { useCallback } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { FlowNode, FlowNodeData, NodeKind } from '../types/flow';
import { parseJson } from '../utils/flowHelpers';
import { runPacketExecutor } from '../flow/runtime/executor/packetExecutor';
import { Edge } from 'reactflow';

export interface UseFlowRunnerArgs {
  nodesRef: MutableRefObject<FlowNode[]>;
  edgesRef: MutableRefObject<Edge[]>;
  activeIterationRef: MutableRefObject<number | null>;
  neighborhoodSizeRef: MutableRefObject<number>;
  setNodes: Dispatch<SetStateAction<FlowNode[]>>;
  setSelectedNode: Dispatch<SetStateAction<FlowNode | null>>;
  setGlobalTrace: Dispatch<SetStateAction<string[]>>;
  appendExecutionHistory: (history: number[]) => void;
  setNeighborhoodSize: (size: number) => void;
}

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

  const appendGlobalTrace = useCallback((message: string) => {
    setGlobalTrace((prev) => [...prev, ...message.split('\n')]);
  }, [setGlobalTrace]);

  const appendGlobalSeparator = useCallback((label: string) => {
    setGlobalTrace((prev) => prev.length === 0 ? [label] : [...prev, '', label]);
  }, [setGlobalTrace]);

  const setNeighborhoodLevel = useCallback((value: number) => {
    const normalized = Math.max(1, Math.floor(value));
    neighborhoodSizeRef.current = normalized;
    setNeighborhoodSize(normalized);
  }, [neighborhoodSizeRef, setNeighborhoodSize]);

  const getNodeByType = useCallback((type: NodeKind): FlowNode | undefined => {
    return nodesRef.current.find((n) => n.type === type);
  }, [nodesRef]);

  const getNodeById = useCallback((id: string): FlowNode | undefined => {
    return nodesRef.current.find((n) => n.id === id);
  }, [nodesRef]);

  const updateNodeData = useCallback((id: string, patch: Partial<FlowNodeData>) => {
    setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, ...patch } } : n));
    setSelectedNode((prev) => prev?.id === id ? { ...prev, data: { ...prev.data, ...patch } } : prev);
  }, [setNodes, setSelectedNode]);

  const appendTrace = useCallback((id: string, message: string) => {
    const node = getNodeById(id);
    if (!node) return;
    if (!node.data.trace && node.data.start === true) appendGlobalTrace('');
    const current = node.data.trace ? `${node.data.trace}\n` : '';
    updateNodeData(id, { trace: `${current}${message}` });
    appendGlobalTrace(message);
  }, [appendGlobalTrace, getNodeById, updateNodeData]);

  const clearNodeError = useCallback((id: string) => {
    updateNodeData(id, { error: undefined });
  }, [updateNodeData]);

  const setNodeError = useCallback((id: string, error: string) => {
    const node = getNodeById(id);
    if (!node) return;
    const current = node.data.trace ? `${node.data.trace}\n` : '';
    updateNodeData(id, { error, trace: `${current}[ERROR] ${error}` });
    appendGlobalTrace(`❌ ${error}`);
  }, [appendGlobalTrace, getNodeById, updateNodeData]);

  const getProblemParsed = useCallback(() => {
    const problem = getNodeByType('problem');
    return problem ? parseJson<unknown>(problem.data.json) : null;
  }, [getNodeByType]);

  const deps = {
    getNodeById,
    getNodes: () => nodesRef.current,
    getEdges: () => edgesRef.current,
    // Execution context is a no-op now — simplified away.
    setExecutionContext: (_id: string, _type: NodeKind) => {},
    clearExecutionContext: () => {},
    getProblemParsed,
    appendExecutionHistory,
    setNodeError,
    clearNodeError,
    updateNodeData,
    appendTrace,
    appendGlobalTrace,
    appendGlobalSeparator,
    activeIterationRef,
  };

  const runFlowUntilEnd = useCallback(async () => {
    return runPacketExecutor(deps, { mode: 'full' });
  }, [deps]);

  const runFlowNextStep = useCallback(async () => {
    return runPacketExecutor(deps, { mode: 'iteration' });
  }, [deps]);

  return { getNodeByType, updateNodeData, setNeighborhoodLevel, runFlowUntilEnd, runFlowNextStep };
}