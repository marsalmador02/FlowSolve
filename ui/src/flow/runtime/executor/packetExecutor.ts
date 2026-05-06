/**
 * Packet-based executor for the UI flow runtime.
 *
 * Purpose:
 * - Convert a graph into deterministic packet execution.
 *
 * Inputs:
 * - Current graph state (`nodes`, `edges`) and shared UI dependencies.
 *
 * Outputs:
 * - Node updates, execution traces, and final summary pushed to UI state.
 *
 * Limits:
 * - Uses a max packet budget to avoid infinite loops.
 * - Supports `full` and `iteration` modes with loop-aware stop behavior.
 */
import type { FlowEdge, FlowNode, FlowNodeData, NodeKind } from '../../../types/flow';
import { parseJson } from '../../../utils/flowHelpers';
import { createComponent } from '../components/registry';
import type { ComponentContext, ExecuteResult, IncomingSource, Packet, SolutionLike } from '../engine/packet';
import { JoinRuntimeComponent, formatCompact, solutionScore, toPretty } from '../components/base';
import { validateGraph } from '../engine/graphValidation';

// External dependencies exposed by the hook to the executor.
export interface PacketExecutorDeps {
  getNodes: () => FlowNode[];
  getEdges: () => FlowEdge[];
  getNodeById: (id: string) => FlowNode | undefined;
  getProblemParsed: () => unknown;
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

// Find the source nodes that feed packets into a given target node.
function resolveIncomingSources(deps: PacketExecutorDeps, nodeId: string): IncomingSource[] {
  const incoming = deps.getEdges().filter((e) => e.target === nodeId);
  return incoming
    .map((edge) => {
      const node = deps.getNodeById(edge.source);
      if (!node) {
        return null;
      }
      return { id: node.id, type: node.type as NodeKind };
    })
    .filter((s): s is IncomingSource => s !== null);
}

// Find the target nodes that should receive packets emitted by a given source node.
function resolveOutgoingTargets(deps: PacketExecutorDeps, nodeId: string): IncomingSource[] {
  const outgoing = deps.getEdges().filter((e) => e.source === nodeId);
  return outgoing
    .map((edge) => {
      const node = deps.getNodeById(edge.target);
      if (!node) {
        return null;
      }
      return { id: node.id, type: node.type as NodeKind };
    })
    .filter((s): s is IncomingSource => s !== null);
}

// Find all nodes of a specific kind in the canvas, used for join and routing logic.
function resolveByKind(deps: PacketExecutorDeps, kind: NodeKind): IncomingSource[] {
  return deps
    .getNodes()
    .filter((n) => n.type === kind)
    .map((n) => ({ id: n.id, type: n.type as NodeKind }));
}

// Create the runtime context object passed to each component during execution.
function buildContext(deps: PacketExecutorDeps, node: FlowNode, problem: unknown): ComponentContext {
  return {
    nodeId: node.id,
    nodeType: node.type as NodeKind,
    nodeData: node.data,
    problem,
    updateNodeData: (patch) => deps.updateNodeData(node.id, patch),
    updateNodeDataById: (id, patch) => deps.updateNodeData(id, patch),
    appendTrace: (message) => {
      deps.appendTrace(node.id, message);
    },
    getIncomingSources: () => resolveIncomingSources(deps, node.id),
    getOutgoingTargets: () => resolveOutgoingTargets(deps, node.id),
    findNodesByKind: (kind) => resolveByKind(deps, kind),
  };
}

// Choose the best solution from a set by comparing scores.
function bestFromSet(set: SolutionLike[] | null | undefined): SolutionLike | null {
  if (!Array.isArray(set) || set.length === 0) {
    return null;
  }
  return set.reduce(
    (best, candidate) => (solutionScore(candidate) > solutionScore(best) ? candidate : best),
    set[0],
  );
}

// Read a stored solution set from node data, allowing both string and array representations.
function readStoredSet(nodeData: FlowNodeData | undefined): SolutionLike[] {
  if (!nodeData) {
    return [];
  }
  if (Array.isArray(nodeData.solutionSet)) {
    return nodeData.solutionSet as SolutionLike[];
  }
  if (typeof nodeData.solutionSet === 'string') {
    const parsed = parseJson<SolutionLike[]>(nodeData.solutionSet);
    return Array.isArray(parsed) ? parsed : [];
  }
  return [];
}

// After execution ends, summarize the final result and append it to the global trace.
function storeFinalResult(
  deps: PacketExecutorDeps,
  finalNode: FlowNode | null,
  lastPacket: Packet | null,
) {
  const storedSolution = finalNode ? parseJson<SolutionLike>(finalNode.data?.solution) : null;
  const storedSet = finalNode ? readStoredSet(finalNode.data) : [];
  const bestOfSet = bestFromSet(storedSet);
  const bestOfLastSet = bestFromSet(lastPacket?.solutionSet ?? null);

  let payloadText: string;
  if (storedSolution) {
    payloadText = formatCompact(storedSolution);
  } else if (bestOfSet) {
    payloadText = formatCompact(bestOfSet);
  } else if (lastPacket?.solution) {
    payloadText = formatCompact(lastPacket.solution);
  } else if (bestOfLastSet) {
    payloadText = formatCompact(bestOfLastSet);
  } else {
    payloadText = 'no result';
  }

  deps.appendGlobalTrace(`🏁 FINAL: ${payloadText}`);
}

/**
 * Execute the flow graph using a FIFO packet queue.
 *
 * Side effects:
 * - Validates graph topology.
 * - Dispatches packets to runtime components.
 * - Synchronizes join nodes by `idIteration` and source id.
 * - Appends node/global trace entries and updates node data.
 */
export async function runPacketExecutor(
  deps: PacketExecutorDeps,
  options: { mode: 'full' | 'iteration' },
): Promise<void> {
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
    const packet: Packet = {
      idIteration: currentIteration,
      fromId: 'prev-close',
      solution: null,
      solutionSet: undefined,
    };
    if (storedSet.length > 0) {
      packet.solutionSet = storedSet;
    } else if (storedSolution) {
      packet.solution = storedSolution;
    }
    seed = {
      target: loopNode.id,
      packet,
    };
  } else {
    seed = {
      target: startNode.id,
      packet: { idIteration: 0, fromId: '__boot__' },
    };
  }

