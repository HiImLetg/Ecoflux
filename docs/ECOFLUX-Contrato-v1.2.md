# ECOFLUX · Contrato de datos v1.2 (propuesta)

**Estado:** borrador de integración para revisar con electrónica. No representa una conexión instalada ni habilita control físico. La maqueta existente conserva el mando analógico y la plataforma trabaja en modo demostración.

## Alcance de esta versión

- Medición de temperatura y humedad interior y exterior.
- Nivel continuo y boyas de seguridad para cada depósito: cisterna y tanque elevado.
- Corriente agrupada para bombas, ventiladores, batería y panel fotovoltaico. Se conserva corriente individual por bomba para detectar funcionamiento en seco.
- Estado del controlador MPPT y lectura del interruptor físico de batería.
- Umbral térmico propuesto por plataforma, separado de la telemetría y confirmado por el dispositivo.
- Se retira la electroválvula del contrato y del modelo de interfaz. La ruta hidráulica final (bomba de llenado, depósito elevado y bomba de circulación) debe validarse con el equipo.

## Telemetría propuesta

Publicación sugerida: `ecoflux/v1/devices/{unit_id}/telemetry`, QoS 1, JSON UTF-8. `ts` usa ISO 8601 UTC. Los campos ausentes o inválidos se envían como `null`, nunca como cero inventado. `simulation` y `simulated` son metadatos opcionales que solo añade la demo, no mediciones del hardware.

```json
{
  "schema_version": "1.2",
  "unit_id": "maqueta01",
  "ts": "2026-11-13T15:30:00Z",
  "uptime_s": 420,
  "environment": {
    "temp_int_c": 29.4,
    "hum_int_pct": 66.0,
    "temp_ext_c": 32.1,
    "hum_ext_pct": 54.0
  },
  "tanks": {
    "cisterna": { "level_pct": 72.0, "distance_cm": 18.4, "float_low": false, "float_high": false, "valid": true },
    "elevado": { "level_pct": 81.0, "distance_cm": 12.2, "float_low": false, "float_high": false, "valid": true }
  },
  "groups": {
    "pumps": { "current_a": 0.31, "power_w": 3.72, "pumps": { "fill": 0.00, "circulate": 0.31 } },
    "fans": { "current_a": 0.37, "power_w": 4.44 },
    "battery": { "voltage_v": 12.5, "current_a": -0.12, "power_w": -1.50, "switch_on": true },
    "pv": { "voltage_v": 13.2, "current_a": 6.4, "power_w": 84.5 }
  },
  "mppt": { "status": "charging", "indicator": "green", "controller_present": true },
  "control": {
    "mode": "auto",
    "temperature_target_c": 30.0,
    "target_source": "device",
    "target_applied": true,
    "comparator_on": false
  },
  "loads": {
    "pump_fill": { "on": false, "current_a": 0.00 },
    "pump_circulate": { "on": true, "current_a": 0.31 },
    "fans": { "on": true, "current_a": 0.37 }
  },
  "health": { "connected": true, "rssi_dbm": -54, "sensor_lost": false, "cycling_count_10m": 1, "fw_version": "0.1.0" }
}
```

### Convenciones

- Temperatura en °C, humedad y nivel en %, distancia en cm, voltaje en V, corriente en A y potencia en W.
- `tanks.*.distance_cm` es distancia medida desde el sensor al agua; el firmware convierte esa distancia a porcentaje usando la geometría calibrada del tanque. `valid` indica que la lectura pudo validarse.
- Las boyas son entradas binarias de seguridad independientes del cálculo ultrasónico: `float_low` y `float_high`. Una boya activa puede invalidar o limitar una acción aunque el ultrasónico indique otra cosa.
- Corriente de batería positiva significa descarga hacia las cargas; negativa significa carga. Confirmar polaridad y convención con el circuito de medición.
- `groups.pumps.pumps` permite revisar cada bomba. Para detección de bomba seca, usar además medición individual; una única medición agregada no identifica cuál bomba consume corriente anómala.
- `mppt.status` es una lectura informativa. Valores sugeridos: `charging`, `idle`, `fault`, `unknown`; `indicator` sugerido: `green`, `yellow`, `red`, `off`, `unknown`. Deben mapearse a las señales reales del controlador seleccionado.
- La plataforma diferencia `health.connected` de estado operativo: si deja de recibir telemetría, debe mostrar dato desactualizado y no inferir que el equipo está apagado.

