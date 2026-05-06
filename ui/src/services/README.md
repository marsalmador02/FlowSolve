# Services: contrato de red

La carpeta `services/` contiene adaptadores HTTP de la UI.

## Responsabilidad

- Enviar requests al backend bridge.
- Normalizar errores HTTP para trazas legibles.
- Tipar request/response con contratos compartidos.

## Archivo clave

- `prodefApi.ts`:
  - Endpoint principal: `POST /execute`.
  - Entrada: `RuntimeExecutionRequest`.
  - Salida: `RuntimeExecutionResponse`.

## Limites

- No contiene logica de negocio de flujo.
- No transforma algoritmos; solo ejecuta el contrato de red.
