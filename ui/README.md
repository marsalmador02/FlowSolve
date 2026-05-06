# UI de FlowSolve

Interfaz React para construir, ejecutar e inspeccionar flujos metaheuristicos basados en nodos.

## Rol en la arquitectura

- UI: modela el grafo y orquesta estado/visualizacion.
- Backend bridge: recibe `POST /execute` y lanza runtime Rust.
- Runtime Rust: ejecuta modos (`generate`, `mutation`, `selection`, etc.) y devuelve JSON.

## Mapa de carpetas (nivel arquitectura)

- `src/flow/`: ejecucion por nodos y runtime packet-based.
- `src/flow/runtime/engine/`: contratos internos (`Packet`, validaciones, reglas de aridad).
- `src/flow/runtime/executor/`: cola FIFO, joins, iteraciones, routing y cierre.
- `src/flow/runtime/components/`: componentes ejecutables por `NodeKind`.
- `src/services/`: contrato de red UI <-> backend.
- `src/hooks/`: puente entre estado React y runtime.
- `src/templates/`: plantillas de algoritmos prearmados.
- `src/types/`: contratos compartidos de UI y runtime.

## Regla de documentacion aplicada

- Cada carpeta responde una pregunta de arquitectura.
- Cada archivo clave inicia con contrato: proposito, entradas, salidas y limites.
- Cada export publico importante tiene JSDoc/TSDoc con efectos laterales cuando aplica.
- Se evita comentar JSX o logica obvia linea a linea.

## Generar HTML navegable

1. Instalar dependencias de UI:

```bash
npm install --prefix ui
```

2. Generar sitio de documentacion:

```bash
npm run docs:ui --prefix ui
```

3. Abrir resultado:

- `ui/docs/ui/index.html`

TypeDoc usa `ui/typedoc.json` y toma como entradas los exports publicos de runtime, servicios, hooks, templates y tipos.
