/**
 * Algorithm Builder
 *
 * Creates predefined workflow templates for supported metaheuristic algorithms. It
 * acts as a factory that selects and builds the appropriate graph structure.
 */

import type { FlowNodeData } from '../../types/flow';
import {
  buildGraspTemplate,
  buildIlsTemplate,
  buildSimulatedAnnealingTemplate,
  buildTabuTemplate,
  buildVnsTemplate,
} from '../../templates/flowTemplates';

type UpdateNodeData = (id: string, patch: Partial<FlowNodeData>) => void;

export type AlgorithmTemplateKey = 'grasp' | 'ils' | 'vns' | 'tabu' | 'simulatedAnnealing';

/**
 * Creates the graph structure associated with a predefined algorithm template.
 *
 * @param kind Template identifier.
 * @param updateNodeData Callback used to update node data.
 * @returns Generated nodes and edges.
 */
export function buildAlgorithmTemplate(kind: AlgorithmTemplateKey, updateNodeData: UpdateNodeData) {
  switch (kind) {
    case 'grasp': return buildGraspTemplate(updateNodeData);
    case 'ils': return buildIlsTemplate(updateNodeData);
    case 'vns': return buildVnsTemplate(updateNodeData);
    case 'tabu': return buildTabuTemplate(updateNodeData);
    case 'simulatedAnnealing': return buildSimulatedAnnealingTemplate(updateNodeData);
  }
}