## Propuesta para el umbral remoto

La plataforma no escribe telemetría. Cuando exista una integración autorizada, publica una solicitud sin retención (`retain=false`) en `ecoflux/v1/devices/{unit_id}/config/request`:

```json
{
  "schema_version": "1.2",
  "request_id": "uuid",
  "issued_at": "2026-11-13T15:31:00Z",
  "requested_by": "user-id",
  "settings": { "temperature_target_c": 30.0 }
}
```

El dispositivo responde en `ecoflux/v1/devices/{unit_id}/config/ack` con `request_id`, `accepted`, `applied`, `effective_target_c`, `reason` y `ts`. La interfaz solo muestra “Aplicado” tras ACK con `applied: true`; sin respuesta muestra “Pendiente” y conserva el último valor confirmado. Rechazar valores fuera del rango validado por electrónica. El rango 20–40 °C usado por la demo no es una especificación del hardware.

### Seguridad y operación que debe validar electrónica

1. El control local debe seguir funcionando sin Wi‑Fi, broker, navegador o servidor.
2. La pérdida de alimentación o señal de ESP32 debe llevar a un estado físico seguro definido por el equipo. El potenciómetro/respaldo analógico solo puede considerarse fallback cuando se haya comprobado el diseño y la prioridad de mando.
3. No se deben conectar dos salidas que intenten gobernar la referencia del LM358 sin una etapa de arbitraje y límites eléctricos. Confirmar si el microcontrolador elegido ofrece DAC utilizable; si se requiere uno externo, documentarlo.
4. La pantalla nunca ordena apagar o arrancar cargas en esta versión. El umbral de la UI es simulado y la interfaz muestra claramente su estado.
5. El interruptor de batería es físico. La app solo lee su posición. Procedimiento de conexión/desconexión de batería y panel debe seguir la hoja del MPPT seleccionado.
6. Ante bomba seca, la protección primaria es local: flotador/medición y lógica de firmware/electrónica. Una alerta en nube no puede ser la única protección.

## Notas para revisión del equipo

- Confirmar cantidad, modelo y geometría de los tanques; orientación y calibración del sensor de distancia; zona ciega y distancia mínima del sensor escogido.
- Confirmar tipo de boya, lógica eléctrica (normalmente abierta/cerrada) y comportamiento ante cable roto.
- Confirmar cargas reales, corrientes nominales/pico, tensión de bus y dónde se coloca cada sensor INA219. INA219 es una opción de diseño, no una selección eléctrica aprobada.
- Acordar sentido de corriente, precisión, frecuencia de muestreo, timeout de telemetría y estrategia de reconexión MQTT.
- Identificar el MPPT real y cómo se leen sus LED/estados. No inferir estado de carga solo por el voltaje de batería.
- Confirmar el circuito hidráulico sin electroválvula antes de cerrar el firmware.
- Definir cómo arbitrar entre mando del potenciómetro y umbral digital; probar falla de ESP32 y recuperación antes de conectar cargas.

## Migración desde v1.1

- Retirados `loads.valve`, `valve` y cualquier estado de electroválvula.
- Sustituye `tank_low_pct`/`tank_high_pct` planos por `tanks.cisterna`/`tanks.elevado`.
- Añade `environment.temp_ext_c`, `environment.hum_ext_pct`, grupos de corriente, `mppt`, `control` y `health`.
- Los escenarios del simulador viven dentro de `simulation`; no forman parte de la telemetría real. El cliente debe interpretar el contrato con las rutas anidadas de esta versión.
