import type { FlowNode, FlowNodeData, NodeKind } from '../../../types/flow';
import { parseJson } from '../../../utils/flowHelpers';
import { createComponent } from '../components/registry';
import type { ComponentContext, ExecuteResult, IncomingSource, Packet, SolutionLike } from '../engine/packet';
import { JoinRuntimeComponent, formatCompact, toPretty } from '../components/base';
import { validateGraph } from '../engine/graphValidation';
import type { Edge } from 'reactflow';

export interface PacketExecutorDeps {
  getNodes: () => FlowNode[];
  getEdges: () => Edge[];
  getNodeById: (id: string) => FlowNode | undefined;
  getProblemParsed: () => unknown;
  appendExecutionHistory: (history: number[]) => void;
  updateNodeData: (id: string, patch: Partial<FlowNodeData>) => void;
  setExecutionContext: (targetId: string, targetType: NodeKind) => void;
  clearExecutionContext: () => void;
  clearNodeError: (id: string) => void;
  setNodeError: (id: string, message: string) => void;
  appendTrace: (id: string, message: string) => void;
  appendGlobalTrace: (message: string) => void;
  appendGlobalSeparator: (label: string) => void;
  activeIterationRef: { current: number | null };
}

interface QueuedPacket {
  target: string;
  packet: Packet;
}

const MAX_PACKETS_PER_RUN = 10000;
const COMPONENT_EXECUTION_DELAY_MS = 250;

function getIncoming(deps: PacketExecutorDeps, nodeId: string): IncomingSource[] {
  return deps.getEdges()
    .filter((e) => e.target === nodeId)
    .flatMap((e) => {
      const node = deps.getNodeById(e.source);
      return node ? [{ id: node.id, type: node.type as NodeKind }] : [];
    });
}

function getOutgoing(deps: PacketExecutorDeps, nodeId: string): IncomingSource[] {
  return deps.getEdges()
    .filter((e) => e.source === nodeId)
    .flatMap((e) => {
      const node = deps.getNodeById(e.target);
      return node ? [{ id: node.id, type: node.type as NodeKind }] : [];
    });
}

function getByKind(deps: PacketExecutorDeps, kind: NodeKind): IncomingSource[] {
  return deps.getNodes()
    .filter((n) => n.type === kind)
    .map((n) => ({ id: n.id, type: n.type as NodeKind }));
}

function buildContext(deps: PacketExecutorDeps, node: FlowNode, problem: unknown): ComponentContext {
  return {
    nodeId: node.id,
    nodeType: node.type as NodeKind,
    nodeData: node.data,
    problem,
    updateNodeData: (patch) => deps.updateNodeData(node.id, patch),
    updateNodeDataById: (id, patch) => deps.updateNodeData(id, patch),
    appendTrace: (msg) => deps.appendTrace(node.id, msg),
    getIncomingSources: () => getIncoming(deps, node.id),
    getOutgoingTargets: () => getOutgoing(deps, node.id),
    findNodesByKind: (kind) => getByKind(deps, kind),
  };
}

function readSolutionSet(nodeData: FlowNodeData | undefined): SolutionLike[] {
  if (!nodeData) return [];
  if (Array.isArray(nodeData.solutionSet)) return nodeData.solutionSet as SolutionLike[];
  if (typeof nodeData.solutionSet === 'string') {
    const parsed = parseJson<SolutionLike[]>(nodeData.solutionSet);
    return Array.isArray(parsed) ? parsed : [];
  }
  return [];
}

