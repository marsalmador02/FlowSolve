import type { FlowEdge, FlowNode, FlowNodeData, NodeKind } from '../../../types/flow';
import { parseJson } from '../../../utils/flowHelpers';
import { createComponent } from '../components/registry';
import type { ComponentContext, ExecuteResult, IncomingSource, Packet, SolutionLike } from '../engine/packet';
import { JoinRuntimeComponent, formatCompact, solutionScore, toPretty } from '../components/base';
import { validateGraph } from '../engine/graphValidation';

export interface PacketExecutorDeps {
  getNodes: () => FlowNode[];
  getEdges: () => FlowEdge[];
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

function resolveIncomingSources(deps: PacketExecutorDeps, nodeId: string): IncomingSource[] {
  return deps.getEdges()
    .filter((e) => e.target === nodeId)
    .flatMap((edge) => {
      const node = deps.getNodeById(edge.source);
      return node ? [{ id: node.id, type: node.type as NodeKind }] : [];
    });
}

function resolveOutgoingTargets(deps: PacketExecutorDeps, nodeId: string): IncomingSource[] {
  return deps.getEdges()
    .filter((e) => e.source === nodeId)
    .flatMap((edge) => {
      const node = deps.getNodeById(edge.target);
      return node ? [{ id: node.id, type: node.type as NodeKind }] : [];
    });
}

function resolveByKind(deps: PacketExecutorDeps, kind: NodeKind): IncomingSource[] {
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
    appendTrace: (message) => deps.appendTrace(node.id, message),
    getIncomingSources: () => resolveIncomingSources(deps, node.id),
    getOutgoingTargets: () => resolveOutgoingTargets(deps, node.id),
    findNodesByKind: (kind) => resolveByKind(deps, kind),
  };
}

function isMaximizeProblem(problem: unknown): boolean {
  const raw = (problem as any).raw;
  const sense: string = raw.goals[0].sense;
  return sense.toLowerCase().includes('maximiz');
}

function bestFromSet(set: SolutionLike[] | null | undefined, problem: unknown): SolutionLike | null {
  if (!set || set.length === 0) return null;
  const maximize = isMaximizeProblem(problem);
  return set.reduce((best, candidate) => {
    const better = maximize
      ? solutionScore(candidate) > solutionScore(best)
      : solutionScore(candidate) < solutionScore(best);
    return better ? candidate : best;
  }, set[0]);
}

function readStoredSet(nodeData: FlowNodeData | undefined): SolutionLike[] {
  if (!nodeData) return [];
  if (Array.isArray(nodeData.solutionSet)) return nodeData.solutionSet as SolutionLike[];
  if (typeof nodeData.solutionSet === 'string') {
    const parsed = parseJson<SolutionLike[]>(nodeData.solutionSet);
    return Array.isArray(parsed) ? parsed : [];
  }
  return [];
}

function storeFinalResult(deps: PacketExecutorDeps, finalNode: FlowNode | null, lastPacket: Packet | null) {
  const endStorageNode = deps.getNodes().find((n) => n.type === 'storage' && n.data.end === true) ?? null;
  const node = endStorageNode ?? finalNode;
  const storedSet = readStoredSet(node?.data);
  const storedSolution = node ? parseJson<SolutionLike>(node.data.solution) : null;
  const problem = deps.getProblemParsed();

  let payloadText: string;
  if (node?.type === 'storage' && storedSet.length > 0) {
    payloadText = formatCompact(storedSet[0]);
  } else if (storedSolution) {
    payloadText = formatCompact(storedSolution);
  } else if (lastPacket?.solution) {
    payloadText = formatCompact(lastPacket.solution);
  } else {
    payloadText = 'no result';
  }

  deps.appendGlobalTrace(`🏁 FINAL: ${payloadText}`);
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

  const currentIteration = Math.max(0, Math.floor(Number(loopNode?.data?.iteration ?? 0)));
  let seed: QueuedPacket;

  if (options.mode === 'iteration' && loopNode && currentIteration > 0) {
    const storedSolution = parseJson<SolutionLike>(loopNode.data?.solution);
    const storedSet = readStoredSet(loopNode.data);
    const packet: Packet = { idIteration: currentIteration, fromId: 'prev-close', solution: null };
    if (storedSet.length > 0) {
      packet.solutionSet = storedSet;
    } else if (storedSolution) {
      packet.solution = storedSolution;
    }
    seed = { target: loopNode.id, packet };
  } else {
    seed = { target: startNode.id, packet: { idIteration: 0, fromId: '__boot__' } };
  }

  const queue: QueuedPacket[] = [seed];
  const joinBuffers = new Map<string, Map<number, Map<string, Packet>>>();

  let loopVisits = 0;
  let stopped = false;
  let lastPacket: Packet | null = null;
  let processed = 0;

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

          const expectedArity = Math.max(2, resolveIncomingSources(deps, node.id).length);
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
          maxIterations: current.packet.maxIterations,
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

    const finalNode: FlowNode = endNode ?? loopNode;
    if (options.mode === 'full' || stopped) {
      storeFinalResult(deps, finalNode, lastPacket);
      const completedHistory = Array.isArray(finalNode?.data?.history)
        ? [...(finalNode.data.history as number[])]
        : [];
      if (completedHistory.length > 0) {
        deps.appendExecutionHistory(completedHistory);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Graph execution failed.';
    deps.appendGlobalTrace(`ERROR: ${message}`);
  }
}