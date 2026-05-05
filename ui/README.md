# FlowSolve UI - Editor Visual de Algoritmos de Optimización

## 📋 Tabla de Contenidos

1. [Visión General](#visión-general)
2. [Arquitectura](#arquitectura)
3. [Estructura de Carpetas](#estructura-de-carpetas)
4. [Componentes Principales](#componentes-principales)
5. [Flujo de Ejecución](#flujo-de-ejecución)
6. [Sistema de Tipos](#sistema-de-tipos)
7. [Cómo Usar](#cómo-usar)
8. [Desarrollo](#desarrollo)
9. [Comunicación Backend-Frontend](#comunicación-backend-frontend)
10. [Algoritmos y Templates](#algoritmos-y-templates)
11. [Troubleshooting](#troubleshooting)

---

## 🎯 Visión General

**FlowSolve UI** es una interfaz visual web para construir y ejecutar algoritmos de **optimización metaheurística** de forma interactiva. Permite a los usuarios:

- **Diseñar algoritmos gráficamente** mediante un editor visual drag-and-drop
- **Componer componentes** como generadores de soluciones, operadores genéticos, búsqueda local, aceptancia, etc.
- **Ejecutar paso a paso o completo** para probar y depurar el flujo algorítmico
- **Visualizar resultados** en tiempo real con trazas detalladas
- **Guardar y cargar templates** de algoritmos reutilizables (GRASP, ILS, VNS, Tabu, SA, Evolutivo, etc.)

**Stack tecnológico:**
- **React 18** + TypeScript para la UI
- **React Flow 11** para el editor de grafos interactivo
- **Vite** como bundler y dev server
- **Express + CORS** como servidor local que actúa de puente con Rust
- **Bash/Node.js** orquestación y build

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────┐
│         React UI Layer (main.tsx)       │
│  ┌─────────────────────────────────────┐│
│  │ App.tsx - Orquestador central       ││
│  │ - Gestión estado canvas (nodos/aristas)
│  │ - Carga de templates prebuilt       ││
│  └─────────────────────────────────────┘│
│               ↓ ↓ ↓                      │
│  ┌────────────────────────────────────┐ │
│  │ Componentes Visual                 │ │
│  ├────────────────────────────────────┤ │
│  │ • FlowSidebar - Paleta drag/drop  │ │
│  │ • flowNodes - Renderizado nodos   │ │
│  │ • FlowInspectorPanel - Problem/Trace │ │
│  │ • React Flow - Canvas & Controls  │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│      Execution Orchestration Layer      │
│  ┌─────────────────────────────────────┐│
│  │ useFlowRunner Hook                  ││
│  │ - Sincroniza estado React con runner││
│  │ - Expone operaciones: runFlow...   ││
│  │ - Mantiene contexto ejecución      ││
│  └─────────────────────────────────────┘│
│               ↓                          │
│  ┌─────────────────────────────────────┐│
│  │ packetExecutor                      ││
│  │ - Cola FIFO de paquetes             ││
│  │ - Enrutamiento por aristas          ││
│  │ - Validación grafo                 ││
│  │ - Orquestación componentes          ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│   Runtime Component Execution Layer     │
│  ┌─────────────────────────────────────┐│
│  │ Ejecutores por tipo:                ││
│  │ • Problem, Generation, Selection   ││
│  │ • Crossover, Mutation, LocalSearch ││
│  │ • Acceptance, Temperature, Loop    ││
│  │ • Storage, Termination             ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│   HTTP Bridge (server.cjs)              │
│  ┌─────────────────────────────────────┐│
│  │ Express Server (localhost:5180+)   ││
│  │ • POST /execute (modo + payload)   ││
│  │ • GET /health                      ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│   Rust Runtime (prodef-runtime-rust)    │
│   Ejecución semántica de algoritmos    │
└─────────────────────────────────────────┘
```

---

## 📁 Estructura de Carpetas

```
ui/
├── index.html                          # HTML raíz
├── vite.config.ts                      # Config Vite (bundler)
├── tsconfig.json                       # Config TypeScript
├── package.json                        # Dependencias y scripts
├── server.cjs                          # Servidor Express (puente HTTP)
│
├── src/
│   ├── main.tsx                        # Punto entrada React
│   ├── App.tsx                         # Contenedor principal
│   ├── style.css                       # Estilos globales
│   │
│   ├── components/                     # Componentes React
│   │   ├── flowNodes.tsx              # Renderizadores de nodos (Problem, Solution, Storage, etc.)
│   │   ├── FlowSidebar.tsx            # Panel lateral izquierdo (paleta, templates, acciones)
│   │   └── FlowInspectorPanel.tsx     # Panel lateral derecho (problem, flags, trace)
│   │
│   ├── types/                          # Definiciones de tipos TypeScript
│   │   ├── flow.ts                    # NodeKind, FlowNodeData, FlowNode, FlowEdge
│   │   └── runtimeContract.ts         # Contrato backend (request/response)
│   │
│   ├── constants/                      # Configuraciones estáticas
│   │   ├── flowCatalog.ts             # Mapeo de etiquetas de componentes
│   │   └── problemTemplates.ts        # JSON de ejemplo (Knapsack, TSP, Assignment)
│   │
│   ├── hooks/                          # Custom React Hooks
│   │   └── useFlowRunner.ts           # Orquestación ejecución (runFlow, runNextStep)
│   │
│   ├── services/                       # API client
│   │   └── prodefApi.ts               # HTTP requests al backend
│   │
│   ├── templates/                      # Algoritmos prebuilt
│   │   └── flowTemplates.ts           # Definición de GRASP, ILS, VNS, Tabu, SA, Evolutionary
│   │
│   ├── flow/                           # Motor de ejecución (core!)
│   │   ├── README.md                  # Documentación interna del motor
│   │   │
│   │   ├── algorithms/
│   │   │   └── algorithmBuilder.ts    # Factoría de templates
│   │   │
│   │   └── runtime/
│   │       ├── components/            # Ejecutadores de nodos
│   │       │   ├── base.ts           # Helper (JoinRuntimeComponent, solutionScore)
│   │       │   ├── registry.ts       # Registro de ejecutadores por NodeKind
│   │       │   └── [otros ejecutadores específicos]
│   │       │
│   │       ├── engine/               # Motor de packets
│   │       │   ├── packet.ts         # Tipos: Packet, ComponentContext
│   │       │   ├── graphValidation.ts # Validación estructura grafo
│   │       │   └── [tipos internos]
│   │       │
│   │       └── executor/
│   │           └── packetExecutor.ts # Punto entrada ejecución: cola FIFO + enrutamiento
│   │
│   └── utils/                          # Utilidades
│       └── flowHelpers.ts             # parseJson, resultScore
```

---

## 🔧 Componentes Principales

### 1. **main.tsx** - Punto de Entrada React

```typescript
// Crea el root React, renderiza App bajo StrictMode
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**Propósito:** Inicializar el runtime de React y entregar control a App.tsx.  
**Flujo en ejecución:** Es el primero en ejecutarse cuando cargas la página.

---

### 2. **App.tsx** - Orquestador Central

**Responsabilidades clave:**
- Gestiona estado reactivo del canvas: `[nodes, setNodes]`, `[edges, setEdges]`, etc.
- Integra React Flow para renderizado, drag-and-drop, conexiones
- Carga templates personalizados del localStorage
- Proporciona callbacks de ejecución a subcomponentes: `runFlow()`, `runFlowNextStep()`

**Estado principal:**
```typescript
const [nodes, setNodes] = useState<FlowNode[]>([]);      // Nodos en canvas
const [edges, setEdges] = useState<FlowEdge[]>([]);      // Aristas (conexiones)
const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);  // Nodo activo
const [globalTrace, setGlobalTrace] = useState<string[]>([]);            // Log ejecución
const [neighborhoodSize, setNeighborhoodSize] = useState(1); // Variable para VNS
const [customTemplates, setCustomTemplates] = useState<StoredTemplate[]>([]);
// catalog removed: UI relies on local labels and templates
```

**Flujo típico en App:**
1. `useEffect` inicial → cargar templates personalizados (localStorage)
2. `useEffect` → cargar templates personalizados del localStorage
3. Usuario arrastra componentes desde `FlowSidebar` → `onDragOver` + `onDrop` crean nodos
4. Usuario conecta nodos con aristas → callbacks de React Flow actualizan estado
5. Usuario selecciona nodo → `setSelectedNode` actualiza `FlowInspectorPanel`
6. Usuario hace click en "Run Flow" o "Run Next Step" → llama a `useFlowRunner.runFlowUntilEnd()` o `runFlowNextStep()`

---

### 3. **FlowSidebar.tsx** - Panel Lateral Izquierdo

**Estructura:**

```
┌──────────────────────────┐
│ 🎛️ Control Buttons      │
├──────────────────────────┤
│ [Run Flow]               │
│ [Run Next Step]          │
│ [Reset]                  │
├──────────────────────────┤
│ 📥 Cargar Template       │
├──────────────────────────┤
│ ✅ GRASP                 │
│ ✅ ILS                   │
│ ✅ VNS                   │
│ ✅ Tabu Search           │
│ ✅ Simulated Annealing   │
│ ✅ Evolutionary          │
├──────────────────────────┤
│ 💾 Templates Personalizados
├──────────────────────────┤
│ [Save as Custom]         │
│ [Load Custom #1]         │
│ [Delete Custom #1]       │
│ [Export Custom #1]       │
│ [Import from JSON]       │
├──────────────────────────┤
│ 🧩 Componentes (Paleta) │
├──────────────────────────┤
│ 📄 Problem               │ ← Drag to canvas
│ 👥 Population Gen.       │
│ 🎯 Selection             │
│ 🧬 Crossover             │
│ 🧫 Mutation              │
│ 🔍 Local Search          │
│ ... más ...              │
└──────────────────────────┘
```

**Funcionalidad de drag-and-drop:**
```typescript
onDragStart={(event) => {
  event.dataTransfer.setData('application/reactflow', item.kind);
  event.dataTransfer.effectAllowed = 'move';
}}
```

Cuando dropper un ítem en el canvas:
- `onDragOver` en App → acepta si es `application/reactflow`
- `onDrop` → crea nuevo nodo con tipo `item.kind` en la posición del drop

---

### 4. **flowNodes.tsx** - Renderizadores de Nodos

Exporta `flowNodeTypes` - un mapper de tipo NodeKind a componente React:

```typescript
const flowNodeTypes: NodeTypes = {
  problem: ProblemNode,
  singleSolution: SingleSolutionNode,
  populationGeneration: PopulationGenerationNode,
  selection: SelectionNode,
  crossover: CrossoverNode,
  mutation: MutationNode,
  localSearch: LocalSearchNode,
  perturbation: PerturbationNode,
  acceptance: AcceptanceNode,
  temperatureAcceptance: TemperatureAcceptanceNode,
  // ... más tipos
};
```

**Ejemplo: ProblemNode**
```typescript
function ProblemNode({ data }: { data: FlowNodeData }) {
  return (
    <div className={nodeClassName(data)}>
      <div className="custom-node-title">{data.label}</div>
      <div className="custom-node-subtitle">Problem definition</div>
    </div>
  );
}
```

**Handles (puertos de entrada/salida):**
Cada nodo incluye `<Handle>` elementos de React Flow:
```typescript
<Handle type="target" position={Position.Left} />   // Entrada
<Handle type="source" position={Position.Right} />  // Salida
```

Algunos nodos tienen handles especializados:
- `in-local`: entrada desde Local Search
- `in-storage`: entrada desde Storage
- `to-single`: salida a nodo de solución única
- `to-storage`: salida a almacenamiento

---

### 5. **FlowInspectorPanel.tsx** - Panel Lateral Derecho

**Secciones:**

1. **Editor JSON del Problem** (solo si seleccionas nodo "Problem")
   ```typescript
   <textarea
     value={selectedData?.json || ''}
     onChange={(e) => onProblemJsonChange(e.target.value)}
   />
   ```
   Con botones predefinidos: "Load Knapsack", "Load TSP", "Load Assignment", etc.

2. **Marcadores Start/End del nodo**
   ```typescript
   <input
     type="checkbox"
     checked={selectedData?.start || false}
     onChange={(e) => setNodeStart(selectedNode!.id, e.target.checked)}
   />
   Label: "Start" / "End"
   ```

3. **Traza Global** (log en tiempo real de ejecución)
   ```typescript
   <div className="trace-container">
     {globalTrace.map((line, idx) => (
       <div key={idx}>{line}</div>
     ))}
   </div>
   ```

---

### 6. **useFlowRunner Hook** - Orquestación de Ejecución

**Propósito:** Puente entre estado React y motor de ejecución (packetExecutor).

**Interfaz:**
```typescript
const {
  runFlowUntilEnd,
  runFlowNextStep,
  appendNodeTraceMessage,
  // otros helpers...
} = useFlowRunner({
  nodesRef,
  edgesRef,
  activeIterationRef,
  neighborhoodSizeRef,
  setNodes,
  setSelectedNode,
  setGlobalTrace,
  setNeighborhoodSize,
});
```

**Funciones principales:**

- **`runFlowUntilEnd()`** → Ejecuta el grafo completo hasta alcanzar termination o maxIterations
  ```typescript
  export async function runFlowUntilEnd(
    mode: 'full',
    deps: PacketExecutorDeps
  ): Promise<void> {
    // Valida grafo
    // Resuelve nodo start
    // Encola paquete inicial
    // Procesa paquetes hasta fin
  }
  ```

- **`runFlowNextStep()`** → Ejecuta una única iteración del loop y se detiene
  ```typescript
  export async function runFlowNextStep(
    mode: 'iteration',
    deps: PacketExecutorDeps
  ): Promise<void> {
    // Similar a runFlowUntilEnd pero modo 'iteration'
    // Se detiene al cerrar un ciclo del loop
  }
  ```

**Contexto de ejecución:**
Mantiene un `executionContextRef` para soportar múltiples nodos del mismo tipo:
```typescript
const executionContextRef = useRef<{
  targetId: string;
  targetType: NodeKind
} | null>(null);
```

---

### 7. **prodefApi.ts** - Cliente HTTP

**Endpoints:**

1. **`POST /execute`** → Ejecuta un modo específico con payload
   ```typescript
   export async function callRuntimeExecute(
     req: RuntimeExecutionRequest
   ): Promise<RuntimeExecutionResponse> {
     const response = await fetchFromApi('/execute', {
       method: 'POST',
       body: JSON.stringify(req),
     });
     // ...
     return response.json();
   }
   ```

**Resolución de URL del servidor:**
- Intenta puertos en rango `5180-5190` (configurable via `VITE_PRODEF_API_BASE`)
- Recuerda el first resolved base para futuras llamadas

---

### 8. **flowTemplates.ts** - Algoritmos Prebuilt

Exporta builders que construyen grafo precargado para cada algoritmo:

```typescript
export function buildGraspTemplate(updateNodeData: UpdateNodeData) {
  const nodes: FlowNode[] = [
    { id: 'problem', type: 'problem', ... },
    { id: 'termination-template', type: 'termination', ... },
    { id: 'single-solution-gen', type: 'singleSolution', ... },
    // ...
  ];
  const edges: FlowEdge[] = [
    mkEdge('e1', 'termination-template', 'single-solution-gen'),
    // ... interconexiones
  ];
  return { nodes, edges };
}

// Similar para:
// - buildIlsTemplate
// - buildVnsTemplate
// - buildTabuTemplate
// - buildSimulatedAnnealingTemplate
// - buildEvolutionaryTemplate
```

---

## 🔄 Flujo de Ejecución Completo

### Escenario: Usuario presiona "Run Flow"

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. Usuario hace click en "Run Flow" button en FlowSidebar       │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ 2. App.tsx → llama a useFlowRunner.runFlowUntilEnd()            │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ 3. useFlowRunner hook verifica que el runner esté inicializado  │
│    y delega a packetExecutor                                    │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ 4. packetExecutor.runPacketExecutor(mode: 'full', deps)         │
│    ├── Valida grafo (nodos start/end conectados correctamente) │
│    ├── Resuelve nodo start                                     │
│    ├── Lee problema JSON desde nodo Problem                    │
│    ├── Crea paquete inicial { problem, solution: null }        │
│    └── Encola paquete en cola FIFO QueuedPacket[]             │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ 5. Loop principal de packetExecutor                             │
│    while (queue.length > 0 && !shouldStop && packets < max)    │
│    {                                                             │
│      packet = queue.shift()                                    │
│      targetNode = resolveNextTarget(packet)                   │
│                                                                 │
│      6. Buscar ejecutador para targetNode.type en registry     │
└──────────────────────────────────────────────────────────────────┘
```

### Dentro del loop: Proceso de un nodo

```
┌──────────────────────────────────────────────────────────────────┐
│ 6. createComponent(nodeType, context)                            │
│    Retorna un objeto { execute(packet) -> Promise<Packet> }    │
│                                                                  │
│    Tipos de componentes:                                        │
│    • ProblemComponent   → Carga definición de problema         │
│    • GenerationComponent → Genera solución inicial             │
│    • SelectionComponent → Selecciona de población              │
│    • CrossoverComponent → Cruza dos soluciones                 │
│    • MutationComponent  → Muta solución                        │
│    • LocalSearchComponent → Mejora por búsqueda local          │
│    • TerminationComponent → Define loop y condición parada      │
│    • StorageComponent   → Almacena soluciones                  │
│    • AcceptanceComponent → Decide aceptar o rechazar           │
│    etc.                                                         │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ 7. component.execute(packet) se ejecuta                         │
│                                                                  │
│    Algunas componentes hacen HTTP call a backend Rust:         │
│                                                                  │
│    if (component.needsRemoteExecution) {                       │
│      response = await prodefApi.callRuntimeExecute({          │
│        problem: packet.problem,                                │
│        execution: {                                            │
│          mode: 'generate',      // o local-search, etc.       │
│          payload: {...}                                        │
│        }                                                        │
│      })                                                         │
│      result = response.result                                  │
│    } else {                                                     │
│      result = executeLocally(packet)  // JS puro              │
│    }                                                            │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ 8. Componente actualiza nodeData vía deps.updateNodeData()      │
│                                                                  │
│    • Guarda solución/población: nodeData.solution, .solutionSet│
│    • Guarda trazas: nodeData.trace                             │
│    • Actualiza estado: nodeData.iteration, .bestScore, etc.    │
│                                                                  │
│    15. App.tsx recibe setNodes callback → re-render visual    │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ 9. Componente genera OutputPacket (puede ser único o múltiple) │
│                                                                  │
│    • Si es nodo sin bifurcación:                              │
│      Retorna { solution, solutionSet, ... }                  │
│                                                                  │
│    • Si es Termination (loop):                               │
│      Si shouldStop: Retorna null (termina rama)              │
│      Si continue: Retorna packet (bifurca back a rama)       │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ 10. packetExecutor enruta OutputPacket(s) según aristas         │
│                                                                  │
│     for each outgoingEdge from targetNode {                    │
│       nextTarget = edge.target                                │
│       queue.enqueue({ target: nextTarget, packet })          │
│     }                                                           │
│                                                                  │
│     Vuelve a paso 5                                           │
└──────────────────────────────────────────────────────────────────┘
```

### Final de ejecución

```
┌──────────────────────────────────────────────────────────────────┐
│ 11. Salida del loop:                                             │
│     • Si queue vacía: Grafo procesado completamente            │
│     • Si packets >= MAX: Overflow, probablemente loop infinito │
│     • Si error: Capturado y mostrado en FlowInspectorPanel   │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ 12. packetExecutor retorna a useFlowRunner                       │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ 13. App.tsx finalmente se renderiza con:                        │
│     • Nodos con datos actualizados (soluciones, scores)        │
│     • globalTrace poblado con logs                             │
│     • selectedNode actualizado con resultado final             │
└──────────────────────────────────────────────────────────────────┘
```

---

## 📊 Sistema de Tipos

### `types/flow.ts` - Core Flow Types

```typescript
// Enumeración de todos los tipos de nodos soportados
export type NodeKind =
  | 'problem'
  | 'singleSolution'
  | 'populationGeneration'
  | 'selection'
  | 'crossover'
  | 'mutation'
  | 'localSearch'
  | 'perturbation'
  | 'acceptance'
  | 'temperatureAcceptance'
  | 'reduceTemperature'
  | 'storage'
  | 'termination'
  | 'changeNeighborhood'
  | 'neighborhood'
  | 'substraction'
  | 'selectionBest';

// Datos adjuntos a cada nodo en React Flow
export interface FlowNodeData {
  label: string;                    // Nombre mostrado (ej: "GRASP Selector")
  start?: boolean;                  // ¿Es nodo de inicio?
  end?: boolean;                    // ¿Es nodo final?
  isRunning?: boolean;              // Animación de ejecución
  json?: string;                    // JSON serializado (problema, config)
  solution?: string;                // Solución individual JSON
  trace?: string;                   // Log del nodo
  error?: string;                   // Mensaje error
  
  // Campos específicos por tipo de nodo
  policy?: AcceptancePolicy;        // Para acceptance
  threshold?: number;               // Para threshold acceptance
  temperatureInitial?: number;      // Para simulated annealing
  coolingAlpha?: number;            // Tasa enfriamiento
  
  maxIterations?: number;           // Para termination
  iteration?: number;               // Iteración actual
  shouldStop?: boolean;             // Flag parada
  
  populationSize?: number;          // Tamaño población
  tournamentSize?: number;          // Para torneo
  mutationRate?: number;            // Tasa mutación
  neighborhoodValue?: number;       // Para VNS
  
  // Almacenamiento
  solutionSet?: string | SolutionLike[]; // Conjunto de soluciones
  bestScore?: number;               // Mejor score visto
  currentScore?: number;            // Score actual
  
  onUpdate?: (patch: Partial<FlowNodeData>) => void;
}

export interface AcceptancePolicy {
  'bestOnly' | 'improveCurrent' | 'threshold' | 'always'
}

// Alias tipadas
export type FlowNode = Node<FlowNodeData>;  // React Flow Node
export type FlowEdge = Edge;                 // React Flow Edge
```

### `types/runtimeContract.ts` - Backend Contract

```typescript
// Modos de ejecución que el backend Rust soporta
export type RuntimeExecutionMode =
  | 'generate'                    // Generar solución inicial
  | 'generate-population'         // Generar población
  | 'local-search'                // Búsqueda local
  | 'select-best'                 // Seleccionar mejor
  | 'temperature-acceptance'      // Aceptancia por temperatura
  | 'selection'                   // Selección de padres
  | 'crossover'                   // Cruce genético
  | 'mutation'                    // Mutación genética
  | 'perturbation'                // Perturbación
  | 'neighborhood'                // Cambio vecindad
  | 'catalog';                    // Obtener catálogo

// Descriptor de componente del backend
export interface RuntimeComponentDescriptor {
  kind: string;                   // ID único (ej: 'singleSolution')
  label: string;                  // Label UI (ej: '🧪 Single Solution Generation')
  category: string;               // 'generation', 'improvement', 'control'
  stateful: boolean;              // ¿Mantiene estado entre ejecuciones?
}

// Request HTTP POST /execute
export interface RuntimeExecutionRequest {
  problem?: unknown;              // Definición problema (JSON)
  execution: {
    mode: RuntimeExecutionMode;
    payload?: RuntimeExecutionPayload;
  };
}

// Payload de ejecución
export interface RuntimeExecutionPayload {
  [key: string]: unknown;
  count?: number;                 // Cantidad a generar
  steps?: number;                 // Iteraciones local search
  solution?: number[];            // Solución actual
  candidates?: unknown[];         // Conjunto de candidatos
  mutationRate?: number;          // Tasa mutación
  k?: number;                     // Tamaño vecindad
  maxNeighbors?: number;          // Máx explorar
}

// Response HTTP POST /execute
export interface RuntimeExecutionResponse {
  result?: SolutionLike;          // Solución única (si aplica)
  population?: SolutionLike[];    // Población (si aplica)
  payload?: unknown;              // Respuesta genérica
  catalog?: RuntimeComponentDescriptor[]; // Catálogo (si aplica)
  error?: string;                 // Mensaje error
}

export interface SolutionLike {
  variableValue: unknown;
  goalValues: number[];
  isFeasible: boolean;
  metadata?: unknown;
}
```

---

## 🚀 Cómo Usar

### 1. Instalación y Setup

```bash
# Instalar dependencias de la UI
cd ui
npm install

# Compilar el backend Rust (si no está compilado)
cd ../prodef-runtime-rust
cargo build --release
cd ../ui

# Iniciar el servidor (en terminal separada)
npm run serve       # Inicia Express en :5180+

# En otra terminal: iniciar dev server
npm run dev         # Vite en http://localhost:5173
```

### 2. Flujo Básico de Usuario

1. **Abrir navegador** → `http://localhost:5173`
2. **Elegir template** → Click "Load GRASP" / "Load ILS" / etc. en FlowSidebar
3. **Personalizar problema** → 
   - Click en nodo "Problem"
  - Editar JSON o cargar ejemplo desde FlowInspectorPanel
4. **Ajustar parámetros** → Click en cada componente, editar valores
5. **Ejecutar**:
   - "Run Flow" → Ejecución completa
   - "Run Next Step" → Una iteración del loop
6. **Inspeccionar resultados**:
   - Soluciones mostradas en cada nodo
  - Trace global en FlowInspectorPanel
   - Seleccionar nodo para ver trazas específicas

### 3. Guardar y Cargar Templates Personalizados

```typescript
// Guardar
• Click "Save Custom Template" en FlowSidebar
• Ingresar nombre
• Se guarda en localStorage

// Cargar
• Section "Plantillas Personalizadas"
• Click "[Load Custom #1]"

// Exportar a JSON
• Click "[Export Custom #1]"
• Descarga JSON del grafo

// Importar desde JSON
• Click "[Import from JSON]"
• Seleccionar archivo o pegar JSON
```

Local storage key: `prodef.ui.customTemplates`

---

## 🛠️ Desarrollo

### Agregar un Nuevo Tipo de Nodo

#### 1. Definir el tipo

```typescript
// En types/flow.ts
export type NodeKind = 
  | 'myNewComponentType'
  | ...;  // Agregar acá
```

#### 2. Crear renderizador

```typescript
// En components/flowNodes.tsx
function MyNewComponentNode({ data }: { data: FlowNodeData }) {
  return (
    <div className={nodeClassName(data)}>
      <div className="custom-node-title">{data.label}</div>
      <div className="custom-node-subtitle">My description</div>
      {/* Mostrar datos relevantes */}
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

// En flowNodeTypes
export const flowNodeTypes: NodeTypes = {
  myNewComponentType: MyNewComponentNode,
  ...
};
```

#### 3. Crear ejecutador

```typescript
// En flow/runtime/components/myNewComponent.ts
import { JoinRuntimeComponent } from './base';
import type { Packet, ComponentContext } from '../engine/packet';

export class MyNewRuntimeComponent extends JoinRuntimeComponent {
  async execute(packet: Packet, context: ComponentContext): Promise<Packet> {
    context.updateNodeData({
      trace: `Executing MyNewComponent...`,
    });

    // Hacer operación (local o remota)
    const result = await someOperation(packet);

    // Retornar paquete modificado
    return {
      ...packet,
      solution: result,
    };
  }
}
```

#### 4. Registrarlo en el registry

```typescript
// En flow/runtime/components/registry.ts
import { MyNewRuntimeComponent } from './myNewComponent';

export function createComponent(kind: NodeKind, context: ComponentContext) {
  switch (kind) {
    case 'myNewComponentType':
      return new MyNewRuntimeComponent();
    // ...
  }
}
```

#### 5. Agregar al catálogo visual

```typescript
// En constants/flowCatalog.ts
export const COMPONENT_LABELS: Record<string, string> = {
  MyNewComponent: '🆕 My New Component',
  ...
};
```

---

### Debuggear Ejecución

1. **Abrir DevTools** → F12
2. **Console tab** → Ver logs de JS, errores
3. **Network tab** → Inspeccionar requests HTTP a `/execute`
4. **Global Trace** → FlowInspectorPanel muestra todos los append messages
5. **Trace por nodo** → Selecciona nodo para ver su `trace` específico

---

### Estructura de un Backend Component (referencia)

```typescript
class ComponentName extends JoinRuntimeComponent {
  // Handle múltiples entradas si hay bifurcación
  async joinInputs(packets: Packet[]): Promise<Packet> { ... }
  
  // Ejecutar lógica principal
  async execute(packet: Packet, context: ComponentContext): Promise<Packet> {
    // 1. Log inicial
    context.appendTrace(`Starting ${this.constructor.name}...`);
    
    // 2. Validar entrada
    if (!packet.solution) {
      throw new Error('Expected solution in packet');
    }
    
    // 3. Hacer operación
    // a) Local (JS puro)
    // b) Remota (HTTP call a Rust)
    
    // 4. Actualizar nodo
    context.updateNodeData({ solution: result, trace: ... });
    
    // 5. Retornar paquete para siguiente nodo
    return { ...packet, solution: result };
  }
}
```

---

## 🔌 Comunicación Backend-Frontend

### Arquitectura

```
┌─────────────────┐
│ React UI        │
│ (TS/JS)         │
└────────┬────────┘
         │
    HTTP │ JSON
         │
┌────────▼────────┐
│ Express Server  │
│ (Node.js)       │
│                 │
│ • Recibe        │
│ • Serializa     │
│ • Escribe JSON  │
│ • Llama Rust    │
│ • Lee resultado │
│ • Parsea        │
│ • Devuelve HTTP │
└────────┬────────┘
         │
    CLI  │ JSON
         │
┌────────▼─────────────────────┐
│ prodef-runtime-rust (binary) │
│ • Lee JSON stdin             │
│ • Ejecuta semántica alg.     │
│ • Escribe JSON stdout        │
└─────────────────────────────┘
```

### HTTPRequest/Response

**Request:**
```json
{
  "problem": {
    "name": "Knapsack",
    "variables": [...],
    "goals": [...]
  },
  "execution": {
    "mode": "generate",
    "payload": {
      "count": 50
    }
  }
}
```

**Response:**
```json
{
  "population": [
    {
      "variableValue": [0, 1, 0, 1, 1],
      "goalValues": [45, 70],
      "isFeasible": true
    },
    ...
  ]
}
```

### Flojomanual de llamada

```typescript
// En componente ejecución
const response = await callRuntimeExecute({
  problem: context.problem,
  execution: {
    mode: 'local-search',
    payload: {
      solution: packet.solution.variableValue,
      steps: 20
    }
  }
});

// server.cjs recibe POST /execute
// 1. Serializa request a JSON temporal
// 2. Llama: prodef-runtime-rust < request.json > response.json
// 3. Deserializa response
// 4. Envía de vuelta al frontend

// Frontend recibe response
const result = response.result;  // Solución mejorada
updateNodeData({ solution: result });
```

---

## 📚 Algoritmos y Templates

### Templates Prebuilt

Cada template es un grafo pre-configurado de nodos + aristas:

#### **GRASP** - Greedy Randomized Adaptive Search Procedure
```
Problem → [Termination (loop)] → SingleSolution →
          ↓                        ↓
          ←─ LocalSearch ─ Acceptance ← StorageComponent
```
- Genera solución inicial aleatoria
- Mejora con búsqueda local
- Aceptancia por mejor solución visto

#### **ILS** - Iterated Local Search
```
Problem → Termination → SingleSolution → LocalSearch →
          ↑              ↓                  ↓
          └─ Acceptance ← Perturbation
```
- Genera solución
- Mejora localmente
- Perturba para escapar óptimos locales
- Itera

#### **VNS** - Variable Neighborhood Search
```
Problem → Termination → Selection → LocalSearch →
          ↑              ↓           ↓
          └─ Acceptance ← ChangeNeighborhood
```
- Cambia tamaño de vecindad según éxito

#### **Tabu Search**
```
Problem → Termination → Selection → LocalSearch →
          ↑              ↓           ↓
          └─ Acceptance ← Storage (tabu list)
```
- Memoriza soluciones visitadas
- Evita revisitar recientes

#### **Simulated Annealing**
```
Problem → Termination → SingleSolution → LocalSearch →
          ↑              ↓                  ↓
          └─ TemperatureAcceptance ← ReduceTemperature
```
- Acepta peores soluciones con prob. = exp(-Δ/T)
- Enfría temperatura gradualmente

#### **Evolutionary Algorithm**
```
Problem → Termination → PopulationGeneration →
          ↑              ↓         └→ Selection
          └─ Acceptance ← Storage   ├→ Crossover
                                     ├→ Mutation
                                     └→ Selection
```
- Mantiene población
- Selecciona padres
- Cruza y muta
- Itera

---

## ❓ Troubleshooting

### El backend no responde ("Cannot connect")

**Síntomas:** UI cargado pero al presionar "Run Flow" falla

**Soluciones:**
1. ¿El servidor Express está corriendo?
   ```bash
   npm run serve
   # Debe ver: "Server listening on port 5180"
   ```

2. ¿El binario Rust fue compilado?
   ```bash
   cd prodef-runtime-rust
   cargo build --release
   # Verifica: target/release/prodef-runtime-rust (o .exe en Windows)
   ```

3. ¿El puerto está disponible?
   ```bash
   # Windows
   netstat -ano | findstr 5180
   
   # Linux/Mac
   lsof -i :5180
   ```
   Si hay proceso conflictivo, matarlo o cambiar puerto en `server.cjs`

### Grafo válido pero "No packet emitted" error

**Síntomas:** Canvas tiene nodos pero ejecución no avanza

**Causas:**
- No hay nodo marcado con `start: true`
- Nodo start no tiene arista saliente (nó desconectado)
- Final node no está marcado con `end: true`

**Solución:**
- Click en nodo (ej: SingleSolution)
- En FlowInspectorPanel, marque "Start"
- Click en nodo final (ej: Storage)
- Marque "End"

### Solución "no result" / undefined

**Síntomas:** Nodos ejecutan pero no hay solución visible

**Causas:**
- Problema JSON inválido o mismatched variable names
- Generador no produjo solución (infeasible)
- Storage no está conectado

**Solución:**
1. Click nodo Problem → Verifica JSON es válido
2. Click nodo Generation → Mira trace por error Rust
3. Conecta Storage al flujo

### Loop infinito / "MAX_PACKETS exceeded"

**Síntomas:** UI congela, muestra error de máximo packets

**Causas:**
- Termination node tiene `maxIterations: null` o `Infinity`
- Condition `shouldStop` nunca se activa
- Algo genera packets eternamente

**Solución:**
1. Click nodo Termination
2. Establece `maxIterations` a valor finito (ej: 100)
3. Verifica que `shouldStop` se activa (mirar trace)

---

## 🎓 Referencias Internas

- [Flow Runtime Engine README](./src/flow/README.md) - Detalles internos del motor packet
- [Backend Rust](../prodef-runtime-rust/) - Semántica algoritmos
- [Examples JSON](../examples/) - Problemas de prueba

---

## 📝 Notas Técnicas

### Performance

- **Max iterations:** 10 por desarrollo, 1000 en producción (ajustar `MAX_PACKETS_PER_RUN`)
- **Tamaño población:** Recomendado 50-200 para algoritmos genéticos
- **HTTP overhead:** Cada nodo que llama Rust genera ~10-50ms de latencia

### Escalabilidad

- UI maneja ~1000 nodos sin lag perceptible en canvas
- Más de 10k packets → necesita optimización (probablemente loop infinito)
- Ejecutar en servidor remoto: cambiar `VITE_PRODEF_API_BASE`

### Extensibilidad

- Agregar nuevo NodeKind es straightforward (5 pasos)
- Crear nuevo Component ejecutador sigue patrón JoinRuntimeComponent
- Templates pueden ser guardados/cargados desde JSON

---

## 📄 Licencia

Parte del proyecto **FlowSolve**.

