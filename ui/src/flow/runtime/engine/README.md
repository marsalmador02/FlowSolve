# Engine: contratos y validaciones

Esta carpeta documenta las reglas estructurales del runtime.

## Responsabilidad

- Definir tipos compartidos (`Packet`, `ComponentContext`, `ExecuteResult`).
- Validar precondiciones del grafo antes de ejecutar.

## Contratos clave

- `Packet`: unidad de transporte entre nodos.
- `ExecuteResult`: resultado canonico de cada componente (`emit`, `wait`, `stop`, `error`).
- `validateGraph`: regla de negocio para start, loop y aridades de joins.

## Limites

- No procesa cola ni enrutamiento; eso vive en `executor/`.
- No conoce detalles de React; opera con tipos de dominio de flujo.
