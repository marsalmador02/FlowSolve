# Components: semantica por nodo

Esta carpeta agrupa componentes ejecutables del runtime UI.

## Responsabilidad

- Implementar comportamiento por `NodeKind`.
- Encapsular llamadas al backend cuando un nodo requiere runtime Rust.
- Mantener una interfaz comun (`RuntimeComponent`).

## Estructura

- `base.ts`: clases base y helpers compartidos.
- `registry.ts`: mapping `NodeKind -> factory`.
- `nodes/`: implementaciones concretas por tipo de nodo.

## Regla de diseno

- El registro es el unico punto de alta de nuevos nodos ejecutables.
- Los componentes no conocen el grafo completo; operan via `ComponentContext`.
