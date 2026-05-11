# FlowSolve UI - Guia Completa de la carpeta `ui/`

Este README documenta en detalle la carpeta `ui/`: arquitectura, funcionamiento del grafo, runtime packet-based, componentes, y descripcion archivo por archivo.

## 1. Que es esta UI

`ui/` es una aplicacion React + React Flow para:

1. Construir grafos de metaheuristicas (nodos + aristas).
2. Configurar parametros por nodo.
3. Ejecutar el flujo completo o por iteracion.
4. Ver trazas globales y trazas por nodo.
5. Cargar plantillas (GRASP, ILS, VNS, Tabu, SA, EA).

La ejecucion del grafo en UI se hace con un runtime interno packet-based. Para operaciones de solver/modos concretos, la UI puede llamar a backend mediante `prodefApi` (`/execute`).

## 2. Como funcionan los grafos en esta UI

### 2.1 Modelo de grafo

- Un grafo esta formado por `FlowNode[]` y `FlowEdge[]`.
- Los nodos tienen tipo canonico `NodeKind` (ej: `singleSolution`, `localSearch`, `acceptance`, `termination`, etc.).
- Las aristas definen flujo direccional de paquetes (`Packet`) entre nodos.
- Un nodo puede marcarse como `start` (inicio) y opcionalmente `end` (fin logico).

### 2.2 Validaciones estructurales previas

Antes de ejecutar, `graphValidation.ts` exige reglas como:

1. Exactamente un `start` (no `problem`).
2. Exactamente un nodo `termination` (Loop).
3. Restricciones de aridad en joins:
	- `acceptance` / `temperatureAcceptance` con 2 entradas.
	- `substraction` con 2 entradas y una desde `storage`.
	- `changeNeighborhood` con 2 entradas.
4. Si el start no es loop, debe conectar con loop.

Si falla, la ejecucion se corta y se escribe error en traza.

### 2.3 Runtime packet-based

El runtime usa paquetes (`Packet`) con:

- `idIteration`: iteracion actual.
- `fromId`: nodo emisor.
- `solution` o `solutionSet`.

`packetExecutor.ts` hace:

1. Valida grafo.
2. Crea paquete seed.
3. Recorre cola FIFO de paquetes.
4. Resuelve componente por `NodeKind` en `registry.ts`.
5. Ejecuta componente y enruta resultados por aristas salientes.
6. Maneja joins por iteracion + origen.
7. Registra traza global y por nodo.
8. Cierra en stop o por presupuesto maximo de paquetes.

### 2.4 Que componen los componentes

Cada componente runtime implementa contrato comun (`RuntimeComponent` / `JoinRuntimeComponent`) definido en `components/base.ts`:

- Entrada: `ComponentContext` + `Packet` (o array de `Packet` en joins).
- Salida: `ExecuteResult` (`emit`, `wait`, `stop`, `error`).
- Efectos: actualizar `FlowNodeData`, escribir traza, propagar payload.

## 3. Taxonomia de componentes (NodeKind)

Tipos soportados por la UI:

- `problem`: definicion JSON del problema.
- `singleSolution`: generacion de solucion unica.
- `populationGeneration`: generacion de poblacion.
- `selection`: seleccion de padres.
- `crossover`: recombinacion.
- `mutation`: mutacion.
- `localSearch`: mejora local.
- `perturbation`: perturbacion de solucion.
- `acceptance`: regla de aceptacion.
- `temperatureAcceptance`: aceptacion por temperatura.
- `reduceTemperature`: enfriamiento.
- `storage`: memoria de soluciones/historial.
- `termination`: control de iteraciones y parada.
- `changeNeighborhood`: cambio de vecindario.
- `neighborhood`: generacion de vecinos.
- `substraction`: diferencia de conjuntos/candidatos.
- `selectionBest`: seleccion del mejor.

Render UI de estos nodos: `src/components/flowNodes.tsx`.
Implementacion runtime: `src/flow/runtime/components/nodes/*.ts`.

## 4. Estructura de carpetas

### 4.2 Carpetas generadas o de entorno

