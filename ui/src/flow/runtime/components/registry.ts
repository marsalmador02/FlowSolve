/**
 * Runtime component registry.
 *
 * Purpose:
 * - Map each executable `NodeKind` to a concrete `RuntimeComponent` factory.
 *
 * Limit:
 * - Unknown kinds are intentionally treated as non-executable.
 */
import type { NodeKind } from '../../../types/flow';
import type { RuntimeComponent } from './base';
import { SingleGeneratorComponent } from './nodes/singleGenerator';
import { PopulationGeneratorComponent } from './nodes/populationGenerator';
import { LoopComponent } from './nodes/loop';
import { StorageComponent } from './nodes/storage';
import { SelectionBestComponent } from './nodes/selectionBest';
import { LocalSearchComponent } from './nodes/localSearch';
import { NeighborhoodComponent } from './nodes/neighborhood';
import { PerturbationComponent } from './nodes/perturbation';
import { AcceptanceComponent } from './nodes/acceptance';
import { SubstractionComponent } from './nodes/substraction';
import { SelectionComponent } from './nodes/selection';
import { CrossoverComponent } from './nodes/crossover';
import { MutationComponent } from './nodes/mutation';
import { TemperatureAcceptanceComponent } from './nodes/temperatureAcceptance';
import { ReduceTemperatureComponent } from './nodes/reduceTemperature';
import { ChangeNeighbourhoodComponent } from './nodes/changeNeighborhood';

export type ComponentFactory = () => RuntimeComponent;

const FACTORIES: Partial<Record<NodeKind, ComponentFactory>> = {
  singleSolution: () => new SingleGeneratorComponent(),
  populationGeneration: () => new PopulationGeneratorComponent(),
  termination: () => new LoopComponent(),
  storage: () => new StorageComponent(),
  selectionBest: () => new SelectionBestComponent(),
  localSearch: () => new LocalSearchComponent(),
  neighborhood: () => new NeighborhoodComponent(),
  perturbation: () => new PerturbationComponent(),
  acceptance: () => new AcceptanceComponent(),
  substraction: () => new SubstractionComponent(),
  selection: () => new SelectionComponent(),
  crossover: () => new CrossoverComponent(),
  mutation: () => new MutationComponent(),
  temperatureAcceptance: () => new TemperatureAcceptanceComponent(),
  reduceTemperature: () => new ReduceTemperatureComponent(),
  changeNeighborhood: () => new ChangeNeighbourhoodComponent(),
};

/**
 * Resolve a component instance for one node kind.
 */
export function createComponent(kind: NodeKind): RuntimeComponent | null {
  const factory = FACTORIES[kind];
  return factory ? factory() : null;
}

// True if a node kind can execute in the packet-based runtime.
export function isExecutableKind(kind: NodeKind): boolean {
  return Boolean(FACTORIES[kind]);
}
