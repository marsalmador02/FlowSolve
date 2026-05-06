# Templates: algoritmos prearmados

Esta carpeta define plantillas de grafo listas para usar.

## Responsabilidad

- Construir `nodes + edges` iniciales por algoritmo.
- Fijar orden de ejecucion y parametros por defecto.

## Archivo clave

- `flowTemplates.ts`: builders de GRASP, ILS, VNS, Tabu, etc.

## Supuestos

- Cada plantilla asume contratos de nodos compatibles con el runtime actual.
- Los defaults son operativos, pero se espera ajuste por parte del usuario.
