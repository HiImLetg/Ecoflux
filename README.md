# ECOFLUX

Prototipo de software para supervisar clima, agua y energía desde una interfaz clara para móvil y escritorio.

## Primera entrega

- Interfaz web responsiva basada en el archivo Figma de ECOFLUX.
- Pantallas: Inicio, Historial, Alertas, Tendencia, AIRA y Diagnóstico.
- Entorno local de prueba para recorrer condiciones antes de conectar sensores.
- Modelo de datos v1.2: entorno interior/exterior, cisterna y tanque elevado, corrientes por grupo, MPPT y estado del interruptor físico.
- Ajuste de umbral térmico solo en el entorno local; todavía no envía parámetros a una placa.
- AIRA separa el cerebro conversacional, los servicios de voz y las herramientas de predicción.
- No hay conexión con la ESP32 ni control de actuadores en esta etapa.
- Conector local preparado para Claude Opus 5.5 (`claude-opus-5-5`) como cerebro por defecto, configurable para otro proveedor. La clave se guarda en `.env`, nunca en el frontend.
- Voz OpenAI preparada mediante grabación por botón, transcripción y síntesis de voz; la clave nunca se expone en el navegador.
- Herramientas separadas `forecast_temp`, `battery_autonomy` y `check_anomalies`. Quedan en `calibrando`/`sin dato` hasta elegir y validar algoritmos con mediciones.
- Gráfico vertical de llenado para cisterna y tanque elevado. Si no llega un porcentaje continuo, el dibujo muestra el rango entre boyas sin inventar una medida.
- Indicador MPPT en el encabezado: verde encendido, gris apagado y gris neutro sin telemetría.
- Perfiles precargados de vivienda, avícola, porcino y ganadero con tema visual y configuración guardada por perfil.
- Configuración técnica individual de sensores y tanques cilíndricos; altura/diámetro calculan capacidad total, volumen a límites y rango operativo.
- Vista de bombas y ventiladores con estados de telemetría y controles deshabilitados hasta validar la integración física y de seguridad.
- Menú lateral contraíble; navegación móvil simplificada a iconos con etiquetas accesibles.
- Límites mínimo y máximo de llenado configurables por tanque. Las marcas se reflejan en el gráfico; la capacidad y volumen operativo se calculan en litros.
- Entrada a **Mis fincas** con creación por nombre y tipo, acceso directo al tablero y retorno fácil para cambiar de espacio; la configuración técnica queda aislada por finca.

## Estructura

```text
assets/
  brand/       Referencias visuales de ECOFLUX
  icons/       SVG locales exportados del diseño de Figma
docs/          Documentos guía del proyecto
src/
  scripts/     Interfaz y entorno de prueba local
  styles/      Tokens visuales y estilos responsivos
index.html     Entrada de la aplicación
```

## Abrir en VS Code

Abre esta carpeta como proyecto en VS Code y abre `index.html` en un navegador. Si el navegador restringe recursos locales, inicia un servidor estático desde la terminal integrada:

```powershell
python -m http.server 4173
```

Luego abre `http://localhost:4173`.

## Preparar AIRA: Claude + voz OpenAI

El frontend funciona con Live Server. En una segunda terminal, prepara la API local:

```powershell
npm run api
```

El archivo `.env` ya está creado localmente a partir de `.env.example`. Añade allí `ANTHROPIC_API_KEY` y `OPENAI_API_KEY`, y reinicia el servidor. Si preparas una copia limpia del proyecto sin ese archivo, créalo con `Copy-Item .env.example .env`. No compartas `.env` ni pegues claves en el navegador. `LLM_PROVIDER=anthropic` deja a Claude como cerebro; para cambiarlo a OpenAI se configura `LLM_PROVIDER=openai` y `OPENAI_CHAT_MODEL`. La voz usa siempre OpenAI, independiente del proveedor conversacional.

Las API keys y los planes gratuitos de Claude.ai/ChatGPT son cosas distintas: el uso de API puede requerir facturación/créditos por separado. Con las claves vacías, la plataforma abre y conserva la entrada escrita; la voz de IA y las respuestas del modelo quedan pendientes de sus credenciales.

El servicio de voz inicial usa `gpt-transcribe` y `gpt-4o-mini-tts`. OpenAI anuncia el retiro de `gpt-4o-mini-tts` para el 6 de enero de 2027; antes de esa fecha habrá que cambiar la ruta de síntesis del servidor por Realtime. La interfaz está desacoplada y no requiere rediseñarse para esa migración.

## Recorrer el entorno de prueba

1. En **Mis fincas**, crea un espacio con nombre y perfil; se abrirá su tablero.
2. En el menú, abre **Configuración técnica** para definir sensores, dimensiones y límites de los tanques.
3. En **Bombas y ventiladores** revisa la vista de estados; los controles remotos permanecen desactivados mientras se integra la electrónica.
4. Para recorrer el simulador, abre **Diagnóstico**.
5. Elige una condición y pulsa **Iniciar prueba local**.
6. Vuelve a Inicio, Historial, Alertas, Tendencia o AIRA para recorrer los datos.

El encabezado indica **PRUEBA LOCAL** mientras se muestran valores generados en el navegador. Sin conexión física, el estado de la ESP32 permanece como “Sin conexión” y las métricas del equipo aparecen como “Sin dato”.

## Referencias del proyecto

- Guía de proyecto: `docs/ECOFLUX-Guia-v1.1.pdf`
- Guía de proyecto actualizada: `docs/ECOFLUX-Guia-v1.2.md`
- Contrato de datos propuesto: `docs/ECOFLUX-Contrato-v1.2.md` (pendiente de validación con electrónica)
- Preparación del conector Claude: `server.mjs` y `.env.example`
- Servicios de voz y selección de LLM: `server.mjs`, `.env.example` y `src/scripts/app.js`
- Contratos iniciales de predicción (sin pronósticos habilitados): `src/scripts/prediction-tools.js`
- Guía previa: `docs/AgroClima-Guia-v1.0.pdf`
- Marca de referencia: `assets/brand/ECOFLUX-logo-referencia.jpg`
- Diseño de interfaz: [ECOFLUX en Figma](https://www.figma.com/design/8uFF29ZlHB39OktEMtudp8/Ecoflux?node-id=0-1)

## Próxima integración

El entorno local sigue el contrato v1.2, que aún es una propuesta para revisar con electrónica. Antes de conectar MQTT, WebSocket o una ESP32, deben validarse el circuito hidráulico, sensores, rangos, polaridades, control del LM358 y estados seguros. La interfaz no es el control local ni omite las protecciones físicas.
