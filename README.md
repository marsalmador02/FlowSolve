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
| `catalog` | Retorna catálogo de componentes ejecutables |

## Licencia y estado

En desarrollo activo. Código educativo/experimental.