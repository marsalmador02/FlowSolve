import type { FlowNodeData } from '../../types/flow';
import {
  buildGraspTemplate,
  buildEvolutionaryTemplate,
  buildIlsTemplate,
  buildSimulatedAnnealingTemplate,
  buildTabuTemplate,
  buildVnsTemplate,
} from '../../templates/flowTemplates';

type UpdateNodeData = (id: string, patch: Partial<FlowNodeData>) => void;

export type AlgorithmTemplateKey = 'grasp' | 'ils' | 'vns' | 'tabu' | 'simulatedAnnealing' | 'evolutionary';

export function buildAlgorithmTemplate(kind: AlgorithmTemplateKey, updateNodeData: UpdateNodeData) {
  switch (kind) {
    case 'grasp':
      return buildGraspTemplate(updateNodeData);
    case 'ils':
      return buildIlsTemplate(updateNodeData);
    case 'vns':
      return buildVnsTemplate(updateNodeData);
    case 'tabu':
      return buildTabuTemplate(updateNodeData);
    case 'simulatedAnnealing':
      return buildSimulatedAnnealingTemplate(updateNodeData);
    case 'evolutionary':
      return buildEvolutionaryTemplate(updateNodeData);
    default:
      return buildGraspTemplate(updateNodeData);
  }
}
