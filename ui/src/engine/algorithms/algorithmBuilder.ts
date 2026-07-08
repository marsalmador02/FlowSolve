/**
 * algorithmBuilder.ts
 * 
 * This module provides functionality to build predefined algorithm templates for the workflow graph.
 */

import type { FlowNodeData } from '../../types/flow';
import {
  buildGRASPTemplate,
  buildILSTemplate,
  buildSATemplate,
  buildTabuTemplate,
  buildVNSTemplate,
} from '../../templates/flowTemplates';

export type UpdateNodeData = (id: string, patch: Partial<FlowNodeData>) => void;

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
    case 'grasp': return buildGRASPTemplate(updateNodeData);
    case 'ils': return buildILSTemplate(updateNodeData);
    case 'vns': return buildVNSTemplate(updateNodeData);
    case 'tabu': return buildTabuTemplate(updateNodeData);
    case 'simulatedAnnealing': return buildSATemplate(updateNodeData);
  }
}