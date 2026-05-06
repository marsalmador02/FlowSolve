# Executor: orquestacion por paquetes

Esta carpeta contiene el flujo de ejecucion principal.

## Responsabilidad

- Ejecutar el grafo con cola FIFO.
- Resolver routing saliente por aristas.
- Sincronizar joins por `nodeId + idIteration + fromId`.
- Aplicar reglas de corte por modo (`full` o `iteration`).

## Archivo clave

- `packetExecutor.ts`: valida, encola, despacha componentes, acumula trazas y cierra ejecucion.

## Efectos laterales esperados

- Actualizacion de `node.data`.
- Escritura en traza por nodo y traza global.
- Actualizacion del resultado final mostrado en UI.
