# Nodes: responsabilidades por tipo

Cada archivo implementa un `RuntimeComponent` para un `NodeKind` especifico.

## Grupos funcionales

- Generacion:
  - `singleGenerator.ts`
  - `populationGenerator.ts`
- Exploracion y mejora:
  - `neighborhood.ts`
  - `localSearch.ts`
  - `perturbation.ts`
  - `changeNeighborhood.ts`
- Evolutivos:
  - `selection.ts`
  - `selectionBest.ts`
  - `crossover.ts`
  - `mutation.ts`
- Aceptacion y control termico:
  - `acceptance.ts`
  - `temperatureAcceptance.ts`
  - `reduceTemperature.ts`
- Estado y ciclo:
  - `storage.ts`
  - `loop.ts`
  - `substraction.ts`

## Regla de implementacion

- `execute(...)` define contrato de entrada/salida para un paquete.
- Los nodos de join sincronizan entradas por iteracion antes de emitir.
- Si un nodo requiere semantica del runtime Rust, delega via `services/prodefApi.ts`.
