# Motor de ejecución de optimización

`prodef-runtime-rust` es el motor de ejecución de bajo nivel que implementa operadores metaheurísticos (generación, mutación, cruce, perturbación, búsqueda local, etc.) y se comunica con la UI mediante contrato JSON request/response.

## ¿Qué hace?

1. **Deserializa `ExecutionRequest`** desde JSON (problem definition + execution mode)
2. **Construye `RuntimeProblem`** (modelo dominio: variables, restricciones, objetivos)
3. **Redirige modo solicitado** (`generate`, `mutation`, `crossover`, etc.)
4. **Ejecuta operador/búsqueda** con validación
5. **Serializa `ExecutionResponse`** (resultados, población, metadata) a JSON

## Uso

El archivo JSON contiene problem definition + execution payload. Ver `examples/` para casos de ejemplo.

### 1. Formato del request JSON

```json
{
  "problem": {
    "name": "assignment",
    "variables": [
      {
        "name": "x",
        "shape": {"vector": [3, 3]},
        "within": "binary"
      }
    ],
    "goals": [
      {
        "direction": "maximize",
        "expression": "sum_all"
      }
    ]
  },
  "execution": {
    "mode": "generate",
    "payload": {
      "count": 10
    }
  }
}
```

### 2. Response JSON

El motor retorna:

```json
{
  "result": {
    "objective": 42.5,
    "feasible": true
  },
  "population": [
    {"candidate": [0, 1, 1], "objective": 42.0},
    {"candidate": [1, 0, 1], "objective": 41.5}
  ],
  "payload": {
    "metadata": "...",
    "info": "..."
  }
}
```

## Estructura Principal

```
prodef-runtime-rust/
├── Cargo.toml                    # Manifest: dependencias, metadatos
├── README.md                     # Este archivo
│
├── src/
│   ├── main.rs                   # Punto de entrada del binario
│   ├── lib.rs                    # Fachada de librería (para doctests)
│   │
│   ├── api/                      # Frontera JSON (entrada/salida)
│   │   ├── mod.rs                # Entry point, run logic
│   │   ├── parse.rs              # Deserialización JSON → tipos internos
│   │   ├── response.rs           # Serialización tipos → JSON
│   │   ├── validation.rs         # Validación de payloads
│   │   └── catalog.rs            # Catálogo de componentes ejecutables
│   │
│   ├── domain/                   # Modelos de dominio
│   │   ├── mod.rs
│   │   ├── model.rs              # Definición de Problem
│   │   ├── runtime.rs            # RuntimeProblem (versión ejecutable)
│   │   ├── solution.rs           # Definición de solución
│   │   ├── result.rs             # Resultado SolverResult
│   │   └── feasible.rs           # Generación de soluciones factibles
│   │
│   ├── operators/                # Operadores metaheurísticos
│   │   └── mod.rs                # Crossover, mutation, perturbation, neighborhood
│   │                             
│   │
│   ├── modes/                    # Handlers de ejecución (uno por modo)
│   │   ├── mod.rs                # dispatcher principal
│   │   ├── generate.rs           # Generar solución/población
│   │   ├── mutation.rs           # Aplicar mutación
│   │   ├── crossover.rs          # Cruce genético
│   │   ├── perturbation.rs       # Perturbación
│   │   ├── neighborhood.rs       # Generar vecindad
│   │   ├── selection.rs          # Seleccionar mejores
│   │   ├── select_best.rs        # Elegir el mejor
│   │   ├── local_search.rs       # Búsqueda local (hill climbing)
│   │   ├── temperature_acceptance.rs # Simulated Annealing
│   │   ├── context.rs            # Contexto de ejecución (payload, runtime, etc.)
│   │   └── common.rs             # Utilidades compartidas
│   │
│   ├── evaluation/               # Evaluador de expresiones
│   │   ├── mod.rs
│   │   └── expr.rs               # Parser/evaluador de restrict. y objetivos
│   │
│   ├── search/                   # Algoritmos de búsqueda
│   │   ├── mod.rs
│   │   └── local_search.rs       # Hill climbing y variantes
│   │
│   └── bin/                      # (Vacío, podría haber binarios extra)
│
├── examples/                      # Archivos JSON de ejemplo
│   ├── assignment.json
│   ├── diet.json
│   ├── knapsack.json
│   ├── tsp.json
│   └── ...
│
└── target/                        # Compilados (auto-generados)
    ├── debug/
    └── release/
        └── prodef-runtime-rust   #  Binario ejecutable final
```

