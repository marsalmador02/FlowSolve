# Herramienta visual de optimización metaheurística

Plataforma completa para construir, visualizar y ejecutar flujos de optimización usando una interfaz basada en nodos. Permite modelar rápidamente estrategias metaheurísticas sin escribir código, utilizando un motor en Rust.

## Arquitectura general

El sistema está dividido en tres capas principales:

```
┌─────────────────────────────────────────────────────────┐
│  UI (React + React Flow) - src/App.tsx                  │
│  - Modelado visual de flujos con nodos y aristas        │
│  - Configuración de parámetros por nodo                 │
│  - Ejecución completa o paso a paso                     │
│  - Visualización de trazas y resultados                 │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP (localhost:3000)
┌────────────────────▼────────────────────────────────────┐
│  Backend bridge (server.cjs)                            │
│  - REST API                                             │
│  - Intermediario entre UI y Rust                        │
│  - Gestión temporal de requests/responses               │
└────────────────────┬────────────────────────────────────┘
                     │ Invocación de proceso
┌────────────────────▼────────────────────────────────────┐
│  Motor Rust (prodef-runtime-rust)                       │
│  - Ejecución de modos: generate, mutation, crossover... │
│  - Evaluación de restricciones y objetivos              │
│  - Operadores: permutación, crossover, neighborhood     │
│  - Devolución de resultados JSON                        │
└─────────────────────────────────────────────────────────┘
```

## Requisitos previos

Asegúrate de tener instalado:

- **Node.js** (v16+) y **npm** (v7+)
- **Rust** (1.70+) y **cargo** (incluido con Rust)
- **Git** (para clonar el repo)

## Instalación e inicio rápido

### 1. Clonar e instalar dependencias

```bash
# Instala dependencias del proyecto principal y de la UI
npm run install:all
```

### 2. Iniciar todo con un solo comando

```bash
# Compila el runtime Rust en release y arranca UI + servidor bridge
npm run start:all
```

Luego abre **http://localhost:3000** en tu navegador.

## Estructura del Proyecto

```
proy/
├── README.md                          # Este archivo
├── package.json                       # Scripts de orquestación
├── examples/                          # Casos de prueba JSON
│   ├── assignment.json
│   ├── diet.json
│   ├── knapsack.json
│   ├── tsp.json
│   └── ...
│
├── prodef-runtime-rust/               # Motor de ejecución
│   ├── Cargo.toml
│   ├── src/
│   │   ├── main.rs                    # Punto de entrada del binario
│   │   ├── lib.rs                     # Fachada de librería (para doctests y docs)
│   │   ├── api/                       # Frontera JSON (parse, validation, response)
│   │   ├── domain/                    # Modelos de problema, solución, runtime
│   │   ├── operators/                 # Operadores: crossover, mutation, perturbation
│   │   ├── modes/                     # Handlers de ejecución (generate, mutation, etc.)
│   │   ├── evaluation/                # Evaluador de expresiones y restricciones
│   │   ├── search/                    # Búsqueda local
│   │   └── ...
│   └── README.md                      # Documentación del runtime
│
├── ui/                                # Interfaz React
│   ├── package.json
│   ├── src/
│   │   ├── App.tsx                    # Componente principal
│   │   ├── main.tsx                   # Entry point
│   │   ├── components/                # Componentes React
│   │   ├── services/prodefApi.ts      # Cliente HTTP del runtime
│   │   ├── hooks/useFlowRunner.ts     # Lógica de ejecución
│   │   ├── flow/                      # Orquestación de flujos
│   │   │   ├── algorithms/            # Template builders (GRASP, ILS, VNS, etc.)
│   │   │   ├── runtime/               # Motor packet-based
│   │   │   │   ├── engine/            # Validación, packets, contracts
│   │   │   │   ├── executor/          # Ejecución de nodos
│   │   │   │   └── components/        # Componentes por NodeKind
│   │   │   └── README.md              # Documentación de flow runtime
│   │   ├── types/                     # Tipos TypeScript
│   │   ├── templates/                 # Plantillas personalizadas
│   │   └── ...
│   ├── server.cjs                     # Backend bridge (Express)
│   ├── vite.config.ts                 # Config Vite
│   ├── tsconfig.json
│   └── README.md                      # Documentación de UI
│
└── scripts/                           # Scripts utilitarios
    └── test-examples.mjs              # Validador de ejemplos JSON
```

## Flujo de ejecución típico

1. **Usuario interactúa con la UI**
   - Arrastra nodos a la canvas
   - Conecta nodos con aristas
   - Configura parámetros en cada nodo

2. **Usuario hace clic en "Run"**
   - UI envía grafo serializado a backend bridge (`POST /execute`)
   - Backend escribe el request
   - Backend invoca binario Rust: `cargo run --release -- --exec-request <tempfile>`