- `node_modules/`: dependencias instaladas.
- `dist/`: build de produccion generado por Vite.
- `docs/`: documentacion HTML generada por TypeDoc.

Estas carpetas pueden variar entre ejecuciones y no son fuente canonica.

## 5. Catalogo completo archivo por archivo (UI)

Listado de archivos de desarrollo/configuracion actuales (excluye `node_modules`, `dist`, `docs` y artefactos temporales).

### 5.1 Raiz de `ui/`

- `index.html`: shell HTML principal donde monta React.
- `package.json`: scripts (`dev`, `build`, `test`, `serve`, `docs:ui`) y dependencias.
- `package-lock.json`: lockfile de npm para reproducibilidad.
- `README.md`: este documento.
- `server.cjs`: servidor Node/Express puente hacia runtime Rust y endpoints auxiliares.
- `tsconfig.json`: configuracion TypeScript del proyecto UI.
- `typedoc.json`: configuracion de generacion de docs TypeDoc.
- `vite.config.ts`: configuracion de Vite y Vitest (entorno tests, plugins).

### 5.3 `src/` (entrada y layout global)

- `src/main.tsx`: punto de entrada React; monta `App` en `#root`.
- `src/App.tsx`: contenedor principal; estado del canvas, plantillas, ejecucion y wiring general.
- `src/style.css`: estilos globales (sidebar, canvas, nodos, paneles, controles).

### 5.4 `src/components/`

- `src/components/FlowSidebar.tsx`: barra lateral de paleta, acciones de plantillas y utilidades.
- `src/components/FlowInspectorPanel.tsx`: panel derecho de inspeccion/edicion de nodo + traza global.
- `src/components/flowNodes.tsx`: renderizadores React Flow por tipo de nodo y handles de conexion.
- `src/components/FlowSidebar.test.tsx`: tests de comportamiento de sidebar.
- `src/components/FlowInspectorPanel.test.tsx`: tests del panel inspector/traza.

### 5.5 `src/constants/`

- `src/constants/flowCatalog.ts`: catalogo de etiquetas/nombres de componentes para UI.
- `src/constants/problemTemplates.ts`: JSON templates de problemas (knapsack, tsp, assignment, variantes).

### 5.6 `src/flow/`

- `src/flow/README.md`: guia conceptual de la capa `flow`.
- `src/flow/algorithms/algorithmBuilder.ts`: selector de plantilla por algoritmo (`grasp`, `ils`, etc.).

#### `src/flow/runtime/`

- `src/flow/runtime/README.md`: vista general del runtime packet-based.

##### `src/flow/runtime/components/`

- `src/flow/runtime/components/README.md`: contratos y mapa de componentes runtime.
- `src/flow/runtime/components/base.ts`: clases base/utilidades para componentes y joins.
- `src/flow/runtime/components/registry.ts`: mapa `NodeKind -> ComponentFactory`.

###### `src/flow/runtime/components/nodes/`

- `src/flow/runtime/components/nodes/README.md`: documentacion de nodos ejecutables.
- `src/flow/runtime/components/nodes/singleGenerator.ts`: generador de solucion unica.
- `src/flow/runtime/components/nodes/populationGenerator.ts`: generador de poblacion.
- `src/flow/runtime/components/nodes/selection.ts`: seleccion de individuos/padres.
- `src/flow/runtime/components/nodes/crossover.ts`: cruce/recombinacion.
- `src/flow/runtime/components/nodes/mutation.ts`: mutacion de individuos.
- `src/flow/runtime/components/nodes/localSearch.ts`: mejora local iterativa.
- `src/flow/runtime/components/nodes/perturbation.ts`: perturbacion para escapar de optimos locales.
- `src/flow/runtime/components/nodes/acceptance.ts`: regla de aceptacion basada en politica.
- `src/flow/runtime/components/nodes/temperatureAcceptance.ts`: aceptacion probabilistica por temperatura.
- `src/flow/runtime/components/nodes/reduceTemperature.ts`: actualizacion de temperatura/cooling.
- `src/flow/runtime/components/nodes/storage.ts`: almacenamiento de mejor/actual/historial.
- `src/flow/runtime/components/nodes/loop.ts`: control de iteracion, stop/continue y metadatos loop.
- `src/flow/runtime/components/nodes/neighborhood.ts`: generacion/evaluacion de vecindario.
- `src/flow/runtime/components/nodes/changeNeighborhood.ts`: ajuste de parametro de vecindario.
- `src/flow/runtime/components/nodes/substraction.ts`: join/resta entre dos flujos (ej. tabu-like).
- `src/flow/runtime/components/nodes/selectionBest.ts`: seleccion determinista del mejor candidato.

