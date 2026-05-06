# Runtime de flujo (packet engine)

Esta carpeta define el contrato interno del motor de ejecucion por paquetes.

## Que resuelve

- Convierte un grafo de nodos en una ejecucion determinista por cola FIFO.
- Separa validacion, orquestacion y logica de componentes.
- Mantiene reglas de iteracion (`idIteration`) para joins y loops.

## Entradas y salidas

- Entrada: grafo UI (`nodes`, `edges`), estado del nodo `problem` y acciones de estado React.
- Salida: actualizaciones de nodos, trazas por nodo, traza global y resultado final.

## Subcarpetas

- `engine/`: tipos base (`Packet`, `ExecuteResult`) y validaciones de grafo.
- `executor/`: bucle principal de ejecucion y enrutamiento.
- `components/`: implementaciones por `NodeKind` y registro de factories.

## Limites

- No ejecuta semantica de optimizacion compleja localmente: delega al backend Rust via componentes runtime.
- Aplica presupuesto maximo de paquetes para evitar loops infinitos.
