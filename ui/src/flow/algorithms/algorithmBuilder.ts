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

const ALGORITHM_LABELS: Record<AlgorithmTemplateKey, string> = {
  grasp: 'GRASP',
  ils: 'ILS',
  vns: 'VNS',
  tabu: 'TabuSearch',
  simulatedAnnealing: 'SimulatedAnnealing',
};

export function buildAlgorithmTemplate(kind: AlgorithmTemplateKey, updateNodeData: UpdateNodeData) {
  const builders = {
    grasp: buildGraspTemplate,
    ils: buildIlsTemplate,
    vns: buildVnsTemplate,
    tabu: buildTabuTemplate,
    simulatedAnnealing: buildSimulatedAnnealingTemplate,
  };

  const graph = builders[kind](updateNodeData);
  return { ...graph, algorithmName: ALGORITHM_LABELS[kind] };
}