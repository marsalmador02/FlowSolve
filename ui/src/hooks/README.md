# Hooks: puente React <-> runtime

Los hooks coordinan estado React y ejecucion del motor.

## Responsabilidad

- Exponer acciones de ejecucion (`runFlowUntilEnd`, `runFlowNextStep`).
- Sincronizar refs y setters sin romper invariantes entre renders.
- Centralizar trazas y actualizacion de nodos.

## Archivo clave

- `useFlowRunner.ts`: compone dependencias para `runPacketExecutor`.

## Limites

- No define semantica de nodos.
- No ejecuta red directamente; delega a componentes/runtime.