## Modos de ejecución soportados

Cada modo realiza una operación específica en el contexto de un problema de optimización:

| Modo | Descripción | Entrada | Salida |
|------|------------|---------|--------|
| `generate` | Genera 1 solución aleatoria | problem | single result |
| `generate-population` | Genera N soluciones aleatorias | problem + count | population |
| `mutation` | Aplica mutación a solución | candidate, operation | mutated candidate |
| `crossover` | Cruce entre 2 soluciones | parent1, parent2, op | child candidate |
| `perturbation` | Perturbación controlada | candidate | perturbed candidate |
| `neighborhood` | Genera todos los vecinos | candidate | neighbors (list) |
| `selection` | Selecciona top-K | population, k | selected (list) |
| `select-best` | Elige mejor solución | population | best result |
| `local-search` | Hill climbing | candidate, max_iter | best_result, trace |
| `temperature-acceptance` | Simulated Annealing | candidate, temp, criteria | accepted/rejected |
| `catalog` | Lista componentes | - | components list |

## Flujo interno de ejecución

```
1. main.rs
   └─ Lee archivo JSON: --exec-request <file>
      └─ Deserializa ExecutionRequest

2. api::run(request)
   ├─ Si mode == "catalog": retorna ComponentDescriptor list
   └─ Si no:
      ├─ parse::payload_object → extrae payload
      ├─ parse::parse_problem → construye Problem
      ├─ domain::RuntimeProblem::new → valida y prepara runtime
      └─ modes::dispatch(mode, context) → enruta a handler

3. modes/<mode>.rs execute(ctx) → ModeOutcome
   ├─ Accede a runtime (problema)
   ├─ Accede a payload (parámetros)
   ├─ Llama a operators si necesita (crossover, mutation, etc.)
   ├─ Construye resultado
   └─ Retorna ModeOutcome{result, population, payload}

4. response::build_solver_result
   └─ Serializa ModeOutcome → JSON ExecutionResponse

5. JSON se imprime a stdout
   └─ Backend bridge captura y retorna a UI
```

## Operadores clave (src/operators/mod.rs)

El módulo `operators` contiene operadores reutilizables:

- **Crossover:** `one_point_crossover`, `uniform_crossover_f64`, `order_crossover_f64`, `pmx_crossover_f64`
- **Mutation (permutation):** `mutate_permutation_swap_f64`, `mutate_permutation_inversion_f64`
- **Perturbation:** `apply_random_bitflip`, `apply_random_swap`
- **Neighborhood:** `generate_neighbor_vectors`

## Evaluación de restricciones y objetivos

El módulo `evaluation/expr.rs` implementa parser/evaluador de expresiones:

- Soporta operaciones: `sum_all`, `sum_scalar`, `sum_range`, índices 1-based
- Valida restricciones: `x[1] + x[2] <= 10`
- Evalúa objetivos: `maximize sum_all`, `minimize sum_range`
- Manejo de instancias de datos (clases, atributos)

## Testing

### Ejecutar tests unitarios

```bash
# Ejecuta todos los tests unitarios (test modules en src/*)
cargo test --lib
```

## Documentación

### Generar documentación HTML

```bash
cargo doc --no-deps --open
```

Abre `target/doc/prodef_runtime_rust/index.html` con:
- Descripción de cada módulo
- Firmas de funciones públicas
- Ejemplos de uso (desde doc-comments)
- Enlaces de cross-reference

## Ejemplos Prácticos

### Caso 1: Generar población inicial

```json
{
  "problem": {
    "name": "knapsack",
    "variables": [{"name": "x", "shape": {"vector": 5}, "within": "binary"}],
    "goals": [{"direction": "maximize", "expression": "sum_all"}]
  },
  "execution": {
    "mode": "generate-population",
    "payload": {"count": 20}
  }
}
```

### Caso 2: Aplicar cruce

```json
{
  "problem": {...},
  "execution": {
    "mode": "crossover",
    "payload": {
      "parent1": [0, 1, 1, 0, 1],
      "parent2": [1, 0, 0, 1, 0],
      "operation": "uniform"
    }
  }
}
```

### Caso 3: Búsqueda local

```json
{
  "problem": {...},
  "execution": {
    "mode": "local-search",
    "payload": {
      "candidate": [0, 1, 1, 0, 1],
      "max_iterations": 100
    }
  }
}
```