# ECOFLUX · Guía de proyecto v1.2

**Fecha:** 13 de noviembre de 2026  
**Estado:** base de plataforma y contrato propuesta para revisión del equipo; la integración con hardware aún no está conectada.

## 1. Propósito

ECOFLUX es una plataforma sencilla para supervisar las condiciones ambientales, el agua y la energía de una vivienda demostrativa con posible extensión al sector agropecuario. El sistema electrónico ya construido es analógico. La plataforma digital se diseña como una capa complementaria de lectura, análisis y acompañamiento; la seguridad y el control local deben permanecer en la electrónica.

La primera base de software puede abrirse en computadora y móvil desde el navegador. Incluye un entorno local para recorrer pantallas sin presentar sus valores como mediciones del equipo. AIRA separa cerebro conversacional y voz: Claude Opus 5.5 es el cerebro configurado por defecto; OpenAI se prepara para transcripción y síntesis de voz. Cada proveedor requiere su clave y acceso API. Sin ellos, la entrada escrita y las respuestas de reglas locales siguen disponibles.

## 2. Enfoque de sostenibilidad

- **ODS 7 como eje:** eficiencia energética, lectura de generación solar y comprensión de consumo.
- **ODS 13 como apoyo:** observar temperatura interior/exterior y aportar información para adaptación al calor.
- **ODS 6 como apoyo:** seguimiento de cisterna y tanque elevado para uso responsable del agua.
- **ODS 12 como apoyo:** promover uso responsable y documentación del desempeño de recursos.

Los ahorros, pronósticos y comparaciones de impacto se presentarán como resultados reales solo después de reunir datos verificados del prototipo.

## 3. Arquitectura de trabajo

1. **Capa analógica existente:** sensor NTC, comparador LM358, etapa MOSFET y actuadores. Continúa operando localmente.
2. **Puente de telemetría ESP32 (por integrar):** lectura de sensores/estado, conexión segura y envío del contrato v1.2. No sustituye las protecciones eléctricas o hidráulicas.
3. **Servicio de datos (por definir):** broker MQTT/API que valida, almacena y distribuye telemetría. Puede ejecutarse localmente o en nube, sujeto a infraestructura disponible.
4. **Plataforma web:** Inicio, Historial, Alertas, Tendencia, AIRA y Diagnóstico; la misma base visual responde a PC y móvil.
5. **AIRA:** interfaz de conversación para explicar datos y guiar al usuario. Su backend puede llamar a Claude u OpenAI; la voz OpenAI se administra como servicio separado. No envía instrucciones a las cargas. Las herramientas de predicción son funciones externas y permanecen en calibración hasta elegir y validar algoritmos con datos reales.

Flujo conceptual: sensores/control local → ESP32 → servicio de datos → interfaz y AIRA. Una configuración de umbral podría viajar de plataforma a ESP32 con solicitud y acuse (ACK), pero solo tras aprobar el esquema de arbitraje y el comportamiento seguro de la referencia LM358.

## 4. Cambios de alcance v1.2

- Añadir temperatura y humedad exterior para compararlas con el ambiente interior.
- Tratar cisterna y tanque elevado como tanques independientes. Cada uno propone sensor de distancia ultrasónico y boyas alta/baja independientes.
- Mostrar ambos depósitos como recipientes verticales con una lámina de agua animada según el porcentaje recibido. Si solo llegan estados de boya, indicar el rango (“mínimo”, “entre boyas” o “máximo”) sin inventar porcentaje.
- Agrupar mediciones de corriente en bombas, ventiladores, batería y panel FV; mantener corriente individual por bomba para detectar anomalías.
- Incorporar lecturas informativas del MPPT y posición de un interruptor físico de batería.
- Mantener el indicador MPPT junto al estado de conexión: verde encendido, gris apagado y gris neutro mientras no haya dato.
- Ofrecer perfiles de vivienda, avícola, porcino y ganadero con una plantilla inicial de sensores y un acento cromático propio; cada perfil conserva ajustes técnicos separados.
- Configurar cada tanque cilíndrico por altura, diámetro interno y límites mínimo/máximo de llenado; calcular litros totales y volumen operativo del rango.
- Preparar una vista de estado y mando visual para bombas y ventiladores. El mando remoto queda deshabilitado hasta validar ESP32, interbloqueos, seguridad y confirmación de órdenes.
- Mantener una configuración técnica accesible para tipo, ubicación, unidad, offset y límites de cada sensor; los perfiles pecuarios son plantillas iniciales y no recomendaciones productivas validadas.
- Permitir ocultar o contraer la navegación lateral en PC; simplificar la navegación móvil a iconos con nombres accesibles.
- Iniciar en **Mis fincas**: crear cada espacio por nombre y sector, entrar a su tablero y regresar a la lista para cambiar. Configuración de sensores y tanques aislada por finca en este navegador.
- Eliminar la electroválvula del modelo de software. La distribución de agua sin válvula queda pendiente de confirmación del equipo.
- Diseñar el umbral térmico como parámetro de plataforma. En el entorno actual solo modifica valores locales; no cambia potenciómetro, ESP32 o LM358.
- Omitir control remoto de cargas. Las acciones críticas de seguridad deben resolverse localmente en hardware/firmware.