3. **Motor Rust procesa**
   - Parsea JSON request
   - Construye `RuntimeProblem` desde definición del problema
   - Redirige al modo solicitado (e.g., `generate`, `mutation`, etc.)
   - Ejecuta operador/búsqueda según modo
   - Serializa `ExecutionResponse` (población, resultado, payload)
   - Retorna JSON al backend

4. **Backend bridge retorna respuesta al frontend**
   - UI recibe resultado
   - Actualiza visualización de nodos
   - Muestra trazas, métricas y resultados

## Flujo detallado (internals)

Este apartado describe paso a paso lo que ocurre desde que se crea/lanza el grafo hasta que aparece el resultado en la UI, con referencias a los módulos principales del proyecto:

1. Usuario diseña el grafo en la UI (drag & drop) — componente principal: `src/App.tsx`.
2. Al ejecutar, `App` delega a `useFlowRunner` (`src/hooks/useFlowRunner.ts`) que construye el conjunto de dependencias (refs y setters) usadas por el motor.
3. `useFlowRunner` llama a `runPacketExecutor` (`src/flow/runtime/executor/packetExecutor.ts`) con `mode: 'full'` o `mode: 'iteration'`.
4. `packetExecutor` valida el grafo (`validateGraph`) y serializa el `problem` desde el nodo `problem`.
5. Se encola un paquete semilla hacia el `startNode` (o hacia el `loopNode` si se reanuda), y comienza el bucle FIFO de procesamiento de paquetes.
6. Para cada paquete extraído de la cola:
   - Se obtiene el nodo destino y se crea el componente correspondiente vía `createComponent(kind)` (implementado en `src/flow/runtime/components/registry`).
   - Se arma el `ComponentContext` con `buildContext` (incluye `appendTrace`, `updateNodeData`, `getIncomingSources`, etc.).
   - Si el componente es un `JoinRuntimeComponent`, el executor acumula paquetes en `joinBuffers` por `nodeId` y `idIteration` hasta alcanzar la aridad necesaria.
   - Se ejecuta `component.execute` o `component.executeJoin`, que internamente puede llamar al backend Rust (si es un componente runtime) usando `services/prodefApi.callRuntimeExecute`.
   - El resultado (packet emitido) se enruta a las aristas salientes y se encola para su procesamiento.
7. Cuando el `termination` node procesa un paquete se registra una visita de bucle (`loopVisits`) y se actualiza `activeIterationRef`. En modo `full` se inserta un salto visual en la traza global entre iteraciones para separar salidas (implementación: `appendGlobalTrace('')` en `packetExecutor`).
8. Al finalizar (stop condition, budget o modo `iteration` que cierra el ciclo), `storeFinalResult` resume el mejor resultado encontrado y lo añade a la traza global (`🏁 FINAL: ...`).
9. Si el componente delegó a Rust, el binario de `prodef-runtime-rust` recibe un `ExecutionRequest`, ejecuta la lógica del modo solicitado (vía `modes::dispatch`), y devuelve un `ExecutionResponse` que la UI normaliza y presenta.

Puntos clave y archivos de referencia:
- `ui/src/flow/runtime/executor/packetExecutor.ts`: motor de paquetes y lógica de iteración.
- `ui/src/hooks/useFlowRunner.ts`: puente entre React state y executor.
- `ui/src/flow/runtime/components/*`: implementaciones de cada tipo de nodo.
   - `ui/src/services/prodefApi.ts`: cliente para `/execute`.
- `prodef-runtime-rust/src/modes/*` y `prodef-runtime-rust/src/domain/*`: lógica y modelos del runtime Rust.

Con esta descripción tienes una trazabilidad clara del dato: UI (grafo) → executor (packets) → componentes (local o remotos) → Rust runtime → resultado JSON → UI.
 
Detalles adicionales: servidor bridge (server.cjs)
------------------------------------------------

1. Recepción del request
   - La UI envía `POST /execute` con un JSON que contiene el grafo serializado y los parámetros de ejecución.
   - El servidor (archivo: ui/server.cjs) valida el cuerpo y crea un archivo temporal (`tmpfile.json`) donde escribe el `ExecutionRequest` completo.

2. Invocación del runtime
   - El bridge lanza el binario Rust con un comando similar a:

```bash
cargo run --release -- --exec-request /path/to/tmpfile.json
```

   - La invocación puede hacerse usando `child_process.spawn` o `execFile`. El bridge captura `stdout` y `stderr`, y espera la finalización del proceso.
   - Si el proceso devuelve un código distinto de 0 o produce un `stderr` no vacío, el bridge transforma ese error en una respuesta HTTP 500 con un cuerpo JSON estilo `{ error: string }`.

3. Mecanismo de tiempo y limpieza
   - El bridge aplica un timeout configurable para evitar procesos colgados; si el timeout expira, mata el proceso y responde error.
   - Tras terminar (éxito o error) el bridge borra el archivo temporal.