  const queue: QueuedPacket[] = [seed];
  // nodeId, idIteration, fromId, Packet
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

        // When running the full flow, add a visual blank line between iterations
        // so the global trace separates iteration outputs (mirrors iteration mode).
        if (options.mode === 'full' && loopVisits >= 2) {
          deps.appendGlobalTrace('');
        }

        if (options.mode === 'iteration' && loopVisits >= 2) {
          const patch: Partial<FlowNodeData> = {};
          if (current.packet.solution) {
            patch.solution = toPretty(current.packet.solution);
          }
          if (Array.isArray(current.packet.solutionSet)) {
            patch.solutionSet = toPretty(current.packet.solutionSet);
            patch.setSize = current.packet.solutionSet.length;
          }
          if (Object.keys(patch).length > 0) {
            deps.updateNodeData(node.id, patch);
          }
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
          // bufferByIter:   necesario para separar las cosas por iteración.
          // bufferBySource: necesario para separar las cosas por origen dentro de una iteración.

          // Busca si ya hay un buffer para este nodo de join.
          // Si no existe, crea uno nuevo.
          const bufferByIter = joinBuffers.get(node.id) ?? new Map<number, Map<string, Packet>>();
          // Guarda ese buffer en joinBuffers usando el id del nodo.
          // Así queda disponible para la próxima vez que llegue un paquete a este join.
          joinBuffers.set(node.id, bufferByIter);
          // Dentro del buffer del nodo, busca el sub-buffer para esta iteración.
          // Si no existe, crea uno nuevo.
          const bufferBySource = bufferByIter.get(current.packet.idIteration) ?? new Map<string, Packet>();
          // Guarda el sub-buffer de esta iteración dentro del buffer del nodo.
          // Así queda registrado que ya hay paquetes para esa iteración.
          bufferByIter.set(current.packet.idIteration, bufferBySource);
          // Guarda el paquete actual dentro del sub-buffer.
          // Usa fromId para identificar quién envió ese paquete.
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

      if (result.kind === 'wait') {
        continue;
      }

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
        solution: result.solution ?? null,
        solutionSet: result.solutionSet ?? null,
      };
      lastPacket = emitted;

      const outgoing = deps.getEdges().filter((e) => e.source === node.id);
      for (const edge of outgoing) {
        queue.push({ target: edge.target, packet: emitted });
      }
    }  

    const finalNode: FlowNode = endNode ?? loopNode;
    if (options.mode === 'full' || stopped) {
      storeFinalResult(deps, finalNode, lastPacket);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Graph execution failed.';
    deps.appendGlobalTrace(`ERROR: ${message}`);
  }
}
