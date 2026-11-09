# ECOFLUX

Prototipo de software para supervisar clima, agua y energía desde una interfaz clara para móvil y escritorio.

## Primera entrega

- Interfaz web responsiva basada en el archivo Figma de ECOFLUX.
- Pantallas: Inicio, Historial, Alertas, Tendencia, AIRA y Diagnóstico.
- Simulador local con escenarios claramente marcados como demostración.
- AIRA responde consultas sencillas usando solo los datos disponibles en el navegador.
- No hay conexión con la ESP32 ni control de actuadores en esta etapa.

## Estructura

```text
assets/
  brand/       Referencias visuales de ECOFLUX
  icons/       SVG locales exportados del diseño de Figma
docs/          Documentos guía del proyecto
src/
  scripts/     Interfaz y simulador local
  styles/      Tokens visuales y estilos responsivos
index.html     Entrada de la aplicación
```

## Abrir en VS Code

Abre esta carpeta como proyecto en VS Code y abre `index.html` en un navegador. Si el navegador restringe recursos locales, inicia un servidor estático desde la terminal integrada:

```powershell
python -m http.server 4173
```

Luego abre `http://localhost:4173`.

## Probar el simulador

1. En la plataforma, abre **Diagnóstico**.
2. Elige un escenario y pulsa **Iniciar simulación**.
3. Vuelve a Inicio, Historial, Alertas, Tendencia o AIRA para recorrer los datos.

Todo valor creado por el simulador se muestra como simulado. Las métricas reales permanecerán como “Sin dato” hasta que una fuente real las publique.

## Referencias del proyecto

- Guía vigente: `docs/ECOFLUX-Guia-v1.1.pdf`
- Guía previa: `docs/AgroClima-Guia-v1.0.pdf`
- Marca de referencia: `assets/brand/ECOFLUX-logo-referencia.jpg`
- Diseño de interfaz: [ECOFLUX en Figma](https://www.figma.com/design/8uFF29ZlHB39OktEMtudp8/Ecoflux?node-id=0-1)

## Próxima integración

El simulador usa el contrato de datos documentado en la guía como base conceptual. Antes de conectar MQTT, WebSocket o una ESP32, el formato deberá validarse con el equipo de electrónica. La interfaz no debe convertirse en el control local ni omitir las reglas de seguridad de la ESP32.