## 5. Contrato de integración

El borrador detallado, el ejemplo JSON, tópicos MQTT propuestos, ACK de configuración y puntos de revisión están en [ECOFLUX-Contrato-v1.2.md](ECOFLUX-Contrato-v1.2.md). Es una propuesta, no un pinout, diseño eléctrico ni acuerdo final de firmware.

## 6. Decisiones que requieren validación técnica

- Tipo, modelo, alcance mínimo y zona ciega de cada sensor de nivel; geometría y calibración de los depósitos.
- Tipo de boyas, nivel físico que detecta cada una, lógica ante cable abierto/roto y prioridad frente a la lectura ultrasónica.
- Ruta hidráulica real tras retirar la electroválvula.
- Cantidad y ubicación de medidores de corriente; rango de cargas, polaridad, precisión y medición individual necesaria por bomba.
- Modelo de MPPT, cómo leer su indicador y procedimiento seguro del interruptor de batería.
- Cómo arbitrar potenciómetro y consigna digital para el LM358. Confirmar pin/DAC de la ESP32 seleccionada o necesidad de DAC externo, límites eléctricos y recuperación ante fallo.
- Umbrales reales de alarma, retardo de desconexión y perfiles ganaderos. No se incluyen umbrales agropecuarios validados todavía.
- Broker/API, autenticación, almacenamiento, períodos de muestreo y disponibilidad sin internet.

## 7. Ruta de implementación

1. **Base de plataforma (este corte):** contrato, simulador e interfaz adaptados a ambiente exterior, dos tanques, perfiles por sector, configuración técnica, límites de llenado, capacidad calculada, estado visual de cargas, MPPT y umbral de prueba.
2. **AIRA y seguridad:** conversación contextual, entrada de voz por botón y salida hablada preparadas; las claves Claude y OpenAI requieren acceso API. Las funciones de predicción no entregan estimaciones hasta validación. Continúan pendientes las pruebas de conversación, el flujo de confirmación y el ACK de configuración. Ninguna orden de emergencia depende de la nube.
3. **Perfiles y energía:** perfiles de vivienda, pollos, cerdos y vacas con valores pendientes de validar; consumo/generación y estudio comparativo con/sin uso basado en sesiones medidas.
4. **Calidad y accesibilidad:** autoevaluación de recepción en Diagnóstico, navegación con teclado, foco visible, texto legible, etiquetas accesibles y pruebas en móvil/PC.
5. **Guía:** mantener la guía y el contrato alineados con decisiones confirmadas, etiquetando supuestos y cambios.

## 8. Criterios de honestidad de interfaz

- El entorno de prueba se identifica una vez en el encabezado; en Diagnóstico se explica que sus valores son locales y no vienen de sensores físicos.
- Sin lectura se muestra “Sin dato”; no se representa como cero.
- Si la telemetría se interrumpe, se informa su antigüedad y no se deduce que las cargas se apagaron.
- Una tendencia no se presenta como pronóstico confiable sin mediciones suficientes y una validación posterior.
- AIRA explica y orienta; no sustituye la inspección ni el mando local.

## 9. Archivos del proyecto

- Aplicación: `index.html`, `src/scripts/`, `src/styles/`.
- Contrato: `ECOFLUX-Contrato-v1.2.md`.
- Guía base anterior: `ECOFLUX-Guia-v1.1.pdf`.
