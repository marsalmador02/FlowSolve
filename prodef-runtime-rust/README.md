# prodef-runtime-rust

Motor Rust que ejecuta la semántica de optimización de FlowSolve.
Este crate recibe una definición de problema y un modo de ejecución en JSON,
valida y normaliza el problema, ejecuta el operador correspondiente y devuelve
una respuesta JSON lista para consumir desde la UI.

## Qué hace

1. Lee un archivo JSON con `ExecutionRequest`.
2. Convierte `problem` en un `RuntimeProblem` ejecutable.
3. Despacha `execution.mode` al handler adecuado.
4. Ejecuta generación, selección, cruce, mutación, búsqueda local o aceptación.
5. Serializa el resultado como `ExecutionResponse`.

## Resumen de arquitectura

```
CLI / server bridge
  ↓
api::run
  ↓
domain::RuntimeProblem
  ↓
modes::dispatch
  ↓
operators / search / evaluation
  ↓
ExecutionResponse
```

El binario se usa desde la UI a través de `server.cjs`, pero también puede
ejecutarse de forma directa desde CLI con un request JSON guardado en disco.

## Estructura del crate

```
prodef-runtime-rust/
├── Cargo.toml
├── README.md
├── src/
│   ├── main.rs
│   ├── lib.rs
│   ├── api/
│   │   ├── mod.rs
│   │   ├── parse.rs
│   │   ├── response.rs
│   │   └── validation.rs
│   ├── domain/
│   │   ├── feasible.rs
│   │   ├── model.rs
│   │   ├── result.rs
│   │   ├── runtime.rs
│   ├── evaluation/
│   │   ├── expr.rs
│   │   └── mod.rs
│   ├── modes/
│   │   ├── common.rs
│   │   ├── context.rs
│   │   ├── crossover.rs
 en los demás modos, construye el runtime y delega en `modes::dispatch`.
│   │   ├── mutation.rs
│   │   ├── neighborhood.rs
│   │   ├── perturbation.rs
│   │   ├── selection.rs
## Punto de entrada

### `src/main.rs`

El binario hace exactamente esto:

1. Parsear `--exec-request <path>`.
2. Leer el archivo JSON.
3. Deserializarlo como `api::ExecutionRequest`.
4. Llamar a `api::run(request)`.
5. Imprimir la respuesta en JSON pretty por `stdout`.

No mantiene servidor HTTP propio: esa capa vive en `ui/server.cjs`.

## Contrato de entrada

### `ExecutionRequest`

```json
{
  "problem": {
    "name": "knapsack",
    "variables": [
      {
        "symbol": "x",
        "within": "binary",
        "shape": {
          "type": "vector",
          "isPermutation": false,
          "size": { "fixed": false, "value": "N" }
        }
      }
    ],
    "goals": [
      {
        "sense": "maximize",
        "expression": "sum x[i]*item[i].value over i=(1:N)"
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

### Estructura real

- `problem` es opcional en el tipo, pero obligatorio para todos los modos que resuelven el problema.
- `execution.mode` es un `String` libre que luego se valida en el dispatcher.
- `execution.payload` es un `serde_json::Value` y cambia por modo.

## Contrato de salida

### `ExecutionResponse`

El motor devuelve uno o varios de estos campos:

- `result`: una solución única evaluada como `SolverResult`.
- `population`: lista de `SolverResult`.
- `payload`: JSON libre con metadatos del modo.

### `SolverResult`

```json
{
  "problemName": "knapsack",
  "isFeasible": true,
  "goalValues": [130],
  "variableValue": [1, 0, 1, 1, 0]
}
```

Notas importantes:

- En permutaciones, `variableValue` se serializa en formato 1-based para legibilidad.
- El score no se calcula como un campo separado; la UI puede derivarlo a partir de `goalValues`.

## Flujo interno

```
1. main.rs
   └─ lee el request JSON desde disco

2. api::run(req)
  ├─ construye RuntimeProblem
  ├─ crea RNG determinista por ejecución
  └─ llama a modes::dispatch
   │   ├─ construye RuntimeProblem
   │   ├─ crea RNG determinista por ejecución
   │   └─ llama a modes::dispatch

3. modes::dispatch(mode, ctx)
   ├─ normaliza aliases
   ├─ llama al handler concreto
   └─ produce ModeOutcome

4. api::response
   ├─ convierte Solution -> SolverResult
   └─ serializa JSON final

5. stdout
   └─ el bridge de la UI captura el JSON y lo reenvía al frontend
```

## Modelo de dominio

### `domain/model.rs`

Define el esquema del problema.

Soporta:

- `name`
- `parameters`
- `variables`
- `goals`
- `constraints`
- `classes`
- `objects`

### Limitaciones actuales del runtime

Estas restricciones están codificadas en `RuntimeProblem::new`:

- solo se soporta **una variable** por problema;
- solo se soporta `shape.type == "vector"`;
- la variable puede ser de tipo permutación o vector normal;
- los índices de la evaluación son **1-based**;
- para `binary`, el dominio por defecto es `[0, 1]`;
- para variables no binarias, el rango por defecto cae en `[0, 10]` si no se define explícitamente.

## `RuntimeProblem`

### `domain/runtime.rs`

Este tipo adapta el problema JSON a una versión lista para ejecutar.

Responsabilidades:

- construir el mapa de parámetros;
- cargar datos de clases e instancias;
- validar tamaño y forma de la solución;
- generar soluciones aleatorias factibles;
- evaluar objetivos;
- verificar restricciones;
- comparar scores según `maximize` o `minimize`.

### Funciones clave

- `generate_random_solution`
- `evaluate_goals`
- `is_feasible`
- `objective_score`
- `is_better_score`
- `solution_size`
- `solution_is_permutation`

## Tipos de solución

### `domain/solution.rs`

```rust
pub enum Solution {
    Vector(Vec<f64>),
    Permutation(Vec<usize>),
}
```

El motor trabaja con dos representaciones:

- `Vector` para problemas binarios, enteros o continuos.
- `Permutation` para TSP, assignment y otros problemas de orden.

## Evaluación de expresiones

### `evaluation/expr.rs`

Este parser es el corazón semántico del runtime.

Soporta:

- literales numéricos;
- parámetros del problema;
- acceso a variables `x[i]`;
- acceso a atributos de clase `item[i].weight`;
- acceso a matrices `d[i,j]`;
- sumatorias estilo `sum ... over i=(1:N)`;
- comparaciones `<=`, `>=` y `=`;
- continuidad de expresión en sumas, por ejemplo `sum ... over ... + rest`.

### Restricciones

- El lenguaje es deliberadamente pequeño y orientado a problemas de optimización.
- La indexación siempre es 1-based dentro de las expresiones.
- Si una expresión no entra en los patrones soportados, el evaluador falla con un error explícito.

## API y contrato JSON

### `api/mod.rs`

Punto de orquestación del crate.

Cuando recibe una request:

- si `mode == "catalog"`, devuelve el catálogo estático de componentes;
- en los demás modos, construye el runtime y delega en `modes::dispatch`.

### `api/catalog.rs`

Publica el catálogo nativo para la UI.

Componentes expuestos actualmente:

- `problem`
- `singleSolution`
- `populationGeneration`
- `selection`
- `crossover`
- `mutation`
- `localSearch`
- `perturbation`
- `neighborhood`
- `substraction`
- `selectionBest`
- `acceptance`
- `temperatureAcceptance`
- `reduceTemperature`
- `changeNeighborhood`
- `storage`
- `termination`

### `api/parse.rs`

Convierte `variableValue` a `Solution` y viceversa.

Puntos relevantes:

- detecta si la solución es permutación o vector;
- acepta permutaciones en formato 0-based o 1-based al leer;
- rechaza permutaciones con duplicados o longitudes incorrectas;
- convierte soluciones a vectores `f64` para operadores genéricos.

### `api/response.rs`

Convierte `Solution` en `SolverResult` evaluando:

- factibilidad,
- `goalValues`,
- `variableValue` serializado.

### `api/validation.rs`

Centraliza errores de payload para que los modos respondan con mensajes homogéneos.

## Modos soportados

Los modos disponibles se despachan desde `modes::dispatch`.

| Modo | Handler | Descripción | Payload principal |
|------|---------|-------------|-------------------|
| `generate` | `generate::execute_single` | Genera una solución factible | ninguno o vacío |
| `generate-population` | `generate::execute_population` | Genera una población factible | `count` |
| `selection` | `selection::execute` | Selección elitista + torneo | `candidates`, `targetSize`, `tournamentSize`, `eliteSize` |
| `crossover` | `crossover::execute` | Cruce entre padres | `parents`, `targetSize`, `crossoverOperator` |
| `mutation` | `mutation::execute` | Mutación sobre un conjunto de entrada | `incomingSet`, `mutationRate` |
| `perturbation` | `perturbation::execute` | Perturbación secuencial | `base`, `k`, `maxAttempts` |
| `neighborhood` | `neighborhood::execute` | Genera vecindad de una solución base | `base` |
| `local-search` | `local_search::execute` | Ejecuta búsqueda local hill-climbing | `solution` |
| `select-best` | `select_best::execute` | Elige el mejor candidato factible | `candidates` |
| `temperature-acceptance` | `temperature_acceptance::execute` | Regla de aceptación tipo SA | `candidate`, `stored`, `temperatureCurrent` |
 

### Alias aceptados

El dispatcher acepta algunos nombres alternativos:

- `local_search` como alias de `local-search`
- `selection-best` como alias de `select-best`
- `temperature_acceptance` como alias de `temperature-acceptance`

## Payloads por modo

### `generate`

```json
{
  "execution": {
    "mode": "generate",
    "payload": null
  }
}
```

Devuelve `result` con una solución factible.

### `generate-population`

```json
{
  "execution": {
    "mode": "generate-population",
    "payload": {
      "count": 20
    }
  }
}
```

Si `count` falta, usa `10`.

### `selection`

```json
{
  "execution": {
    "mode": "selection",
    "payload": {
      "candidates": [
        { "variableValue": [1, 0, 1, 0, 1] },
        { "variableValue": [0, 0, 0, 0, 0] }
      ],
      "targetSize": 2,
      "tournamentSize": 3,
      "eliteSize": 1
    }
  }
}
```

Retorna `payload.selected`.

### `crossover`

```json
{
  "execution": {
    "mode": "crossover",
    "payload": {
      "parents": [
        { "variableValue": [1, 2, 3, 4] },
        { "variableValue": [4, 3, 2, 1] }
      ],
      "targetSize": 2,
      "crossoverOperator": "pmx"
    }
  }
}
```

Para permutaciones, selecciona `pmx` u `order` según el operador solicitado. Para vectores binarios/continuos, usa `one-point` o `uniform`.

### `mutation`

```json
{
  "execution": {
    "mode": "mutation",
    "payload": {
      "incomingSet": [
        { "variableValue": [1, 1, 0, 1, 0] }
      ],
      "mutationRate": 0.25
    }
  }
}
```

Retorna `payload.mutated`.

### `perturbation`

```json
{
  "execution": {
    "mode": "perturbation",
    "payload": {
      "base": { "variableValue": [1, 1, 0, 1, 0] },
      "k": 3,
      "maxAttempts": 100
    }
  }
}
```

Retorna `payload.winner`, `payload.attempts`, `payload.k` y `payload.maxAttempts`.

### `neighborhood`

```json
{
  "execution": {
    "mode": "neighborhood",
    "payload": {
      "base": { "variableValue": [1, 0, 1, 0, 1] }
    }
  }
}
```

Retorna `payload.generated` y `payload.feasible`.

### `local-search`

```json
{
  "execution": {
    "mode": "local-search",
    "payload": {
      "solution": [1, 1, 0, 1, 0]
    }
  }
}
```

Requiere una solución inicial factible.

### `select-best`

```json
{
  "execution": {
    "mode": "select-best",
    "payload": {
      "candidates": [
        { "variableValue": [1, 0, 0, 0, 0] },
        { "variableValue": [1, 1, 1, 1, 0] }
      ]
    }
  }
}
```

Retorna `payload.winner`, `payload.selectedIndex` y `payload.score`.

### `temperature-acceptance`

```json
{
  "execution": {
    "mode": "temperature-acceptance",
    "payload": {
      "candidate": [1, 1, 0, 1, 0],
      "stored": [1, 0, 0, 1, 0],
      "temperatureCurrent": 0.75
    }
  }
}
```

Retorna `payload.accepted` y `payload.winner`.

## Generación de soluciones factibles

### `domain/feasible.rs`

La generación inicial intenta producir soluciones que ya respeten las restricciones.

Esto es importante porque varios modos asumen entrada factible:

- `local-search`
- `selection`
- `select-best`
- `temperature-acceptance`

Si el problema o los candidatos son inválidos, el modo falla con un error claro.

## Búsqueda local

### `search/local_search.rs`

El motor actual implementa una búsqueda local de un paso con trazas detalladas.

Comportamiento:

- exige una solución inicial factible;
- explora vecinos por tipo de solución;
- prueba swaps para permutaciones;
- prueba flips para binarios;
- prueba movimientos +/- 1 para vectores enteros o continuos;
- conserva la mejor mejora encontrada;
- devuelve trazas legibles para depuración.

## Operadores reutilizables

### `operators/mod.rs`

El módulo centraliza operadores de bajo nivel.

Componentes principales:

- `detect_problem_family`
- `variable_flags`
- `one_point_crossover`
- `uniform_crossover_f64`
- `order_crossover_f64`
- `pmx_crossover_f64`
- `mutate_permutation_swap_f64`
- `mutate_permutation_inversion_f64`
- `apply_random_bitflip`
- `apply_random_swap`
- `generate_neighbor_vectors`

También expone utilidades para decidir el operador por defecto según el problema:

- Assignment -> operadores de intercambio.
- TSP -> operadores de permutación.
- Otros -> operadores genéricos.

## Catálogo para la UI

### `api/catalog.rs`

La UI usa el modo `catalog` para poblar la barra lateral.

Cada descriptor incluye:

- `kind`
- `label`
- `category`
- `stateful`

El catálogo actual ya coincide con los nodos visibles en la UI de FlowSolve.

## Ejecución desde CLI

### Compilar

```bash
cargo build --release
```

### Ejecutar un request

```bash
target/release/prodef-runtime-rust --exec-request path/to/request.json
```

En Windows el binario final será `target\\release\\prodef-runtime-rust.exe`.

## Desarrollo

### Formatear

```bash
cargo fmt
```

### Chequear compilación

```bash
cargo check
```

### Ejecutar tests

```bash
cargo test
```

### Generar documentación

```bash
cargo doc --no-deps --open
```

## Qué valida este crate

- forma del `Problem`;
- tamaño de la solución;
- consistencia de permutaciones;
- factibilidad contra restricciones;
- score de objetivos;
- compatibilidad de payloads por modo.

## Casos de uso típicos

### Generar una solución inicial para Knapsack

```json
{
  "problem": {
    "name": "knapsack",
    "variables": [
      {
        "symbol": "x",
        "within": "binary",
        "shape": {
          "type": "vector",
          "isPermutation": false,
          "size": { "fixed": true, "value": 5 }
        }
      }
    ],
    "goals": [
      { "sense": "maximize", "expression": "sum x[i]*item[i].value over i=(1:5)" }
    ]
  },
  "execution": {
    "mode": "generate"
  }
}
```

### Mejorar una solución con búsqueda local

```json
{
  "problem": {
    "name": "tsp",
    "variables": [
      {
        "symbol": "route",
        "within": "integers",
        "shape": {
          "type": "vector",
          "isPermutation": true,
          "size": { "fixed": true, "value": 4 }
        }
      }
    ],
    "goals": [
      { "sense": "minimize", "expression": "sum distance[route[i],route[i+1]] over i=(1:3)" }
    ]
  },
  "execution": {
    "mode": "local-search",
    "payload": {
      "solution": [1, 2, 3, 4]
    }
  }
}
```

## Notas de implementación

- El runtime es pequeño a propósito: la lógica compleja vive en `modes`, `operators` y `search`.
- La serialización de soluciones está normalizada para que la UI no tenga que reconstruir resultados.
- El catálogo está codificado en Rust para que la UI y el backend compartan una fuente de verdad.

## Limitaciones conocidas

- Un solo vector de decisión por problema.
- Sin soporte general para múltiples variables simultáneas.
- La gramática de expresiones es intencionalmente acotada.
- El motor está orientado a problemas como Knapsack, TSP, Assignment y variantes cercanas.

## Relación con la UI

La UI de FlowSolve llama a este motor para:

- obtener el catálogo de componentes;
- generar soluciones;
- evaluar mutación, cruce y selección;
- ejecutar búsquedas locales y reglas de aceptación.

El contrato entre ambos lados está pensado para ser estable y pequeño:

- request simple,
- response simple,
- trazas y validación internas en Rust.

## Archivos de ejemplo

La carpeta `examples/` contiene problemas listos para probar:

- `knapsack.json`
- `knapsack_complex.json`
- `tsp.json`
- `tsp_complex.json`
- `assignment.json`
- `assignment_complex.json`
- `diet.json`

Estos archivos son útiles para validar:

- generación factible,
- evaluación de expresiones,
- búsqueda local,
- operadores sobre permutaciones.
```