4. Respuesta al cliente
   - En caso de éxito el runtime escribe en `stdout` un `ExecutionResponse` JSON. El bridge lee ese JSON, comprueba estructura y lo reenvía al cliente UI como respuesta a la petición `POST /execute`.

Formato típico del `ExecutionRequest` (simplificado):

```json
{
  "mode": "generate-population",
  "problem": { /* nodo problem serializado */ },
  "params": { "population_size": 100, "seed": 123 }
}
```

Ejemplo de `ExecutionResponse` (simplificado):

```json
{
  "status": "ok",
  "best": { "solution": [1,2,3], "cost": 123.45 },
  "population": [ /* si aplica */ ],
  "trace": ["iter 1: ...", "iter 2: ..."],
  "metrics": { "evaluations": 2000, "time_ms": 512 }
}
```

Detalles adicionales: runtime Rust (prodef-runtime-rust)
---------------------------------------------------

1. Parseo y validación
   - El binario principal (`prodef-runtime-rust/src/main.rs`) carga el fichero indicado por `--exec-request`, parsea JSON y valida la estructura (`api::parse` y `api::validation`).
   - Si hay errores de validación, el runtime sale con código 2 y escribe un `ExecutionResponse` con `status: "error"` y campo `error` describiendo el problema.

2. Construcción del `RuntimeProblem`
   - A partir del `problem` en el request el runtime construye estructuras internas (`domain::model`, `domain::runtime`) que representen variables, restricciones y funciones objetivo.

3. Dispatch de modos
   - El runtime despacha según `mode` hacia `modes::dispatch`, que mapea a handlers en `src/modes/*`.
   - Cada handler sigue el contrato: recibe un `ExecutionRequest` y devuelve un `ExecutionResponse` serializable.

4. Ejecución y trazas
   - Dentro de un modo (por ejemplo `generate-population` o `local-search`) se actualizan trazas internas y métricas. El runtime puede incluir una lista `trace` con mensajes legibles por humanos.

5. Serialización de respuesta
   - Al finalizar, el runtime serializa un `ExecutionResponse` incluyendo: `status`, `best`, `population` (si aplica), `trace`, `metrics` y un `payload` opcional con datos específicos del modo.

6. Errores y códigos de salida
   - Errores controlados producen `status: "error"` en la respuesta, y el proceso normalmente termina con código 0 (el bridge reenvía el JSON).
   - Errores graves (panic, fallos no capturados) pueden terminar con código != 0; el bridge entonces considera la ejecución fallida.

Cómo vuelve la información a la UI y cómo se normaliza
----------------------------------------------------

1. Recepción por la UI
   - `ui/services/prodefApi.ts` recibe el `ExecutionResponse` y lo devuelve al `packetExecutor` (o al componente que hizo la llamada).

2. Normalización
   - La UI convierte campos del `ExecutionResponse` en actualizaciones para nodos:
     - `best` se mapea al `result` del `problem` node y a `node.data` del nodo `termination`.
     - `trace` se concatena a la `globalTrace` usando `appendGlobalTrace`.
     - `metrics` se muestran en la barra de estado o en paneles de monitorización.

3. Actualización visual
   - Los nodos que emitieron paquetes reciben `updateNodeData(nodeId, payload)` para mostrar soluciones parciales.
   - Si el `ExecutionResponse` contiene una `population`, la UI puede renderizarla en un panel específico o permitir inspección por el usuario.

4. Ejemplo end-to-end (resumen):
   - UI -> `POST /execute` con `ExecutionRequest` → server escribe `/tmp/rq.json` → lanza rust binary → rust procesa y escribe `ExecutionResponse` en stdout → bridge lee y responde HTTP 200 → UI recibe respuesta y actualiza trazas y nodos.

Conclusión y verificación
-------------------------

- Para validar los cambios end-to-end: ejecutar el bridge y el runtime (`npm run start:all`), lanzar una ejecución desde la UI y comprobar que la traza global, métricas y nodos se actualizan correctamente.
- Revisar logs del bridge (`stdout`/`stderr`) y la salida del runtime si hay errores.

## Modos de ejecución soportados

El motor soporta estos modos:

| Modo | Descripción |
|------|------------|
| `generate` | Genera una única solución aleatoria |
| `generate-population` | Genera población inicial de tamaño N |
| `mutation` | Aplica operador de mutación a solución |
| `crossover` | Cruce genético entre dos soluciones |
| `perturbation` | Perturbación de solución |
| `neighborhood` | Genera vecindad de una solución |
| `selection` | Selecciona mejores soluciones de población |
| `select-best` | Elige mejor solución de población |
| `local-search` | Búsqueda local |
| `temperature-acceptance` | Simulated Annealing (aceptación por temperatura) |
 

## Licencia y estado

En desarrollo activo. Código educativo/experimental.