export async function runPacketExecutor(deps: PacketExecutorDeps, options: { mode: 'full' | 'iteration' }): Promise<void> {
  const separator = options.mode === 'iteration' ? '=== FLOW RUN (NEXT STEP) ===' : '=== FLOW RUN ===';
  deps.appendGlobalSeparator(separator);

  const nodes = deps.getNodes();
  const edges = deps.getEdges();
  const validation = validateGraph(nodes, edges);
  if (!validation.ok) {
    for (const err of validation.errors ?? []) {
      deps.appendGlobalTrace(`ERROR: ${err}`);
    }
    return;
  }

  const { startNode, endNode, loopNode } = validation.graph!;
  const problem = deps.getProblemParsed();
  if (!problem) {
    deps.appendGlobalTrace('ERROR: problem JSON is missing or invalid.');
    return;
  }

  const currentIteration = loopNode.data.iteration ?? 0;

  let seed: QueuedPacket;
  if (options.mode === 'iteration') {
    const set = readSolutionSet(loopNode.data);
    const packet: Packet = {
      idIteration: currentIteration,
      fromId: 'iteration-seed',
      solution: null,
      solutionSet: set.length > 0 ? set : undefined,
    };
    if (set.length === 0) {
      packet.solution = loopNode.data?.solution ? JSON.parse(loopNode.data?.solution) : null;
    }
    seed = { target: loopNode.id, packet };
  } else {
    seed = { target: startNode.id, packet: { idIteration: 0, fromId: 'boot' } };
  }

  const queue: QueuedPacket[] = [seed];
  const joinBuffers = new Map<string, Map<number, Map<string, Packet>>>();

  let loopVisits = 0;
  let stopped = false;
  let lastPacket: Packet | null = null;
  let processed = 0;

  let storageEndLastPacket: Packet | null = null;
  const endIsStorage = endNode?.type === 'storage';

  try {
    while (queue.length > 0) {
      processed += 1;
      if (processed > MAX_PACKETS_PER_RUN) {
        deps.appendGlobalTrace('ERROR: packet budget exceeded. Aborting to avoid infinite loop.');
        break;
      }

      const current = queue.shift()!;
      const node = deps.getNodeById(current.target);
      if (!node) {
        deps.appendGlobalTrace(`WARN: target node ${current.target} not found. Dropping packet.`);
        continue;
      }

      if (endIsStorage && node.id === endNode!.id) {
        storageEndLastPacket = current.packet;
      }

      if (node.type === 'termination') {
        loopVisits += 1;
        deps.activeIterationRef.current = Number(node.data?.iteration ?? currentIteration);

        if (options.mode === 'full' && loopVisits >= 2) {
          deps.appendGlobalTrace('');
        }

        if (options.mode === 'iteration' && loopVisits >= 2) {
          const patch: Partial<FlowNodeData> = {};
          if (current.packet.solution) patch.solution = toPretty(current.packet.solution);
          if (Array.isArray(current.packet.solutionSet)) {
            patch.solutionSet = toPretty(current.packet.solutionSet);
            patch.setSize = current.packet.solutionSet.length;
          }
          if (Object.keys(patch).length > 0) deps.updateNodeData(node.id, patch);
          lastPacket = current.packet;
          break;
        }
      }

      const kind = node.type as NodeKind;
      const component = createComponent(kind);
      if (!component) {
        deps.appendGlobalTrace(`WARN: node kind ${kind} is not executable. Skipping.`);
        continue;
      }

      const ctx = buildContext(deps, node, problem);
      deps.setExecutionContext(node.id, kind);
      deps.clearNodeError(node.id);
      deps.updateNodeData(node.id, { isRunning: true });

      await new Promise((resolve) => setTimeout(resolve, COMPONENT_EXECUTION_DELAY_MS));

      let result: ExecuteResult;
      try {
        if (component instanceof JoinRuntimeComponent) {
          const bufferByIter = joinBuffers.get(node.id) ?? new Map<number, Map<string, Packet>>();
          joinBuffers.set(node.id, bufferByIter);
          const bufferBySource = bufferByIter.get(current.packet.idIteration) ?? new Map<string, Packet>();
          bufferByIter.set(current.packet.idIteration, bufferBySource);
          bufferBySource.set(current.packet.fromId, current.packet);

          const expectedArity = Math.max(2, getIncoming(deps, node.id).length);
          if (bufferBySource.size < Math.min(component.arity, expectedArity)) {
            result = { kind: 'wait' };
          } else {
            const packets = Array.from(bufferBySource.values());
            bufferByIter.delete(current.packet.idIteration);
            result = await component.executeJoin(ctx, packets);
          }
        } else {
          result = await component.execute(ctx, current.packet);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error while executing component.';
        result = { kind: 'error', message };
      } finally {
        deps.updateNodeData(node.id, { isRunning: false });
        deps.clearExecutionContext();
      }

      if (result.kind === 'error') {
        deps.setNodeError(node.id, result.message);
        stopped = true;
        break;
      }
      if (result.kind === 'wait') continue;
      if (result.kind === 'stop') {
        lastPacket = {
          idIteration: current.packet.idIteration,
          fromId: node.id,
          solution: result.solution ?? null,
          solutionSet: result.solutionSet ?? null,
        };
        stopped = true;
        break;
      }

      const emitted: Packet = {
        idIteration: result.idIteration ?? current.packet.idIteration,
        fromId: node.id,
        maxIterations: result.maxIterations ?? current.packet.maxIterations,
        solution: result.solution ?? null,
        solutionSet: result.solutionSet ?? null,
      };
      lastPacket = emitted;

      for (const edge of deps.getEdges().filter((e) => e.source === node.id)) {
        queue.push({ target: edge.target, packet: emitted });
      }
    }

    if (options.mode === 'full' || stopped) {
      const finalPacket = endIsStorage ? storageEndLastPacket : lastPacket;
      const finalSolution = finalPacket?.solution ?? null;
      const summary = finalSolution ? formatCompact(finalSolution) : 'no result';
      deps.appendGlobalTrace(`🏁 FINAL: ${summary}`);

      const history = Array.isArray(loopNode?.data?.history)
        ? [...(loopNode.data.history as number[])]
        : [];
      if (history.length > 0) deps.appendExecutionHistory(history);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Graph execution failed.';
    deps.appendGlobalTrace(`ERROR: ${message}`);
  }
}