##### `src/flow/runtime/engine/`

- `src/flow/runtime/engine/README.md`: contratos internos del engine.
- `src/flow/runtime/engine/packet.ts`: tipos base (`Packet`, `ComponentContext`, `ExecuteResult`).
- `src/flow/runtime/engine/graphValidation.ts`: reglas estructurales del grafo antes de ejecutar.

##### `src/flow/runtime/executor/`

- `src/flow/runtime/executor/README.md`: descripcion del ejecutor.
- `src/flow/runtime/executor/packetExecutor.ts`: orquestador principal FIFO packet-based.

### 5.7 `src/hooks/`

- `src/hooks/README.md`: guia de hooks de ejecucion.
- `src/hooks/useFlowRunner.ts`: puente React state <-> runtime executor.

### 5.8 `src/services/`

- `src/services/README.md`: documentacion de integraciones HTTP/servicios.
- `src/services/prodefApi.ts`: cliente HTTP robusto para `/execute` con autodeteccion de base URL.
- `src/services/flowExporter.ts`: utilidades de validacion semantica/export shape (segun estado del proyecto).

### 5.9 `src/templates/`

- `src/templates/README.md`: guia de plantillas prearmadas.
- `src/templates/flowTemplates.ts`: definicion de nodos/aristas para GRASP, ILS, VNS, Tabu, SA, EA.

### 5.10 `src/test/`

- `src/test/setup.ts`: setup global de Vitest/RTL (ej. cleanup entre tests).

### 5.11 `src/types/`

- `src/types/README.md`: documentacion de tipos compartidos.
- `src/types/flow.ts`: tipos de grafo UI (`NodeKind`, `FlowNodeData`, `FlowNode`, `FlowEdge`).
- `src/types/runtimeContract.ts`: contrato tipado request/response para backend runtime.

### 5.12 `src/utils/`

- `src/utils/flowHelpers.ts`: helpers puros (`parseJson`, score helpers, utilidades de datos).

## 6. Flujo de ejecucion de extremo a extremo

1. Usuario arrastra nodos desde `FlowSidebar` al canvas (`App.tsx`).
2. `flowNodes.tsx` renderiza cada nodo y sus handles.
3. Usuario marca start/end y configura parametros en `FlowInspectorPanel`.
4. `useFlowRunner` prepara dependencias para runtime.
5. `packetExecutor` valida grafo (`graphValidation.ts`).
6. Se crean/encolan paquetes y se ejecutan componentes via `registry.ts`.
7. Cada componente procesa payload y emite `ExecuteResult`.
8. La traza se escribe en nodo y panel global.
9. En fin de flujo, se publica resumen final de solucion.

## 7. Scripts utiles

Desde `ui/`:

```bash
npm install
npm run dev
npm run test
npm run build
npm run serve
npm run docs:ui
```

## 8. Nota practica sobre mantenimiento

Si agregas un nuevo tipo de nodo, debes tocar como minimo:

1. `src/types/flow.ts` (nuevo `NodeKind` y campos de data si aplica).
2. `src/components/flowNodes.tsx` (render visual + handles).
3. `src/flow/runtime/components/nodes/*.ts` (logica runtime).
4. `src/flow/runtime/components/registry.ts` (registro de factory).
5. `src/templates/flowTemplates.ts` si quieres incluirlo en plantillas.
6. `src/constants/flowCatalog.ts` para nombre legible en UI.

Con esto mantienes alineadas capa visual, capa de tipos y capa de ejecucion.
