# Orquestación packet-based de flujos

Capa interna que orquesta la ejecución de grafo de nodos de forma correcta, delegando semántica de optimización al motor Rust vía HTTP.

## Propósito

1. **Modelar algoritmos** como grafos orientados: nodos = componentes, aristas = flujo de datos
2. **Validar grafo** antes de ejecución
3. **Ejecutar nodos** en orden 
4. **Enrutar datos** entre nodos vía packets
5. **Gestionar estado** de ejecución (cola, iteración, joins)

## Arquitectura de capas

```
┌─────────────────────────────────────────┐
│ src/App.tsx (UI principal)              │
│ - Gestión de canvas (React Flow)        │
│ - Estado global de flujo                │
└──────────────┬──────────────────────────┘
               │ Delega ejecución a:
┌──────────────▼──────────────────────────┐
│ flow/runtime/executor/packetExecutor.ts │
│ - Valida grafo                          │
│ - Encola packets iniciales              │
│ - Ejecuta componentes en orden          │
│ - Procesa resultados y enruta outgoing  │
└──────────────┬──────────────────────────┘
               │ Invoca mediante:
┌──────────────▼──────────────────────────┐
│ flow/runtime/components/registry.ts     │
│ - Mapea NodeKind → RuntimeComponent     │
│ - Providers específicos por tipo        │
└──────────────┬──────────────────────────┘
               │ Cada Node ejecuta:
┌──────────────▼──────────────────────────┐
│ flow/runtime/components/nodes/*.ts      │
│ - Operaciones específicas por NodeKind  │
│ - Delegación al runtime Rust vía API    │
└─────────────────────────────────────────┘
```

## Estructura de carpetas

```
ui/src/flow/
├── algorithms/
│   ├── algorithmBuilder.ts          # Builders de templates predefinidos
│   │                                # GRASP, ILS, VNS, Genetic, etc.
│
├── runtime/
│   ├── engine/
│   │   ├── packet.ts                # Estructura Packet, Context, Result
│   │   ├── graphValidation.ts       # Validación DAG, ciclos, aridad
│   │   └── index.ts                 # Export públicas
│   │
│   ├── executor/
│   │   ├── packetExecutor.ts        # ⭐ Lógica de ejecución principal
│   │   │                            # - Queue processing
│   │   │                            # - Node dispatch
│   │   │                            # - Packet routing
│   │   └── index.ts
│   │
│   ├── components/
│   │   ├── base.ts                  # Clase base RuntimeComponent
│   │   │                            # Interfaz común execute()
│   │   ├── registry.ts              # ⭐ Factory: NodeKind
│   │   ├── index.ts
│   │   │
│   │   └── nodes/
│   │       ├── solverNodeComponent.ts    # Solver (delegación a Rust)
│   │       ├── joinNodeComponent.ts      # Join (sincronización)
│   │       ├── routerNodeComponent.ts    # Router (bifurcación)
│   │       ├── delayNodeComponent.ts     # Delay
│   │       ├── outputNodeComponent.ts    # Output (acumula resultados)
│   │       ├── sequenceNodeComponent.ts  # Sequence (bifurcación ordenada)
│   │       ├── startNodeComponent.ts     # Start (nodo inicial)
│   │       ├── decisionNodeComponent.ts  # Decision (condicional)
│   │       └── index.ts
│   │
│   └── index.ts
│
└── README.md                        # Este archivo
```