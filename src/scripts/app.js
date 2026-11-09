(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const icon = (file, extra = "") => `<img class="${extra}" src="assets/icons/${file}.svg" alt="" />`;
  const app = { screen: "inicio", simulation: null, historyRange: "day", toastTimer: null, chat: [] };
  const content = $("#page-content");

  const format = (value, digits = 0) => value == null || Number.isNaN(Number(value)) ? "—" : Number(value).toFixed(digits);
  const current = () => app.simulation?.current || null;
  const isDemo = () => Boolean(app.simulation?.running && current()?.simulated);
  const isOnline = () => isDemo() && current()?.connected;
  const timestamp = (value) => value ? new Date(value).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" }) : "Sin hora";

  function toast(message) {
    const node = $("#toast");
    node.textContent = message;
    node.classList.add("is-visible");
    window.clearTimeout(app.toastTimer);
    app.toastTimer = window.setTimeout(() => node.classList.remove("is-visible"), 3000);
  }

  function setFarmName(name) {
    const cleaned = String(name || "").trim().slice(0, 36) || "Mi finca";
    $("#farm-name-top").textContent = cleaned;
    $("#farm-name-sidebar").textContent = cleaned;
    try { localStorage.setItem("ecoflux-farm-name", cleaned); } catch { /* El almacenamiento local puede estar deshabilitado. */ }
  }

  function loadFarmName() {
    try { const saved = localStorage.getItem("ecoflux-farm-name"); if (saved) setFarmName(saved); } catch { /* Sigue con el nombre de muestra. */ }
  }

  function syncHeader() {
    const badge = $("#demo-badge");
    const chip = $("#connection-chip");
    badge.hidden = !isDemo();
    const connected = isOnline();
    chip.classList.toggle("is-connected", connected);
    if (connected) chip.innerHTML = `<span class="status-dot"></span><span>Simulación local</span>`;
    else chip.innerHTML = `${icon("6420c")}<span>${isDemo() ? "Simulador sin conexión" : "Sin conexión"}</span>`;
  }

  function systemLine() {
    if (!isDemo()) return "Revisar sistema · Esperando mediciones";
    if (current()?.sensor_lost) return "Revisar sistema · Sensor de temperatura sin dato";
    if (!current()?.connected) return "Revisar sistema · Simulación sin conexión";
    if (current()?.tank_high_pct < 20) return "Revisar sistema · Nivel de agua bajo";
    if (current()?.scenario === "dryPump") return "Revisar sistema · Corriente de bomba inusual";
    if (current()?.scenario === "cycling") return "Revisar sistema · Conmutación frecuente";
    if (current()?.temp_int_c >= 33) return "Revisar sistema · Temperatura alta en la simulación";
    return "Sistema de demostración · Mediciones simuladas";
  }

  function pageHeading(title, subtitle, kicker = "AGUA, AIRE Y ENERGÍA · MI FINCA") {
    return `<div class="page-heading"><p class="page-kicker">${kicker}</p><h1>${title}</h1><p>${subtitle}</p></div><div class="system-state">${icon("3e417")}<span>${systemLine()}</span></div>`;
  }

  function getAlerts(data = current()) {
    if (!isDemo() || !data) return [];
    const alerts = [];
    if (data.sensor_lost) alerts.push({ id: "sensor", level: "info", title: "Sensor de temperatura sin dato", body: "La simulación no entrega una lectura válida para este sensor.", action: "Revisa el sensor y su conexión antes de usar esa medición." });
    if (data.tank_high_pct != null && data.tank_high_pct < 20) alerts.push({ id: "tank", level: "warning", title: "Nivel de agua por revisar", body: "El escenario simulado representa un nivel bajo en el tanque elevado.", action: "Comprueba el depósito de forma segura. No manipules la bomba ni las conexiones si no sabes cómo hacerlo." });
    if (data.scenario === "dryPump") alerts.push({ id: "pump", level: "critical", title: "Corriente de bomba inusual", body: "En esta demostración, la bomba está encendida con una corriente simulada por debajo de su valor de referencia.", action: "Detén la demostración y revisa el nivel de agua. No es una medición real." });
    if (data.temp_int_c != null && data.temp_int_c >= 33) alerts.push({ id: "temp", level: "critical", title: "Temperatura fuera del umbral de demostración", body: "La lectura simulada supera el umbral configurado solo para este escenario.", action: "Revisa el ambiente y el estado de la ventilación. La alerta no representa el estado de un equipo real." });
    if (data.scenario === "cycling") alerts.push({ id: "cycling", level: "warning", title: "Conmutación frecuente", body: "El escenario simula activaciones repetidas cerca del umbral.", action: "Revisa el umbral y la histéresis con el equipo de electrónica." });
    if (!data.connected) alerts.push({ id: "offline", level: "warning", title: "Simulación sin conexión", body: "Se perdió la comunicación en el escenario. No se reciben datos nuevos.", action: "El control local del prototipo real debe verificarse por separado." });
    return alerts;
  }

  function metricCard(title, image, value, unit, note) {
    return `<article class="surface-card metric-card"><div class="metric-title">${icon(image)}<span>${title}</span></div><div class="metric-value"><strong>${value}</strong><span>${unit}</span></div><p class="metric-note">${note}</p></article>`;
  }

  function equipmentRow(name, image, key) {
    const data = current();
    let state = "Sin información";
    if (isDemo() && data?.loads?.[key]) state = data.loads[key].on ? "Encendido · simulado" : "Apagado · simulado";
    return `<div class="equipment-row">${icon(image)}<span class="equipment-name">${name}</span><span class="equipment-state">${state}</span></div>`;
  }

  function emptyAlertPanel() {
    const alerts = getAlerts();
    if (!alerts.length) return `<div class="alert-empty"><strong>${isDemo() ? "No hay alertas en este escenario" : "Aún no hay alertas recibidas"}</strong><p>${isDemo() ? "La demostración no detecta condiciones que requieran atención." : "No hay información para confirmar el estado del sistema. Comprueba la conexión; si notas un riesgo, revisa el equipo en persona."}</p></div>`;
    const alert = alerts[0];
    return `<div class="alert-empty"><strong>${alert.title}</strong><p>${alert.body}</p><button class="button" type="button" data-screen="alertas">${icon("65aa1")}Ver alertas</button></div>`;
  }

  function renderHome() {
    const data = current();
    const hasData = isDemo() && data;
    const temp = hasData ? format(data.temp_int_c, 1) : "—";
    const tempNote = !hasData ? "Esperando la primera medición." : data.temp_int_c == null ? "Sin dato de temperatura." : `Última actualización simulada: ${timestamp(data.ts)}.`;
    const water = hasData ? format(data.tank_high_pct) : "—";
    const battery = hasData ? format(data.batt_v, 1) : "—";
    const batteryUnit = hasData ? "V" : "%";
    const solar = hasData ? format(data.solar_w) : "—";
    const alerts = getAlerts();
    const alertCount = alerts.length;
    return `${pageHeading("Tu finca, de un vistazo", "Lo esencial para cuidar el ambiente, el agua y la energía.")}
      ${isDemo() && !data.connected ? `<div class="notice notice-warning">${icon("6420c")}<div><strong>Simulación sin conexión</strong><p>Este escenario no entrega datos nuevos. El estado del control local real no se puede confirmar desde aquí.</p></div></div>` : ""}
      <div class="dashboard-grid dashboard-top">
        <article class="temperature-card">
          <div class="card-label-row"><div class="card-label">${icon("5674c")}<span>Temperatura interior</span></div><span class="state-chip">${icon("24c68")}${hasData && data.temp_int_c != null ? "Simulada" : "Sin dato"}</span></div>
          <div class="temperature-reading"><strong>${temp}</strong><span>°C</span></div>
          <p class="temperature-description">${tempNote}</p>
          <div class="trend-inline">${icon("43ebb")}<span>Tendencia · ${hasData && app.simulation.history.length >= 6 ? "Datos de simulación disponibles" : "Aún sin mediciones"}</span></div>
          <p class="temperature-footnote">${hasData ? "Valores de demostración; no describen la maqueta física." : "Sin datos para mostrar cambios de temperatura."}</p>
        </article>
        <div class="metric-grid">
          ${metricCard("Humedad", "9b708", hasData ? format(data.hum_int_pct) : "—", "%", hasData ? "Dato simulado" : "Sin dato")}
          ${metricCard("Nivel de agua", "7dc3b", water, "%", hasData ? "Tanque elevado · simulado" : "Sin dato")}
          ${metricCard("Batería", "8b830", battery, batteryUnit, hasData ? "Voltaje simulado" : "Sin dato")}
          ${metricCard("Energía solar", "aded9", solar, "W", hasData ? "Potencia simulada" : "Sin dato")}
        </div>
      </div>
      <div class="dashboard-grid dashboard-lower">
        <div>
          <article class="surface-card section-card">
            <h2>Tus equipos</h2><p class="section-subtitle">${hasData ? "Estados recibidos por el simulador." : "Su estado aún no se puede verificar."}</p>
            <div class="equipment-list">${equipmentRow("Ventiladores", "8be6d", "fan1")}${equipmentRow("Bomba", "4d90f", "pump_high")}${equipmentRow("Válvula", "ea10a", "valve")}</div>
            <p class="card-footnote">Aquí verás información, no controles directos.</p>
          </article>
          <div class="button-row"><button class="button" type="button" data-screen="historial">${icon("63857")}Historial</button><button class="button button-primary" type="button" data-screen="aira">${icon("81ca0")}Hablar con AIRA</button></div>
        </div>
        <div>
          <article class="surface-card section-card">
            <h2>${icon("b0eb9", "inline-icon")} Alertas recientes</h2>${emptyAlertPanel()}
          </article>
          <article class="emergency-card"><div class="emergency-heading"><span>${icon("9e2c0")}Parada de emergencia</span>${icon("055aa")}</div><p>No disponible a distancia. Usa la parada física del equipo.</p><button class="button button-disabled" type="button" disabled>${icon("055aa")}Parada remota no disponible</button></article>
        </div>
      </div>
      <footer class="page-footer">${icon("4749a")}<span>Acceso técnico separado · <button class="text-button" type="button" data-screen="diagnostico">Diagnóstico</button></span></footer>`;
  }

  function pathFor(values, width = 600, height = 170) {
    const valid = values.filter((v) => Number.isFinite(v));
    if (valid.length < 2) return "";
    const min = Math.min(...valid) - 1;
    const max = Math.max(...valid) + 1;
    const range = max - min || 1;
    return valid.map((value, index) => `${index === 0 ? "M" : "L"} ${(index / (valid.length - 1)) * width} ${height - ((value - min) / range) * (height - 18) - 9}`).join(" ");
  }

  function chartCard(title, unit, key, color = "#12676d") {
    const items = app.simulation?.history || [];
    const values = items.map((item) => item[key]).filter((value) => value != null).slice(-30);
    return `<article class="surface-card chart-card"><div class="card-label-row"><h2>${title}</h2><span class="metric-status">${unit}</span></div><p class="chart-caption">${isDemo() ? "Valores simulados" : "Valores registrados"}</p>${values.length < 2 ? `<div class="chart-empty">${icon("63857")}<span>Aún sin mediciones</span></div>` : `<svg class="chart" viewBox="0 0 600 170" role="img" aria-label="Gráfica de ${title}"><path d="M0 20 H600 M0 65 H600 M0 110 H600 M0 155 H600" stroke="#e9ede7" stroke-width="1" fill="none"/><path d="${pathFor(values)}" stroke="${color}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`}<p class="chart-meta">${values.length ? `${values.length} muestras · última ${timestamp(items.at(-1)?.ts)}` : "Fecha y hora · sin registros"}</p></article>`;
  }

  function renderHistory() {
    return `${pageHeading("Cada dato cuenta", "Consulta las mediciones que reciba tu finca. Sin registros, no hay valores que comparar.")}
      <div class="segmented" role="group" aria-label="Rango del historial"><button type="button" data-range="day" class="${app.historyRange === "day" ? "is-active" : ""}">Día</button><button type="button" data-range="week" class="${app.historyRange === "week" ? "is-active" : ""}">Semana</button></div>
      <p class="section-subtitle">${isDemo() ? `Escenario: ${app.simulation.current?.scenario_label} · datos simulados` : "Sin fechas disponibles · Aún sin registros"}</p>
      ${!isDemo() ? `<div class="notice notice-info">${icon("63857")}<div><strong>Tu historial empieza con una medición</strong><p>Las gráficas se completarán al recibir datos. Un espacio vacío no significa que el valor sea cero.</p></div></div>` : ""}
      <div class="section-grid">${chartCard("Temperatura", "°C", "temp_int_c")}${chartCard("Humedad", "%", "hum_int_pct")}${chartCard("Nivel de agua", "%", "tank_high_pct")}${chartCard("Energía solar", "W", "solar_w", "#805c13")}</div>
      <section class="info-panel" style="margin-top:20px"><h2>${icon("43ebb", "inline-icon")} Una mirada hacia adelante</h2><p>La tendencia se calculará con mediciones suficientes y se identificará como simulada cuando corresponda.</p><button class="button" type="button" data-screen="tendencia">${icon("65aa1")}Ver Tendencia</button></section>
      ${footer()}`;
  }

  function footer() { return `<footer class="page-footer">${icon("4749a")}<span>Acceso técnico separado · <button class="text-button" type="button" data-screen="diagnostico">Diagnóstico</button></span></footer>`; }

  function alertCard(alert, sample = false) {
    const levelLabel = { critical: "Crítico · Atención necesaria", warning: "Aviso · Revisar sistema", info: "Información" }[alert.level];
    const levelIcon = { critical: "9e2c0", warning: "3e417", info: "3e417" }[alert.level];
    return `<article class="surface-card alert-card is-${alert.level}"><div class="alert-card-top"><span class="alert-pill is-${alert.level}">${icon(levelIcon)}${levelLabel}</span>${sample ? `<span class="example-label">EJEMPLO SIMULADO</span>` : ""}</div><h3>${alert.title}</h3><p>${sample ? "Escenario de demostración · " : ""}${alert.body}</p><div class="alert-action is-${alert.level}"><strong>QUÉ HACER</strong>${alert.action}</div></article>`;
  }

  function renderAlerts() {
    const alerts = getAlerts();
    const samples = [
      { level: "critical", title: "Temperatura fuera del límite", body: "En este ejemplo se recibe una señal de temperatura fuera del límite configurado.", action: "Si ocurre, revisa el ambiente en persona. Si hay peligro, usa la parada física del equipo y pide apoyo técnico." },
      { level: "warning", title: "Nivel de agua por revisar", body: "Este escenario muestra un aviso de agua que necesita revisión.", action: "Comprueba el depósito de forma segura. No manipules la bomba ni las conexiones si no sabes cómo hacerlo." },
      { level: "info", title: "Sensor en calibración", body: "Este escenario muestra un sensor preparando su medición; todavía no hay un dato utilizable.", action: "Espera una medición válida. Si la situación continúa, consulta a la persona responsable del equipo." },
    ];
    return `${pageHeading("Avisos claros, pasos seguros", "Distingue lo que requiere atención y qué puedes hacer.")}
      <article class="surface-card section-card" style="margin-bottom:22px"><div class="card-label-row"><span class="eyebrow">ESTADO ACTUAL ${isDemo() ? "· SIMULACIÓN" : "· REAL"}</span><span class="state-chip">${alerts.length ? `${alerts.length} alerta${alerts.length === 1 ? "" : "s"}` : "Sin información"}</span></div><div class="alert-empty"><strong>${alerts.length ? "Alertas del escenario" : "Aún no hay alertas recibidas"}</strong><p>${alerts.length ? "Estas alertas describen únicamente el escenario simulado." : "Sin mediciones recibidas no podemos saber si hay alertas pendientes. Esto no confirma que todo funcione."}</p></div></article>
      <div class="dashboard-grid"><div><h2>Ejemplos de alertas</h2><p class="section-subtitle">Escenarios ilustrativos, no avisos de tu finca. Ordenados de mayor a menor prioridad.</p><div class="alert-list">${(alerts.length ? alerts : samples).map((item) => alertCard(item, isDemo())).join("")}</div></div><aside><section class="info-panel"><h2>Primero, tu seguridad</h2><p>El icono y la palabra indican la prioridad. El color solo acompaña.</p><p>🔴 Crítico: requiere atención.</p><p>🟠 Aviso: revisa el sistema.</p><p>🔵 Información: conoce el contexto.</p></section><section class="surface-card section-card" style="margin-top:16px"><h2>${icon("81ca0", "inline-icon")} AIRA te lo explica</h2><p class="section-subtitle">Puede ayudarte a entender un aviso. No promete resolverlo ni actúa por su cuenta.</p><button class="button" type="button" data-screen="aira">${icon("65aa1")}Consultar a AIRA</button></section></aside></div>${footer()}`;
  }

  function getTrend() {
    const values = (app.simulation?.history || []).map((item) => item.temp_int_c).filter(Number.isFinite).slice(-8);
    if (values.length < 6) return null;
    const start = values[0]; const end = values.at(-1);
    return { start, end, delta: end - start, horizon30: end + (end - start) * 3, horizon60: end + (end - start) * 6 };
  }

  function renderTrend() {
    const trend = getTrend();
    const items = app.simulation?.history || [];
    const values = items.map((item) => item.temp_int_c).filter(Number.isFinite).slice(-30);
    return `${pageHeading("Entender lo que viene", "Una estimación útil empieza con información suficiente.")}
      <p><button class="text-button" type="button" data-screen="historial">← &nbsp;Historial / Tendencia</button></p>
      <article class="surface-card chart-card"><div class="card-label-row"><h2>Temperatura interior</h2><span class="metric-status">°C</span></div><p class="chart-caption">━ Temperatura observada &nbsp;&nbsp; ━ Tendencia estimada ${isDemo() ? "(simulada)" : ""}</p>${values.length < 2 ? `<div class="chart-empty">${icon("63857")}<span>Reuniendo datos</span></div>` : `<svg class="chart" viewBox="0 0 600 170" role="img" aria-label="Tendencia ${isDemo() ? "simulada" : "de temperatura"}"><path d="M0 20 H600 M0 65 H600 M0 110 H600 M0 155 H600" stroke="#e9ede7" fill="none"/><path d="${pathFor(values)}" stroke="#12676d" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>${trend ? `<path d="M600 ${170 - (Math.min(158, Math.max(12, 170 - (values.at(-1) - Math.min(...values) + 1) / (Math.max(...values) - Math.min(...values) + 2) * 152)))} l80 -16" stroke="#805c13" stroke-width="3" stroke-dasharray="7 7" fill="none"/>` : ""}</svg>`}<p class="chart-meta">${values.length ? `${values.length} muestras · última ${timestamp(items.at(-1)?.ts)}` : "Fecha y hora · sin registros"}</p></article>
      <div class="notice notice-info" style="margin-top:20px">${icon("3e417")}<div><strong>${trend ? "Tendencia ilustrativa disponible" : "Todavía no hay mediciones suficientes para estimar la temperatura"}</strong><p>${trend ? "La tendencia usa las últimas mediciones simuladas y no activa equipos." : "Reuniendo datos. No se muestra una curva ni una banda de confianza sin información que las respalde."}</p></div></div>
      <div class="section-grid"><article class="surface-card section-card"><h2>Antes de estimar</h2><p class="section-subtitle">Se usarán mediciones de temperatura con su fecha y hora. También se comprobará que tengan continuidad.</p><p class="metric-note">Temperatura observada · ${trend ? `${format(trend.end, 1)} °C (simulada)` : "Sin dato"}</p><p class="metric-note">Continuidad · ${values.length} muestras</p></article><article class="info-panel"><h2>Sin adelantar conclusiones</h2><p>Horizonte · ${trend ? "30 y 60 min, ilustrativo" : "No disponible"}</p><p>Confianza · ${trend ? "Aún sin calibrar" : "No disponible"}</p><p>La tendencia orienta; no decide ni activa equipos.</p></article></div>${footer()}`;
  }

  function makeAiraReply(question) {
    const q = question.toLowerCase();
    const data = current();
    if (!isDemo() || !data) return "Todavía no tengo mediciones. No puedo confirmar la temperatura, el nivel de agua ni el estado de los equipos.";
    if (q.includes("temperatura") || q.includes("calor")) return data.temp_int_c == null ? "No tengo una lectura válida de temperatura en este escenario." : `La temperatura del escenario es ${format(data.temp_int_c, 1)} °C. Es un dato simulado, no una medición de la maqueta.`;
    if (q.includes("agua") || q.includes("tanque")) return data.tank_high_pct == null ? "No hay dato disponible del tanque." : `El tanque elevado está en ${format(data.tank_high_pct)}% dentro de la simulación. En el sistema real, el nivel todavía requiere un sensor.`;
    if (q.includes("batería") || q.includes("energia") || q.includes("energía") || q.includes("solar")) return `La batería simulada está en ${format(data.batt_v, 1)} V y la energía solar estimada por el escenario es ${format(data.solar_w)} W. No son lecturas reales.`;
    if (q.includes("alerta")) { const alerts = getAlerts(); return alerts.length ? `El escenario tiene ${alerts.length} alerta${alerts.length === 1 ? "" : "s"}: ${alerts.map((a) => a.title).join("; ")}. Son ejemplos simulados.` : "Este escenario no tiene alertas activas. Es una simulación, no confirma el estado de la maqueta."; }
    if (q.includes("bomba") || q.includes("encend")) return `En el escenario «${data.scenario_label}», la bomba de presurización aparece ${data.loads.pump_high.on ? "encendida" : "apagada"}. Es un estado simulado.`;
    return "Puedo consultar temperatura, agua, energía, estado de bombas y alertas. Solo responderé con datos disponibles y marcaré los simulados.";
  }

  function appendChat(role, text) {
    app.chat.push({ role, text });
    const log = $("#chat-log");
    if (!log) return;
    log.insertAdjacentHTML("beforeend", `<div class="chat-message ${role === "user" ? "is-user" : "is-assistant"}"><strong>${role === "user" ? "Tú" : "AIRA"}</strong><br>${escapeHtml(text)}</div>`);
    log.scrollTop = log.scrollHeight;
  }

  function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]); }

  function renderAira() {
    const suggestions = ["¿Cómo está la temperatura?", "¿Cuánta agua queda?", "¿Qué alertas hay?"];
    return `${pageHeading("Hablemos de tu finca", "Una ayuda cercana para entender, preguntar y decidir con calma.")}
      <div class="assistant-layout"><section class="surface-card chat-card"><h2>${icon("81ca0", "inline-icon")} AIRA</h2><p class="card-footnote">Tu guía, paso a paso</p><div class="chat-message is-assistant"><strong>Hola, soy AIRA. Puedo ayudarte a entender el sistema.</strong><br>Puedes escribir o usar tu voz cuando haya conexión. Tú mantienes la decisión.</div><div class="suggestion-list">${suggestions.map((q) => `<button class="suggestion-button" type="button" data-question="${q}">◯ &nbsp;${q}</button>`).join("")}</div><div id="chat-log">${app.chat.map((item) => `<div class="chat-message ${item.role === "user" ? "is-user" : "is-assistant"}"><strong>${item.role === "user" ? "Tú" : "AIRA"}</strong><br>${escapeHtml(item.text)}</div>`).join("")}</div><form class="chat-form" id="chat-form"><input id="chat-input" autocomplete="off" aria-label="Escribe tu pregunta" placeholder="Escribe tu pregunta…" /><button class="button" type="button" id="voice-button" aria-label="Usar micrófono">${icon("81ca0")}<span>Voz</span></button><button class="button button-primary" type="submit">Enviar</button></form><p class="chat-disclaimer">Demo local sin IA conectada. AIRA responde usando reglas y datos disponibles en este prototipo.</p></section>
      <aside><section class="info-panel"><h2>AIRA te acompaña, no decide por ti</h2><p>Explica datos y alertas. En esta etapa no manda directamente instrucciones a los equipos.</p></section><section class="surface-card section-card" style="margin-top:14px"><span class="eyebrow">ESTADO ACTUAL · ${isOnline() ? "SIMULACIÓN LOCAL" : "SIN CONEXIÓN"}</span><h2 style="margin-top:12px">${isOnline() ? "Consulta disponible" : "Esperando datos"}</h2><p class="section-subtitle">${isOnline() ? "Las respuestas se basan en el escenario simulado." : "No hay lecturas disponibles. Puedes iniciar el simulador desde Diagnóstico."}</p><button class="button" type="button" data-screen="diagnostico">Abrir diagnóstico</button></section><section class="info-panel" style="margin-top:14px"><h2>Si hay un riesgo, no esperes al chat</h2><p>Busca ayuda en el lugar. Si es necesario, usa la parada física del equipo y contacta a la persona responsable.</p></section></aside></div>${footer()}`;
  }

  function renderDiagnosis() {
    const data = current();
    const scenarios = app.simulation?.scenarios || {};
    const sensors = [
      ["Temperatura interior", "°C", data?.temp_int_c], ["Humedad", "%", data?.hum_int_pct], ["Nivel de agua", "%", data?.tank_high_pct], ["Batería", "V", data?.batt_v], ["Energía solar", "W", data?.solar_w],
    ];
    return `${pageHeading("Revisión técnica", "Información para revisar la conexión y la llegada de datos. Sin acciones de control.", "ACCESO TÉCNICO / DIAGNÓSTICO")}
      ${isDemo() && !data.connected ? `<div class="notice notice-warning">${icon("6420c")}<div><strong>Simulación desconectada</strong><p>El escenario representa pérdida de comunicación. No describe el estado del control físico.</p></div></div>` : ""}
      <div class="diagnostic-grid"><div><section class="surface-card section-card"><h2>Conexión y recepción</h2><div class="diagnostic-list"><div class="diagnostic-row">${icon("6420c")}<div><strong>Fuente de datos</strong><span>${isDemo() ? "Simulador local" : "Sin conexión"}</span></div></div><div class="diagnostic-row">${icon("63857")}<div><strong>Última telemetría</strong><span>${data ? timestamp(data.ts) : "Sin telemetría recibida"}</span></div></div><div class="diagnostic-row">${icon("ea10a")}<div><strong>Escenario</strong><span>${isDemo() ? data.scenario_label : "Simulador detenido"}</span></div></div><div class="diagnostic-row">${icon("4749a")}<div><strong>Control local</strong><span>Estado no disponible desde el prototipo web</span></div></div></div></section>
      <section class="surface-card section-card" style="margin-top:16px"><h2>Simulador de la maqueta</h2><p class="section-subtitle">Datos ficticios para recorrer la interfaz; no representan lecturas ni controlan equipos reales.</p><div class="sim-controls"><label for="scenario-select">Escenario de demostración<select id="scenario-select">${Object.entries(scenarios).map(([key, label]) => `<option value="${key}" ${app.simulation?.scenario === key ? "selected" : ""}>${label}</option>`).join("")}</select></label><div class="sim-toggle"><span>${app.simulation?.running ? "Simulación activa" : "Simulación detenida"}</span><button class="switch" id="sim-toggle" type="button" role="switch" aria-checked="${Boolean(app.simulation?.running)}" aria-label="Activar simulador"></button></div><button class="button button-primary" type="button" id="sim-start">${app.simulation?.running ? "Reiniciar escenario" : "Iniciar simulación"}</button></div><div class="diagnostic-callout"><strong>Modo seguro de demostración</strong><p>Esta pantalla solo altera datos simulados del navegador. No envía comandos a la ESP32 ni a la electrónica.</p></div></section></div>
      <div><section class="surface-card section-card"><h2>Datos por sensor</h2><p class="section-subtitle">${data ? "Lecturas de demostración · no son datos reales" : "No se han recibido lecturas válidas."}</p><div class="diagnostic-list">${sensors.map(([name, unit, value]) => `<div class="diagnostic-row">${icon("5674c")}<div><strong>${name}</strong><span>${unit}</span></div><span class="state-chip">${data && value != null ? `${format(value, unit === "V" || unit === "°C" ? 1 : 0)} ${unit}` : "Sin dato"}</span></div>`).join("")}</div></section><div class="diagnostic-callout"><strong>La plataforma no es el control local</strong><p>El prototipo web permite explorar el diseño y los escenarios. La seguridad del sistema físico debe mantenerse en la electrónica local.</p></div></div></div>${footer()}`;
  }

  function render() {
    syncHeader();
    $$("[data-screen]").forEach((button) => button.classList.toggle("is-active", button.dataset.screen === app.screen));
    $$("[data-screen-link]").forEach((button) => button.classList.toggle("is-active", button.dataset.screenLink === app.screen));
    const renderer = { inicio: renderHome, historial: renderHistory, alertas: renderAlerts, tendencia: renderTrend, aira: renderAira, diagnostico: renderDiagnosis }[app.screen] || renderHome;
    content.innerHTML = renderer();
    const count = getAlerts().length;
    const countNode = $("#nav-alert-count");
    countNode.textContent = String(count);
    countNode.hidden = !count;
    bindPageEvents();
  }

  function go(screen) {
    if (!["inicio", "historial", "alertas", "tendencia", "aira", "diagnostico"].includes(screen)) return;
    app.screen = screen;
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function askAira(question) {
    appendChat("user", question);
    window.setTimeout(() => appendChat("assistant", makeAiraReply(question)), 250);
  }

  function bindPageEvents() {
    $$('[data-screen]', content).forEach((button) => button.addEventListener("click", () => go(button.dataset.screen)));
    $$("[data-range]", content).forEach((button) => button.addEventListener("click", () => { app.historyRange = button.dataset.range; render(); }));
    $$("[data-question]", content).forEach((button) => button.addEventListener("click", () => askAira(button.dataset.question)));
    const form = $("#chat-form", content);
    form?.addEventListener("submit", (event) => { event.preventDefault(); const input = $("#chat-input", form); const value = input.value.trim(); if (!value) return; input.value = ""; askAira(value); });
    $("#scenario-select", content)?.addEventListener("change", (event) => { window.EcofluxSimulator.setScenario(event.target.value); toast("Escenario seleccionado. Inicia la simulación para ver los datos."); });
    $("#sim-toggle", content)?.addEventListener("click", () => { if (app.simulation.running) window.EcofluxSimulator.stop(); else window.EcofluxSimulator.start(app.simulation.scenario); });
    $("#sim-start", content)?.addEventListener("click", () => window.EcofluxSimulator.start(app.simulation.scenario));
    $("#voice-button", content)?.addEventListener("click", startVoiceInput);
  }

  function startVoiceInput() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { toast("El reconocimiento de voz no está disponible en este navegador."); return; }
    const recognition = new Recognition();
    recognition.lang = "es-EC";
    recognition.interimResults = false;
    recognition.onresult = (event) => { const said = event.results[0][0].transcript; $("#chat-input", content).value = said; $("#chat-input", content).focus(); };
    recognition.onerror = () => toast("No se pudo reconocer la voz. Puedes escribir tu consulta.");
    recognition.start();
  }

  document.addEventListener("click", (event) => {
    const nav = event.target.closest("[data-screen]");
    if (nav && !content.contains(nav)) go(nav.dataset.screen);
    const link = event.target.closest("[data-screen-link]");
    if (link) { event.preventDefault(); go(link.dataset.screenLink); }
    if (event.target.closest("#edit-farm")) {
      const name = window.prompt("¿Cómo se llama tu finca?", $("#farm-name-top").textContent);
      if (name !== null) setFarmName(name);
    }
  });

  loadFarmName();
  window.EcofluxSimulator.subscribe((snapshot) => {
    app.simulation = snapshot;
    if (app.screen === "aira" && document.activeElement?.id === "chat-input") {
      syncHeader();
      return;
    }
    if (app.screen) render();
  });
  render();
})();
