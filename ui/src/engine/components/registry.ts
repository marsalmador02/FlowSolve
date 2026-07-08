/**
 * Runtime Component Registry
 *
 * Maps flow node types to their executable runtime implementations. It is the
 * central entry point used to create runtime components during workflow execution.
 */

import type { NodeKind } from '../../types/flow';
import type { RuntimeComponent } from './base';
import { SingleGeneratorComponent } from './nodes/SingleGenerator';
import { LoopComponent } from './nodes/Loop';
import { StorageComponent } from './nodes/Storage';
import { SelectionBestComponent } from './nodes/SelectionBest';
import { LocalSearchComponent } from './nodes/LocalSearch';
import { NeighborhoodComponent } from './nodes/Neighborhood';
import { PerturbationComponent } from './nodes/Perturbation';
import { AcceptanceComponent } from './nodes/Acceptance';
import { SubtractionComponent } from './nodes/Subtraction';
import { TemperatureAcceptanceComponent } from './nodes/TemperatureAcceptance';
import { ReduceTemperatureComponent } from './nodes/ReduceTemperature';
import { ChangeNeighbourhoodComponent } from './nodes/ChangeNeighborhood';

export type ComponentFactory = () => RuntimeComponent;

const FACTORIES: Partial<Record<NodeKind, ComponentFactory>> = {
  singleSolution: () => new SingleGeneratorComponent(),
  termination: () => new LoopComponent(),
  storage: () => new StorageComponent(),
  selectionBest: () => new SelectionBestComponent(),
  localSearch: () => new LocalSearchComponent(),
  neighborhood: () => new NeighborhoodComponent(),
  perturbation: () => new PerturbationComponent(),
  acceptance: () => new AcceptanceComponent(),
  subtraction: () => new SubtractionComponent(),
  temperatureAcceptance: () => new TemperatureAcceptanceComponent(),
  reduceTemperature: () => new ReduceTemperatureComponent(),
  changeNeighborhood: () => new ChangeNeighbourhoodComponent(),
};

/**
 * Creates a runtime component instance for a given node type.
 *
 * @param kind Node type identifier.
 * @returns Runtime component instance or null if unsupported.
 */
export function createComponent(kind: NodeKind): RuntimeComponent | null {
  const factory = FACTORIES[kind];
  return factory ? factory() : null;
}

// True if a node kind can execute in the packet-based runtime.
export function isExecutableKind(kind: NodeKind): boolean {
  return Boolean(FACTORIES[kind]);
}