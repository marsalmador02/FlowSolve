/**
 * Runtime Component Registry
 *
 * Maps flow node types to their executable runtime implementations. It is the
 * central entry point used to create runtime components during workflow execution.
 */

import type { NodeKind } from '../../../types/flow';
import type { RuntimeComponent } from './base';
import { SingleGeneratorComponent } from './nodes/singleGenerator';
import { LoopComponent } from './nodes/loop';
import { StorageComponent } from './nodes/storage';
import { SelectionBestComponent } from './nodes/selectionBest';
import { LocalSearchComponent } from './nodes/localSearch';
import { NeighborhoodComponent } from './nodes/neighborhood';
import { PerturbationComponent } from './nodes/perturbation';
import { AcceptanceComponent } from './nodes/acceptance';
import { SubtractionComponent } from './nodes/subtraction';
import { TemperatureAcceptanceComponent } from './nodes/temperatureAcceptance';
import { ReduceTemperatureComponent } from './nodes/reduceTemperature';
import { ChangeNeighbourhoodComponent } from './nodes/changeNeighborhood';

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