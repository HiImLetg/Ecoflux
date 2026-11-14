(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const icon = (file, extra = "") => `<img class="${extra}" src="assets/icons/${file}.svg" alt="" />`;
  const app = { screen: "fincas", simulation: null, historyRange: "day", toastTimer: null, chat: [], aiStatus: "checking", voiceRecorder: null, voiceStream: null, voiceChunks: [], voiceAudioUrl: null, settings: window.EcofluxFarmConfig.load() };
  const farmProfiles = window.EcofluxFarmConfig.profiles;
  const AIRA_API = "http://127.0.0.1:8787/api";
  const content = $("#page-content");

  const format = (value, digits = 0) => value == null || Number.isNaN(Number(value)) ? "—" : Number(value).toFixed(digits);
  const activeFarm = () => app.settings.farms.find((farm) => farm.id === app.settings.activeFarmId) || null;
  const current = () => activeFarm() && app.simulation?.farmId === activeFarm().id ? app.simulation?.current || null : null;
  const selectedProfile = () => farmProfiles[activeFarm()?.type || app.settings.profile] || farmProfiles.vivienda;
  const profileSettings = () => activeFarm()?.configuration || app.settings.profiles[activeFarm()?.type || app.settings.profile];
  function saveSettings() {
    try { localStorage.setItem(window.EcofluxFarmConfig.storageKey, JSON.stringify(app.settings)); } catch { toast("El navegador no pudo guardar la configuración en este dispositivo."); }
  }
  function applyProfile() {
    document.body.dataset.theme = selectedProfile().theme;
    const themeColors = { home: "#f6f5ed", poultry: "#fff8e9", porcine: "#f8f0ed", livestock: "#f1f7f8" };
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = themeColors[selectedProfile().theme] || themeColors.home;
    document.body.dataset.menu = app.settings.collapsed ? "collapsed" : "expanded";
    syncFarmHeader();
    const collapse = $("#sidebar-collapse");
    if (collapse) {
      collapse.setAttribute("aria-label", app.settings.collapsed ? "Expandir menú lateral" : "Contraer menú lateral");
      collapse.setAttribute("aria-expanded", String(!app.settings.collapsed));
      collapse.title = app.settings.collapsed ? "Expandir menú lateral" : "Contraer menú lateral";
      collapse.querySelector("span")?.replaceChildren(document.createTextNode(app.settings.collapsed ? "›" : "‹"));
    }
  }
  const isDemo = () => Boolean(app.simulation?.running && current()?.simulated);
  const isOnline = () => isDemo() && current()?.health?.connected;
  const mpptLabel = (value) => ({ charging: "Cargando", idle: "En espera", off: "Apagado", disabled: "Desactivado", fault: "Falla", unknown: "Sin dato" }[value] || value || "Sin dato");
  const timestamp = (value) => value ? new Date(value).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" }) : "Sin hora";

  function toast(message) {
    const node = $("#toast");
    node.textContent = message;
    node.classList.add("is-visible");
    window.clearTimeout(app.toastTimer);
    app.toastTimer = window.setTimeout(() => node.classList.remove("is-visible"), 3000);
  }

  function syncFarmHeader() {
    const farm = activeFarm();
    const name = farm?.name || "Mis fincas";
    $("#farm-name-top").textContent = name;
    $("#farm-name-sidebar").textContent = farm?.name || "Selecciona una finca";
    const typeLabel = $("#farm-type-label");
    typeLabel.textContent = farm ? selectedProfile().label : "";
    typeLabel.hidden = !farm;
    $("#back-to-farms").hidden = !farm;
    $("#edit-farm").hidden = !farm;
    const menuHome = $('[data-screen="inicio"]');
    if (menuHome) menuHome.disabled = !farm;
  }

  function setFarmName(name) {
    const farm = activeFarm();
    if (!farm) return;
    const cleaned = String(name || "").trim().slice(0, 40);
    if (!cleaned) return;
    farm.name = cleaned;
    saveSettings();
    syncFarmHeader();
  }

  function syncHeader() {
    const topbarStatus = $("#topbar-status");
    if (topbarStatus) topbarStatus.hidden = app.screen === "fincas";
    const badge = $("#demo-badge");
    const chip = $("#connection-chip");
    badge.hidden = !isDemo();
    const connected = isOnline();
    chip.classList.toggle("is-connected", connected);
    if (connected) chip.innerHTML = `<span class="status-dot"></span><span>Lecturas disponibles</span>`;
    else chip.innerHTML = `${icon("6420c")}<span>${isDemo() ? "Prueba local detenida" : "Sin conexión"}</span>`;
    const mppt = current()?.mppt;
    const mpptOn = ["charging", "idle", "on"].includes(mppt?.status);
    const mpptOff = ["off", "disabled"].includes(mppt?.status) || mppt?.controller_present === false;
    const mpptChip = $("#mppt-status-chip");
    mpptChip.dataset.state = mpptOn ? "on" : mpptOff ? "off" : "unknown";
    mpptChip.lastElementChild.textContent = mpptOn ? "MPPT · Encendido" : mpptOff ? "MPPT · Apagado" : "MPPT · Sin dato";
  }

  async function checkAiraConnection() {
    try {
      const response = await fetch(`${AIRA_API}/health`, { signal: AbortSignal.timeout(1800) });
      const status = await response.json();
      const llm = status.llm || {};
      const voice = status.voice || {};
      app.aiStatus = `${llm.configured ? `${llm.provider} conectado · ${llm.model}` : `${llm.provider || "Claude"} listo · falta configurar acceso API`} · Voz OpenAI ${voice.configured ? "lista" : "pendiente de clave"}`;
    } catch { app.aiStatus = "Conector local pendiente · voz y modelo requieren servidor"; }
    if (app.screen === "aira") render();
  }

  function systemLine() {
    if (!isDemo()) return "Esperando lecturas del equipo";
    if (current()?.health?.sensor_lost) return "Revisar sistema · Sensor de temperatura sin dato";
    if (!current()?.health?.connected) return "Revisar sistema · Prueba local sin conexión";
    const lowTank = ["cisterna", "elevado"].some((id) => Number.isFinite(current()?.tanks?.[id]?.level_pct) && current().tanks[id].level_pct <= profileSettings().tanks[id].min_pct);
    const highTank = ["cisterna", "elevado"].some((id) => Number.isFinite(current()?.tanks?.[id]?.level_pct) && current().tanks[id].level_pct >= profileSettings().tanks[id].max_pct);
    if (lowTank) return "Revisar sistema · Se alcanzó el límite mínimo de llenado";
    if (highTank) return "Revisar sistema · Se alcanzó el límite máximo de llenado";
    if (current()?.simulation?.scenario === "dryPump") return "Revisar sistema · Corriente de bomba inusual";
    if (current()?.simulation?.scenario === "cycling") return "Revisar sistema · Conmutación frecuente";
    if (current()?.environment?.temp_int_c >= current()?.control?.temperature_target_c) return "Revisar sistema · Se alcanzó el umbral térmico";
    return "Entorno de prueba · Datos locales";
  }

  function configuredSensorValue(data, id, sensor) {
    let value = null;
    if (id.startsWith("temp")) value = id.includes("ext") ? data?.environment?.temp_ext_c : data?.environment?.temp_int_c;
    else if (id.startsWith("hum")) value = data?.environment?.hum_int_pct;
    else if (id === "pumps") value = data?.groups?.pumps?.current_a;
    else if (id === "fans") value = data?.groups?.fans?.current_a;
    else if (id === "solar") value = data?.groups?.pv?.power_w;
    return Number.isFinite(value) ? value + (Number(sensor.offset) || 0) : null;
  }

  function pageHeading(title, subtitle, kicker = null) {
    const context = kicker || `ECOFLUX · ${activeFarm()?.name || "MIS FINCAS"}`;
    return `<div class="page-heading"><p class="page-kicker">${escapeHtml(context)}</p><h1>${escapeHtml(title)}</h1><p>${subtitle}</p></div><div class="system-state">${icon("3e417")}<span>${systemLine()}</span></div>`;
  }

  function getAlerts(data = current()) {
    if (!isDemo() || !data) return [];
    const alerts = [];
    if (data.health?.sensor_lost) alerts.push({ id: "sensor", level: "info", title: "Sensor de temperatura sin dato", body: "No hay una lectura válida para este sensor.", action: "Revisa el sensor y su conexión antes de usar esa medición." });
    for (const [id, label] of [["cisterna", "la cisterna"], ["elevado", "el tanque elevado"]]) {
      const level = data.tanks?.[id]?.level_pct;
      const limits = profileSettings().tanks[id];
      if (Number.isFinite(level) && level <= limits.min_pct) alerts.push({ id: `tank-low-${id}`, level: "warning", title: `Límite mínimo alcanzado · ${label}`, body: `El nivel ${format(level)}% llegó al mínimo configurado de ${limits.min_pct}%.`, action: "Comprueba el depósito de forma segura. No manipules la bomba ni conexiones sin capacitación." });
      if (Number.isFinite(level) && level >= limits.max_pct) alerts.push({ id: `tank-high-${id}`, level: "warning", title: `Límite máximo alcanzado · ${label}`, body: `El nivel ${format(level)}% llegó al máximo configurado de ${limits.max_pct}%.`, action: "Verifica el llenado en el lugar. El aviso no detiene automáticamente una bomba." });
    }
    for (const [id] of selectedProfile().sensors) {
      if (["cisterna", "tanque", "agua"].includes(id)) continue;
      const sensor = profileSettings().sensors[id];
      if (!sensor?.enabled) continue;
      const value = configuredSensorValue(data, id, sensor);
      if (value == null) continue;
      if (value < sensor.min || value > sensor.max) alerts.push({ id: `sensor-range-${id}`, level: "warning", title: `Medición fuera de rango · ${sensor.name}`, body: `${format(value, 1)} ${sensor.unit}; rango configurado ${sensor.min}–${sensor.max} ${sensor.unit}.`, action: "Comprueba la lectura, ubicación y calibración del sensor. Este aviso no acciona equipos." });
    }
    if (data.simulation?.scenario === "dryPump") alerts.push({ id: "pump", level: "critical", title: "Corriente de bomba inusual", body: "La bomba aparece encendida con un consumo inferior al valor de referencia.", action: "Revisa el nivel de agua y el equipo en persona." });
    if (data.environment?.temp_int_c != null && data.environment.temp_int_c >= data.control?.temperature_target_c) alerts.push({ id: "temp", level: "critical", title: "Temperatura alcanzó el umbral", body: `La lectura llegó a ${format(data.control.temperature_target_c, 1)} °C, el umbral configurado.`, action: "Revisa el ambiente y el estado de la ventilación." });
    if (data.simulation?.scenario === "cycling") alerts.push({ id: "cycling", level: "warning", title: "Conmutación frecuente", body: "Se registran activaciones repetidas cerca del umbral.", action: "Revisa el umbral y la histéresis con el equipo de electrónica." });
    if (!data.health?.connected) alerts.push({ id: "offline", level: "warning", title: "Fuente de datos sin conexión", body: "No se reciben datos nuevos.", action: "Comprueba la conexión. El control local debe verificarse directamente en el equipo." });
    return alerts;
  }

  function metricCard(title, image, value, unit, note) {
    return `<article class="surface-card metric-card"><div class="metric-title">${icon(image)}<span>${title}</span></div><div class="metric-value"><strong>${value}</strong><span>${unit}</span></div><p class="metric-note">${note}</p></article>`;
  }

  function equipmentRow(name, image, key) {
    const data = current();
    let state = "Sin información";
    if (isDemo() && data?.loads?.[key]) state = data.loads[key].on ? "Encendido" : "Apagado";
    return `<div class="equipment-row">${icon(image)}<span class="equipment-name">${name}</span><span class="equipment-state">${state}</span></div>`;
  }

  function emptyAlertPanel() {
    const alerts = getAlerts();
    if (!alerts.length) return `<div class="alert-empty"><strong>${isDemo() ? "No hay avisos en esta prueba" : "Aún no hay avisos recibidos"}</strong><p>${isDemo() ? "Esta prueba no muestra condiciones que requieran atención." : "Sin mediciones no podemos confirmar el estado del sistema. Comprueba la conexión y revisa el equipo en persona si observas un riesgo."}</p></div>`;
    const alert = alerts[0];
    return `<div class="alert-empty"><strong>${alert.title}</strong><p>${alert.body}</p><button class="button" type="button" data-screen="alertas">${icon("65aa1")}Ver alertas</button></div>`;
  }

  function renderFarms() {
    const profiles = Object.entries(farmProfiles);
    const farms = app.settings.farms;
    const profileIcons = { vivienda: "🏠", avicola: "🐔", porcino: "🐖", ganadero: "🐄" };
    const profileCards = profiles.map(([key, profile]) => `<article class="profile-choice-card theme-${profile.theme}"><span class="profile-choice-icon">${profileIcons[key]}</span><strong>${profile.label}</strong><p>${profile.note}</p></article>`).join("");
    const farmCards = farms.length ? farms.map((farm) => {
      const profile = farmProfiles[farm.type];
      const isActive = farm.id === app.settings.activeFarmId;
      return `<article class="farm-list-card theme-${profile.theme}"><div class="farm-list-icon">${profileIcons[farm.type]}</div><div class="farm-list-copy"><span class="eyebrow">${profile.label}</span><h3>${escapeHtml(farm.name)}</h3><p>${profile.note}</p></div><div class="farm-list-actions">${isActive ? '<span class="farm-active-pill">Abierta</span>' : ""}<button class="button button-primary" type="button" data-open-farm="${escapeHtml(farm.id)}">${isActive ? "Entrar" : "Abrir finca"}</button></div></article>`;
    }).join("") : `<div class="empty-state farm-empty"><strong>Aún no tienes fincas</strong><p>Crea la primera con su nombre y actividad para preparar su espacio de trabajo.</p></div>`;
    return `<div class="farms-welcome"><p class="page-kicker">ECOFLUX · ESPACIOS DE TRABAJO</p><h1>Mis fincas</h1><p>Organiza cada espacio por separado y entra directamente a sus datos y herramientas.</p></div>
      <section class="surface-card section-card create-farm-section"><div><h2>Añadir una finca</h2><p class="section-subtitle">Ponle un nombre y selecciona el tipo de espacio.</p></div><form id="create-farm-form" class="create-farm-form"><label>Nombre de la finca<input name="name" maxlength="40" required placeholder="Ej. Granja El Porvenir" /></label><label>Tipo de finca<select name="type" required>${profiles.map(([key, profile]) => `<option value="${key}">${profile.label}</option>`).join("")}</select></label><button class="button button-primary" type="submit">Crear y entrar</button></form></section>
      <section class="farms-section"><div class="farms-section-heading"><div><h2>Mis espacios</h2><p>Selecciona una finca para continuar.</p></div><span class="farm-count">${farms.length} ${farms.length === 1 ? "finca" : "fincas"}</span></div><div class="farm-list">${farmCards}</div></section>
      <section class="profile-presets"><h2>Perfiles disponibles</h2><div class="profile-choice-grid">${profileCards}</div></section>`;
  }

  function renderHome() {
    const data = current();
    const hasData = isDemo() && data;
    const temp = hasData ? format(data.environment?.temp_int_c, 1) : "—";
    const tempNote = !hasData ? "Esperando la primera medición." : data.environment?.temp_int_c == null ? "Sin dato de temperatura." : `Último dato recibido: ${timestamp(data.ts)}.`;
    const water = hasData ? format(data.tanks?.elevado?.level_pct) : "—";
    const battery = hasData ? format(data.groups?.battery?.voltage_v, 1) : "—";
    const batteryUnit = "V";
    const solar = hasData ? format(data.groups?.pv?.power_w) : "—";
    const alerts = getAlerts();
    const alertCount = alerts.length;
    return `${pageHeading(activeFarm()?.name || "Mi finca", "Lo esencial para cuidar el ambiente, el agua y la energía.")}
      ${isDemo() && !data.health?.connected ? `<div class="notice notice-warning">${icon("6420c")}<div><strong>Fuente de datos desconectada</strong><p>No llegan datos nuevos. El estado de los equipos debe revisarse directamente.</p></div></div>` : ""}
      <div class="dashboard-grid dashboard-top">
        <article class="temperature-card">
          <div class="card-label-row"><div class="card-label">${icon("5674c")}<span>Temperatura interior</span></div><span class="state-chip">${icon("24c68")}${hasData && data.environment?.temp_int_c != null ? "Disponible" : "Sin dato"}</span></div>
          <div class="temperature-reading"><strong>${temp}</strong><span>°C</span></div>
          <p class="temperature-description">${tempNote}</p>
          <div class="trend-inline">${icon("43ebb")}<span>Historial · ${hasData && app.simulation.history.length >= 2 ? "Mediciones disponibles" : "Aún sin mediciones"}</span></div>
          <p class="temperature-footnote">${hasData ? "Lecturas del entorno de prueba." : "Sin datos para mostrar cambios de temperatura."}</p>
        </article>
        <div class="metric-grid">
          ${metricCard("Humedad interior", "9b708", hasData ? format(data.environment?.hum_int_pct) : "—", "%", hasData ? "Última lectura" : "Sin dato")}
          ${metricCard("Temperatura exterior", "5674c", hasData ? format(data.environment?.temp_ext_c, 1) : "—", "°C", hasData ? `Exterior · Δ ${format(data.environment.temp_ext_c - data.environment.temp_int_c, 1)} °C` : "Sin dato")}
          ${metricCard("Humedad exterior", "9b708", hasData ? format(data.environment?.hum_ext_pct) : "—", "%", hasData ? "Última lectura" : "Sin dato")}
          ${metricCard("Nivel tanque elevado", "7dc3b", water, "%", hasData ? "Lectura de nivel" : "Sin dato")}
          ${metricCard("Batería", "8b830", battery, batteryUnit, hasData ? "Voltaje" : "Sin dato")}
          ${metricCard("Energía solar", "aded9", solar, "W", hasData ? "Potencia" : "Sin dato")}
        </div>
      </div>
      <section class="surface-card section-card tank-overview"><h2>Nivel de agua</h2><p class="section-subtitle">El nivel se llena según el dato disponible. Las marcas muestran los límites personalizados de llenado.</p><div class="tank-grid">${tankCard("Cisterna", "cisterna", hasData)}${tankCard("Tanque elevado", "elevado", hasData)}</div></section>
      <section class="surface-card section-card mppt-overview"><h2>Control solar y batería</h2><div class="section-grid"><p>Estado MPPT · <strong>${hasData ? mpptLabel(data.mppt?.status) : "Sin dato"}</strong></p><p>Interruptor físico de batería · <strong>${hasData ? (data.groups?.battery?.switch_on ? "Encendido" : "Apagado") : "Sin dato"}</strong></p><p>Corriente solar · <strong>${hasData ? format(data.groups?.pv?.current_a, 2) + " A" : "—"}</strong></p><p>Corriente batería · <strong>${hasData ? format(data.groups?.battery?.current_a, 2) + " A" : "—"}</strong></p></div><p class="card-footnote">La plataforma lee el estado; el interruptor de batería permanece físico.</p></section>
      <div class="dashboard-grid dashboard-lower">
        <div>
          <article class="surface-card section-card">
            <h2>Tus equipos</h2><p class="section-subtitle">${hasData ? "Estados en el entorno local de prueba." : "Su estado aún no se puede verificar."}</p>
            <div class="equipment-list">${equipmentRow("Ventiladores", "8be6d", "fans")}${equipmentRow("Bomba de llenado", "4d90f", "pump_fill")}${equipmentRow("Bomba de circulación", "4d90f", "pump_circulate")}</div>
            <p class="card-footnote">Accionamiento remoto preparado para una integración futura.</p><button class="button" type="button" data-screen="equipos">Ver área de equipos</button>
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

  function tankCard(label, id, hasData) {
    const tank = hasData ? current()?.tanks?.[id] : null;
    const setup = profileSettings().tanks[id];
    const hasContinuousLevel = Number.isFinite(tank?.level_pct);
    const level = hasContinuousLevel ? Math.min(100, Math.max(0, tank.level_pct)) : tank?.float_low ? 10 : tank?.float_high ? 90 : tank ? 50 : 0;
    const levelText = hasContinuousLevel ? `${Math.round(level)}%` : !tank ? "Sin dato" : tank.float_low ? "Mínimo" : tank.float_high ? "Máximo" : "Entre boyas";
    const floatState = !tank ? "Sin lectura de boyas" : `Boya inferior ${tank.float_low ? "activa" : "normal"} · superior ${tank.float_high ? "activa" : "normal"}`;
    const capacity = window.EcofluxFarmConfig.volumeLiters(setup);
    const fillRange = `${format(setup.min_pct)}–${format(setup.max_pct)}%`;
    const volumeLine = capacity == null ? "Configura altura y diámetro para calcular litros" : `Capacidad ${format(capacity, 0)} L · útil ${format(capacity * (setup.max_pct - setup.min_pct) / 100, 0)} L`;
    return `<article class="tank-card"><div class="tank-copy"><div class="metric-title">${icon("7dc3b")}<span>${label}</span></div><strong class="tank-level-text">${levelText}</strong><p class="metric-note">${hasContinuousLevel ? `Distancia ${format(tank.distance_cm, 1)} cm` : tank ? "Porcentaje continuo no disponible" : "Esperando lectura de nivel"}</p><p class="metric-note">${floatState}</p><p class="metric-note tank-config-meta">Límites ${fillRange} · ${volumeLine}</p></div><div class="tank-vessel ${tank && !hasContinuousLevel ? "is-range-only" : ""}" role="img" aria-label="${label}: ${levelText}; límites de llenado ${fillRange}"><span class="tank-float-marker tank-float-low ${tank?.float_low ? "is-active" : ""}" style="bottom:${setup.min_pct}%" title="Límite mínimo ${setup.min_pct}%"></span><span class="tank-float-marker tank-float-high ${tank?.float_high ? "is-active" : ""}" style="top:${100 - setup.max_pct}%" title="Límite máximo ${setup.max_pct}%"></span><div class="tank-water" style="height:${level}%"><span class="tank-wave"></span></div><span class="tank-scale tank-scale-full">${setup.max_pct}%</span><span class="tank-scale tank-scale-low">${setup.min_pct}%</span><span class="tank-scale tank-scale-empty">0%</span></div></article>`;
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
    const valueAt = (item) => ({ temp_int_c: item.environment?.temp_int_c, hum_int_pct: item.environment?.hum_int_pct, temp_ext_c: item.environment?.temp_ext_c, tank_cisterna: item.tanks?.cisterna?.level_pct, tank_elevado: item.tanks?.elevado?.level_pct, pumps_a: item.groups?.pumps?.current_a, fans_a: item.groups?.fans?.current_a, solar_w: item.groups?.pv?.power_w }[key]);
    const values = items.map(valueAt).filter((value) => value != null).slice(-30);
    return `<article class="surface-card chart-card"><div class="card-label-row"><h2>${title}</h2><span class="metric-status">${unit}</span></div><p class="chart-caption">${isDemo() ? "Datos del entorno de prueba" : "Mediciones registradas"}</p>${values.length < 2 ? `<div class="chart-empty">${icon("63857")}<span>Aún sin mediciones</span></div>` : `<svg class="chart" viewBox="0 0 600 170" role="img" aria-label="Gráfica de ${title}"><path d="M0 20 H600 M0 65 H600 M0 110 H600 M0 155 H600" stroke="#e9ede7" stroke-width="1" fill="none"/><path d="${pathFor(values)}" stroke="${color}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`}<p class="chart-meta">${values.length ? `${values.length} muestras · última ${timestamp(items.at(-1)?.ts)}` : "Fecha y hora · sin registros"}</p></article>`;
  }

  function renderHistory() {
    return `${pageHeading("Cada dato cuenta", "Consulta las mediciones que reciba tu finca. Sin registros, no hay valores que comparar.")}
      <div class="segmented" role="group" aria-label="Rango del historial"><button type="button" data-range="day" class="${app.historyRange === "day" ? "is-active" : ""}">Día</button><button type="button" data-range="week" class="${app.historyRange === "week" ? "is-active" : ""}">Semana</button></div>
      <p class="section-subtitle">${isDemo() ? `Prueba local: ${app.simulation.current?.simulation?.scenario_label}` : "Sin fechas disponibles · Aún sin registros"}</p>
      ${!isDemo() ? `<div class="notice notice-info">${icon("63857")}<div><strong>Tu historial empieza con una medición</strong><p>Las gráficas se completarán al recibir datos. Un espacio vacío no significa que el valor sea cero.</p></div></div>` : ""}
      <div class="section-grid">${chartCard("Temperatura interior", "°C", "temp_int_c")}${chartCard("Temperatura exterior", "°C", "temp_ext_c", "#805c13")}${chartCard("Cisterna", "%", "tank_cisterna")}${chartCard("Tanque elevado", "%", "tank_elevado")}${chartCard("Corriente bombas", "A", "pumps_a")}${chartCard("Corriente ventiladores", "A", "fans_a")}${chartCard("Energía solar", "W", "solar_w", "#805c13")}</div>
      <section class="info-panel" style="margin-top:20px"><h2>${icon("43ebb", "inline-icon")} Próximo paso: predicción</h2><p>La predicción queda en pausa hasta comparar configuraciones con mediciones del equipo. Primero reuniremos datos con fecha, continuidad y calidad verificadas.</p><button class="button" type="button" data-screen="tendencia">${icon("65aa1")}Ver mediciones</button></section>
      ${footer()}`;
  }

  function footer() { return `<footer class="page-footer">${icon("4749a")}<span>Acceso técnico separado · <button class="text-button" type="button" data-screen="diagnostico">Diagnóstico</button></span></footer>`; }

  function alertCard(alert, sample = false) {
    const levelLabel = { critical: "Crítico · Atención necesaria", warning: "Aviso · Revisar sistema", info: "Información" }[alert.level];
    const levelIcon = { critical: "9e2c0", warning: "3e417", info: "3e417" }[alert.level];
    return `<article class="surface-card alert-card is-${alert.level}"><div class="alert-card-top"><span class="alert-pill is-${alert.level}">${icon(levelIcon)}${levelLabel}</span>${sample ? `<span class="example-label">EJEMPLO DE AVISO</span>` : ""}</div><h3>${alert.title}</h3><p>${sample ? "Ejemplo · " : ""}${alert.body}</p><div class="alert-action is-${alert.level}"><strong>QUÉ HACER</strong>${alert.action}</div></article>`;
  }

  function renderAlerts() {
    const alerts = getAlerts();
    const samples = [
      { level: "critical", title: "Temperatura fuera del límite", body: "En este ejemplo se recibe una señal de temperatura fuera del límite configurado.", action: "Si ocurre, revisa el ambiente en persona. Si hay peligro, usa la parada física del equipo y pide apoyo técnico." },
      { level: "warning", title: "Nivel de agua por revisar", body: "El nivel de agua está bajo y requiere una revisión segura.", action: "Comprueba el depósito de forma segura. No manipules la bomba ni las conexiones si no sabes cómo hacerlo." },
      { level: "info", title: "Sensor en calibración", body: "El sensor aún no entrega un dato utilizable.", action: "Espera una medición válida. Si la situación continúa, consulta a la persona responsable del equipo." },
    ];
    return `${pageHeading("Avisos claros, pasos seguros", "Distingue lo que requiere atención y qué puedes hacer.")}
      <article class="surface-card section-card" style="margin-bottom:22px"><div class="card-label-row"><span class="eyebrow">FUENTE DE DATOS · ${isDemo() ? "PRUEBA LOCAL" : "SIN TELEMETRÍA"}</span><span class="state-chip">${alerts.length ? `${alerts.length} aviso${alerts.length === 1 ? "" : "s"}` : "Sin información"}</span></div><div class="alert-empty"><strong>${alerts.length ? "Avisos detectados" : "Aún no hay avisos recibidos"}</strong><p>${alerts.length ? (isDemo() ? "Estos avisos corresponden a la condición que estás probando." : "Avisos recibidos del equipo conectado.") : "Sin mediciones no podemos confirmar si hay avisos pendientes. Esto no confirma que todo funcione."}</p></div></article>
      <div class="dashboard-grid"><div><h2>Ejemplos de alertas</h2><p class="section-subtitle">Guía de prioridad y pasos seguros; no son avisos activos.</p><div class="alert-list">${(alerts.length ? alerts : samples).map((item) => alertCard(item, !alerts.length)).join("")}</div></div><aside><section class="info-panel"><h2>Primero, tu seguridad</h2><p>El icono y la palabra indican la prioridad. El color solo acompaña.</p><p>🔴 Crítico: requiere atención.</p><p>🟠 Aviso: revisa el sistema.</p><p>🔵 Información: conoce el contexto.</p></section><section class="surface-card section-card" style="margin-top:16px"><h2>${icon("81ca0", "inline-icon")} AIRA te lo explica</h2><p class="section-subtitle">Puede ayudarte a entender un aviso. No manda instrucciones a los equipos.</p><button class="button" type="button" data-screen="aira">${icon("65aa1")}Consultar a AIRA</button></section></aside></div>${footer()}`;
  }

  function renderTrend() {
    const items = app.simulation?.history || [];
    const values = items.map((item) => item.environment?.temp_int_c).filter(Number.isFinite).slice(-30);
    return `${pageHeading("Tendencias observadas", "Consulta los cambios registrados antes de activar predicciones.")}
      <p><button class="text-button" type="button" data-screen="historial">← &nbsp;Historial</button></p>
      <article class="surface-card chart-card"><div class="card-label-row"><h2>Temperatura interior</h2><span class="metric-status">°C</span></div><p class="chart-caption">Mediciones registradas</p>${values.length < 2 ? `<div class="chart-empty">${icon("63857")}<span>Aún sin mediciones</span></div>` : `<svg class="chart" viewBox="0 0 600 170" role="img" aria-label="Temperatura observada"><path d="M0 20 H600 M0 65 H600 M0 110 H600 M0 155 H600" stroke="#e9ede7" fill="none"/><path d="${pathFor(values)}" stroke="#12676d" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`}<p class="chart-meta">${values.length ? `${values.length} muestras · última ${timestamp(items.at(-1)?.ts)}` : "Fecha y hora · sin registros"}</p></article>
      <div class="notice notice-info" style="margin-top:20px">${icon("3e417")}<div><strong>Predicción en preparación</strong><p>Queda en pausa hasta comparar varias configuraciones con mediciones del equipo y validar su precisión.</p></div></div>
      <div class="section-grid"><article class="surface-card section-card"><h2>Calidad de mediciones</h2><p class="section-subtitle">Antes de estimar se revisará fecha, continuidad, sensores y condiciones de uso.</p><p class="metric-note">Temperatura más reciente · ${values.length ? `${format(values.at(-1), 1)} °C` : "Sin dato"}</p><p class="metric-note">Muestras visibles · ${values.length}</p></article><article class="info-panel"><h2>Sin adelantar conclusiones</h2><p>Horizonte · Pendiente de definir</p><p>Configuración · En evaluación</p><p>Esta pantalla muestra lecturas; no pronostica ni activa equipos.</p></article></div>${footer()}`;
  }
  function makeAiraReply(question) {
    const q = question.toLowerCase();
    const data = current();
    if (!isDemo() || !data) return "Todavía no tengo mediciones del equipo. No puedo confirmar su temperatura, el nivel de agua ni el estado de las cargas.";
    if (q.includes("temperatura") || q.includes("calor")) return data.environment?.temp_int_c == null ? "No tengo una lectura válida de temperatura." : `La temperatura disponible es ${format(data.environment.temp_int_c, 1)} °C. Esta respuesta usa el entorno local de prueba.`;
    if (q.includes("agua") || q.includes("tanque")) return data.tanks?.elevado?.level_pct == null ? "No hay porcentaje continuo del tanque. Puedo consultar el estado de las boyas cuando estén conectadas." : `El tanque elevado indica ${format(data.tanks.elevado.level_pct)}% y la cisterna ${format(data.tanks.cisterna.level_pct)}%. Estos valores vienen del entorno local de prueba.`;
    if (q.includes("batería") || q.includes("energia") || q.includes("energía") || q.includes("solar")) return `En la prueba, la batería indica ${format(data.groups?.battery?.voltage_v, 1)} V y el panel ${format(data.groups?.pv?.power_w)} W. Todavía no son lecturas de la maqueta física.`;
    if (q.includes("alerta")) { const alerts = getAlerts(); return alerts.length ? `La prueba muestra ${alerts.length} aviso${alerts.length === 1 ? "" : "s"}: ${alerts.map((a) => a.title).join("; ")}.` : "La prueba no muestra avisos. Sin conexión con la maqueta no puedo confirmar su estado real."; }
    if (q.includes("bomba") || q.includes("encend")) return `En esta prueba, la bomba de circulación aparece ${data.loads.pump_circulate.on ? "encendida" : "apagada"}.`;
    return "Puedo consultar temperatura, agua, energía, estado de bombas y avisos. La predicción queda en pausa mientras se comparan configuraciones.";
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
    const suggestions = ["¿Cómo está la temperatura?", "¿Cuánta agua queda?", "¿Qué avisos hay?"];
    const status = isOnline() ? "Lecturas locales disponibles" : "Esperando lecturas del equipo";
    return `${pageHeading("Hablemos de tu finca", "Una ayuda cercana para preguntar y decidir con calma.")}
      <div class="assistant-layout"><section class="surface-card chat-card"><h2>${icon("81ca0", "inline-icon")} AIRA</h2><p class="card-footnote">Tu guía, paso a paso</p><div class="chat-message is-assistant"><strong>Hola, soy AIRA. Puedo ayudarte a entender ECOFLUX.</strong><br>Escribe o presiona “Hablar” para dictar. La voz es generada por IA.</div><div class="aira-status" id="aira-status" role="status">${app.aiStatus === "checking" ? "Revisando conectores…" : escapeHtml(app.aiStatus)}</div><div class="suggestion-list">${suggestions.map((q) => `<button class="suggestion-button" type="button" data-question="${q}">◯ &nbsp;${q}</button>`).join("")}</div><div id="chat-log">${app.chat.map((item) => `<div class="chat-message ${item.role === "user" ? "is-user" : "is-assistant"}"><strong>${item.role === "user" ? "Tú" : "AIRA"}</strong><br>${escapeHtml(item.text)}</div>`).join("")}</div><form class="chat-form" id="chat-form"><input id="chat-input" autocomplete="off" aria-label="Escribe tu pregunta" placeholder="Escribe tu pregunta…" /><button class="button" type="button" id="voice-button" aria-label="Grabar pregunta y escuchar respuesta">${icon("81ca0")}<span>Hablar</span></button><button class="button button-primary" type="submit">Enviar</button></form><button class="text-button voice-output-button" type="button" id="voice-output-button">Escuchar última respuesta</button><p class="chat-disclaimer">Claude responde usando el contexto disponible. OpenAI procesa la transcripción y genera audio; si falta la clave o el servicio, puedes continuar escribiendo. Las predicciones siguen en evaluación y no se inventan.</p></section>
      <aside><section class="info-panel"><h2>AIRA te acompaña, no decide por ti</h2><p>Explica datos y avisos. No envía instrucciones a los equipos.</p></section><section class="surface-card section-card" style="margin-top:14px"><span class="eyebrow">${status}</span><h2 style="margin-top:12px">${isOnline() ? "Datos disponibles" : "Esperando conexión"}</h2><p class="section-subtitle">${isOnline() ? "Puedes explorar el entorno local de prueba." : "No hay lecturas del equipo. El tablero quedará listo para recibirlas."}</p><button class="button" type="button" data-screen="diagnostico">Abrir diagnóstico</button></section><section class="info-panel" style="margin-top:14px"><h2>Si hay un riesgo, no esperes al chat</h2><p>Busca ayuda en el lugar. Si es necesario, usa la parada física del equipo y contacta a la persona responsable.</p></section></aside></div>${footer()}`;
  }

  function renderEquipment() {
    const data = current();
    const equipments = [
      { key: "fans", title: "Ventiladores", icon: "8be6d", desc: "Renovación de aire del espacio" },
      { key: "pump_fill", title: "Bomba de llenado", icon: "4d90f", desc: "Abastecimiento de tanque" },
      { key: "pump_circulate", title: "Bomba de circulación", icon: "4d90f", desc: "Circulación de agua" },
    ];
    return `${pageHeading("Bombas y ventiladores", "Vista de equipos y preparación para el futuro control desde ECOFLUX.")}
      <div class="notice notice-warning">${icon("3e417")}<div><strong>Control remoto todavía no habilitado</strong><p>Los controles se activarán después de integrar y validar la ESP32, las protecciones, los interbloqueos y la confirmación de cada orden. Por ahora esta pantalla solo presenta estados.</p></div></div>
      <div class="equipment-control-grid">${equipments.map((item) => {
        const device = data?.loads?.[item.key];
        const state = isDemo() && device ? (device.on ? "Encendido" : "Apagado") : "Sin dato";
        return `<article class="surface-card equipment-control-card"><div class="equipment-control-head">${icon(item.icon)}<div><h2>${item.title}</h2><p>${item.desc}</p></div><span class="equipment-state-badge ${device && isDemo() ? (device.on ? "is-on" : "is-off") : "is-unknown"}"><i></i>${state}</span></div><div class="equipment-reading"><span>Corriente</span><strong>${isDemo() && device?.current_a != null ? `${format(device.current_a, 2)} A` : "Sin dato"}</strong></div><div class="equipment-actions"><button class="button" type="button" disabled title="Se habilitará al integrar la ESP32">Encender</button><button class="button" type="button" disabled title="Se habilitará al integrar la ESP32">Apagar</button></div><p class="card-footnote">${isDemo() ? "Estado del entorno local de prueba; no representa una acción física." : "Esperando telemetría de la ESP32."}</p></article>`;
      }).join("")}</div>
      <section class="info-panel equipment-safety"><h2>Reglas para la futura integración</h2><ul><li>La lógica de seguridad local tiene prioridad frente a la aplicación.</li><li>Una orden necesitará confirmación, estado de respuesta y registro.</li><li>Si no hay conexión, la interfaz no asumirá que el equipo cambió de estado.</li></ul></section>${footer()}`;
  }

  function renderTests() {
    const scenarios = app.simulation?.scenarios || {};
    const active = Boolean(app.simulation?.running);
    return `${pageHeading("Pruebas locales", "Explora situaciones de funcionamiento antes de conectar la ESP32.", "ENTORNO LOCAL · DATOS NO FÍSICOS")}
      <div class="notice notice-info"><div><strong>Estas condiciones son escenarios de prueba</strong><p>Sirven para revisar gráficos, alertas e interacción. No son mediciones reales y no accionan bombas ni ventiladores.</p></div></div>
      <section class="surface-card section-card"><h2>Condiciones de prueba</h2><p class="section-subtitle">Selecciona una condición y activa la prueba para generar lecturas locales en el tablero.</p><div class="sim-controls"><label for="scenario-select">Condición a revisar<select id="scenario-select">${Object.entries(scenarios).map(([key, label]) => `<option value="${key}" ${app.simulation?.scenario === key ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}</select></label><div class="sim-toggle"><span>${active ? "Prueba local activa" : "Prueba local detenida"}</span><button class="switch" id="sim-toggle" type="button" role="switch" aria-checked="${active}" aria-label="Activar prueba local"></button></div><button class="button button-primary" type="button" id="sim-start">${active ? "Reiniciar prueba" : "Iniciar prueba local"}</button></div></section>
      <section class="surface-card section-card" style="margin-top:16px"><h2>Umbral térmico de prueba</h2><p class="section-subtitle">Permite observar cómo responde la interfaz a una consigna. No modifica el LM358 ni el potenciómetro analógico.</p><form class="threshold-form" id="threshold-form"><label for="threshold-input">Temperatura objetivo (20–40 °C)<input id="threshold-input" type="number" min="20" max="40" step="0.5" value="${app.simulation?.thresholdC ?? 30}" required /></label><button class="button button-primary" type="submit">Guardar ajuste de prueba</button></form><p class="card-footnote">El sistema vuelve a la condición seleccionada al cambiar de finca; así no se mezclan las pruebas entre espacios.</p></section>${footer()}`;
  }

  function renderTankSettings(id, label) {
    const tank = profileSettings().tanks[id];
    const total = window.EcofluxFarmConfig.volumeLiters(tank);
    const minVolume = total == null ? null : total * tank.min_pct / 100;
    const maxVolume = total == null ? null : total * tank.max_pct / 100;
    const usable = total == null ? null : maxVolume - minVolume;
    const summary = total == null ? "Ingresa altura y diámetro para calcular la capacidad." : `Total ${format(total, 1)} L · mínimo ${format(minVolume, 1)} L · máximo ${format(maxVolume, 1)} L · volumen operativo ${format(usable, 1)} L`;
    return `<fieldset class="tank-setup-card"><legend>${label}</legend><div class="technical-fields"><label>Altura total (cm)<input type="number" min="1" step="0.1" name="tank.${id}.height_cm" value="${escapeHtml(tank.height_cm)}" placeholder="Ej. 120" /></label><label>Diámetro interno (cm)<input type="number" min="1" step="0.1" name="tank.${id}.diameter_cm" value="${escapeHtml(tank.diameter_cm)}" placeholder="Ej. 80" /></label><label>Límite mínimo (%)<input type="number" min="0" max="99" step="1" name="tank.${id}.min_pct" value="${tank.min_pct}" required /></label><label>Límite máximo (%)<input type="number" min="1" max="100" step="1" name="tank.${id}.max_pct" value="${tank.max_pct}" required /></label></div><p class="tank-capacity-summary">${summary}</p></fieldset>`;
  }

  function renderConfiguration() {
    const profile = selectedProfile();
    const savedSensors = profileSettings().sensors;
    const sensorTypes = ["Sensor NTC", "Sensor de temperatura", "Sensor de humedad", "Boya de nivel", "Sensor de distancia", "Sensor de corriente", "Interfaz MPPT", "Otro / por definir"];
    return `${pageHeading("Configuración técnica", "Ajusta tanques y sensores para el perfil seleccionado.", `PERFIL ${profile.label.toLocaleUpperCase("es-EC")} · CONFIGURACIÓN LOCAL`)}
      <div class="notice notice-info">${icon("141f0")}<div><strong>Plantilla precargada para ${profile.label.toLocaleLowerCase("es-EC")}</strong><p>${profile.note} Los valores iniciales son una base editable; valida sensores, rangos y umbrales con el equipo técnico y las condiciones reales.</p></div></div>
      <form id="technical-config-form"><section class="surface-card section-card technical-section"><h2>Tanques cilíndricos</h2><p class="section-subtitle">La capacidad se calcula con la altura y el diámetro interno. Los límites mínimo y máximo determinan el volumen operativo.</p><div class="tank-setup-grid">${renderTankSettings("cisterna", "Cisterna")}${renderTankSettings("elevado", "Tanque elevado")}</div><p class="card-footnote">Fórmula: π × (diámetro interno ÷ 2)² × altura. Resultado en litros. La capacidad útil corresponde al rango entre los límites mínimo y máximo. Con boyas binarias solamente, no se inventa un porcentaje continuo.</p></section>
      <section class="surface-card section-card technical-section"><h2>Sensores de este perfil</h2><p class="section-subtitle">Configura tipo, ubicación, unidad, corrección de calibración y límites de referencia para cada medición.</p><div class="sensor-config-grid">${profile.sensors.map(([id]) => {
        const sensor = savedSensors[id];
        return `<fieldset class="sensor-config-card"><legend>${escapeHtml(sensor.name)}</legend><div class="technical-fields"><label>Tipo de sensor<input name="sensor.${id}.type" list="sensor-type-options" value="${escapeHtml(sensor.type)}" /></label><label>Ubicación<input name="sensor.${id}.location" value="${escapeHtml(sensor.location)}" /></label><label>Unidad<input name="sensor.${id}.unit" value="${escapeHtml(sensor.unit)}" /></label><label>Corrección / offset<input type="number" step="0.1" name="sensor.${id}.offset" value="${sensor.offset}" /></label><label>Límite mínimo<input type="number" step="0.1" name="sensor.${id}.min" value="${sensor.min}" /></label><label>Límite máximo<input type="number" step="0.1" name="sensor.${id}.max" value="${sensor.max}" /></label></div><label class="sensor-enabled"><input type="checkbox" name="sensor.${id}.enabled" ${sensor.enabled ? "checked" : ""} /> Incluir en este perfil</label></fieldset>`;
      }).join("")}</div><datalist id="sensor-type-options">${sensorTypes.map((type) => `<option value="${type}"></option>`).join("")}</datalist><div class="technical-form-actions"><button class="button button-primary" type="submit">Guardar configuración</button><button class="button" type="button" data-screen="equipos">Ir a bombas y ventiladores</button></div></section></form>
      <div class="diagnostic-callout"><strong>Importante</strong><p>Los umbrales de sectores pecuarios son editables y aún no están validados como recomendaciones productivas. La configuración se guarda en este navegador y no se transmite a la electrónica.</p></div>${footer()}`;
  }

  function renderDiagnosis() {
    const data = current();
    const profileSensors = selectedProfile().sensors;
    const values = profileSensors.map(([id, name, , location, unit]) => {
      let value = configuredSensorValue(data, id, profileSettings().sensors[id]);
      if (id === "cisterna") value = data?.tanks?.cisterna?.level_pct;
      if (id === "tanque" || id === "agua") value = data?.tanks?.elevado?.level_pct ?? data?.tanks?.cisterna?.level_pct;
      const settings = profileSettings().sensors[id];
      const outOfRange = Number.isFinite(value) && (value < settings.min || value > settings.max);
      const status = !isDemo() ? "Sin telemetría" : data?.health?.sensor_lost && id.startsWith("temp") ? "Falla reportada" : value == null ? "Sin lectura" : outOfRange ? "Fuera de rango" : "Disponible · prueba local";
      const shown = value == null ? "—" : `${format(value, unit === "°C" || unit === "A" ? 1 : 0)} ${unit}`;
      return `<div class="diagnostic-row"><div><strong>${escapeHtml(name)}</strong><span>${escapeHtml(location)} · ${escapeHtml(settings.type)}</span></div><span class="state-chip">${shown}</span><span class="diagnostic-status ${outOfRange ? "is-warning" : ""}">${status}</span></div>`;
    }).join("");
    const loads = [
      ["Ventiladores", data?.loads?.fans, data?.groups?.fans?.current_a],
      ["Bomba de llenado", data?.loads?.pump_fill, data?.groups?.pumps?.pumps?.fill],
      ["Bomba de circulación", data?.loads?.pump_circulate, data?.groups?.pumps?.pumps?.circulate],
    ];
    const loadRows = loads.map(([name, state, currentA]) => `<div class="diagnostic-row"><div><strong>${name}</strong><span>${state ? state.on ? "Señal reportada como activa" : "Señal reportada como apagada" : "Estado no disponible"}</span></div><span class="state-chip">${isDemo() && currentA != null ? `${format(currentA, 2)} A` : "Sin dato"}</span></div>`).join("");
    const alerts = getAlerts(data);
    const eventContent = !isDemo() ? "Aún no hay telemetría para identificar eventos." : alerts.length ? alerts.map((alert) => `<div class="diagnostic-event"><strong>${escapeHtml(alert.title)}</strong><span>${escapeHtml(alert.body)}</span><small>Estado observado · ${timestamp(data.ts)}</small></div>`).join("") : `<div class="diagnostic-callout"><strong>Sin anomalías detectadas en el estado actual</strong><p>La lectura pertenece a la prueba local y no confirma el estado físico de la maqueta.</p></div>`;
    const transport = isDemo() ? "Datos locales del simulador" : "ESP32 sin telemetría";
    return `${pageHeading("Diagnóstico técnico", "Revisa señales, sensores y condiciones que requieren verificación.", "HERRAMIENTA DE REVISIÓN TÉCNICA")}
      <div class="diagnostic-grid"><section class="surface-card section-card"><h2>Conexión y recepción</h2><div class="diagnostic-list"><div class="diagnostic-row"><div><strong>Origen de datos</strong><span>${transport}</span></div><span class="diagnostic-status">${isDemo() ? "LOCAL" : "PENDIENTE"}</span></div><div class="diagnostic-row"><div><strong>ESP32</strong><span>${isDemo() ? "El simulador está activo; hardware no verificado" : "Pendiente de integración"}</span></div><span class="diagnostic-status">${isDemo() ? "SIMULADOR" : "SIN DATO"}</span></div><div class="diagnostic-row"><div><strong>Wi‑Fi / MQTT</strong><span>Conectividad física aún no comprobada</span></div><span class="diagnostic-status">Sin dato</span></div><div class="diagnostic-row"><div><strong>Último paquete disponible</strong><span>${data ? timestamp(data.ts) : "Sin paquete recibido"}</span></div><span class="diagnostic-status">${data ? "LOCAL" : "—"}</span></div></div></section>
      <section class="surface-card section-card"><h2>Lecturas de sensores del perfil</h2><p class="section-subtitle">Valor, ubicación configurada y validez observada. La calibración física requiere comprobación en sitio.</p><div class="diagnostic-list">${values}</div></section>
      <section class="surface-card section-card"><h2>Corriente y señales de equipos</h2><p class="section-subtitle">Las señales de esta vista no habilitan control remoto.</p><div class="diagnostic-list">${loadRows}</div><div class="diagnostic-callout"><strong>Controles físicos conservados</strong><p>Las protecciones, interbloqueos y órdenes siguen en la electrónica local.</p></div></section>
      <section class="surface-card section-card"><h2>Hallazgos del estado actual</h2><p class="section-subtitle">Avisos derivados de la lectura más reciente; no es un historial persistente de fallos.</p>${eventContent}</section></div>${footer()}`;
  }
  function render() {
    if (!activeFarm() && app.screen !== "fincas") app.screen = "fincas";
    applyProfile();
    syncHeader();
    $$("[data-screen]").forEach((button) => button.classList.toggle("is-active", button.dataset.screen === app.screen));
    $$("[data-screen-link]").forEach((button) => button.classList.toggle("is-active", button.dataset.screenLink === app.screen));
    const renderer = { fincas: renderFarms, inicio: renderHome, historial: renderHistory, alertas: renderAlerts, tendencia: renderTrend, aira: renderAira, equipos: renderEquipment, pruebas: renderTests, configuracion: renderConfiguration, diagnostico: renderDiagnosis }[app.screen] || renderFarms;
    content.innerHTML = renderer();
    const count = getAlerts().length;
    const countNode = $("#nav-alert-count");
    countNode.textContent = String(count);
    countNode.hidden = !count;
    bindPageEvents();
  }

  function go(screen) {
    if (!["fincas", "inicio", "historial", "alertas", "tendencia", "aira", "equipos", "pruebas", "configuracion", "diagnostico"].includes(screen)) return;
    if (screen !== "fincas" && !activeFarm()) { app.screen = "fincas"; render(); toast("Crea o selecciona una finca para continuar."); return; }
    app.screen = screen;
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function askAira(question, { voice = false } = {}) {
    appendChat("user", question);
    const replyIndex = app.chat.length;
    app.chat.push({ role: "assistant", text: "AIRA está revisando la información disponible…" });
    if (app.screen === "aira") render();
    let reply;
    try {
      const messages = app.chat.slice(0, replyIndex).map((item) => ({ role: item.role, content: item.text }));
      const data = current();
      const history = data?.environment?.temp_int_c == null ? [] : [{ temp_int_c: data.environment.temp_int_c, ts: data.ts }];
      const predictionTools = window.EcofluxPredictionTools;
      const toolResults = predictionTools ? { forecast_temp: predictionTools.forecast_temp(30, history), battery_autonomy: predictionTools.battery_autonomy([]), check_anomalies: predictionTools.check_anomalies(data?.groups?.pumps ? { pumps: data.groups.pumps } : null) } : {};
      const response = await fetch(`${AIRA_API}/aira`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages, state: { readings: data, prediction_tools: toolResults } }), signal: AbortSignal.timeout(50_000) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Conector AIRA no disponible.");
      reply = payload.reply;
    } catch { reply = makeAiraReply(question); }
    app.chat[replyIndex].text = reply;
    if (app.screen === "aira") render();
    if (voice) speakText(reply);
  }

  async function speakText(text) {
    try {
      const response = await fetch(`${AIRA_API}/voice/speak`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }), signal: AbortSignal.timeout(65_000) });
      if (!response.ok) { const detail = await response.json().catch(() => ({})); throw new Error(detail.error || "Voz OpenAI no disponible."); }
      const blob = await response.blob();
      if (app.voiceAudioUrl) URL.revokeObjectURL(app.voiceAudioUrl);
      app.voiceAudioUrl = URL.createObjectURL(blob);
      await new Audio(app.voiceAudioUrl).play();
    } catch (error) { toast(`${error.message || "No se pudo generar la voz."} Puedes leer la respuesta en pantalla.`); }
  }

  function bindPageEvents() {
    $$('[data-screen]', content).forEach((button) => button.addEventListener("click", () => go(button.dataset.screen)));
    $$("[data-range]", content).forEach((button) => button.addEventListener("click", () => { app.historyRange = button.dataset.range; render(); }));
    $$("[data-question]", content).forEach((button) => button.addEventListener("click", () => askAira(button.dataset.question)));
    const form = $("#chat-form", content);
    form?.addEventListener("submit", (event) => { event.preventDefault(); const input = $("#chat-input", form); const value = input.value.trim(); if (!value) return; input.value = ""; askAira(value); });
    $("#scenario-select", content)?.addEventListener("change", (event) => { window.EcofluxSimulator.setScenario(event.target.value); toast("Condición seleccionada. Inicia la prueba local para verla."); });
    $("#sim-toggle", content)?.addEventListener("click", () => { if (app.simulation.running) window.EcofluxSimulator.stop(); else window.EcofluxSimulator.start(app.simulation.scenario); });
    $("#sim-start", content)?.addEventListener("click", () => window.EcofluxSimulator.start(app.simulation.scenario));
    $("#threshold-form", content)?.addEventListener("submit", (event) => { event.preventDefault(); const input = $("#threshold-input", content); const value = Number(input.value); if (value < 20 || value > 40) { toast("El umbral debe estar entre 20 y 40 °C."); return; } window.EcofluxSimulator.setThreshold(value); toast("Ajuste actualizado en la prueba local."); });
    $("#voice-button", content)?.addEventListener("click", toggleVoiceRecording);
    $("#voice-output-button", content)?.addEventListener("click", () => { const last = [...app.chat].reverse().find((item) => item.role === "assistant"); if (last) speakText(last.text); else toast("AIRA aún no ha respondido."); });
    $("#technical-config-form", content)?.addEventListener("submit", saveTechnicalConfiguration);
    $("#create-farm-form", content)?.addEventListener("submit", createFarmFromForm);
  }

  function createFarmFromForm(event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const name = String(values.get("name") || "").trim().slice(0, 40);
    const type = String(values.get("type") || "");
    if (!name || !farmProfiles[type]) { toast("Escribe un nombre y selecciona un tipo de finca."); return; }
    const id = globalThis.crypto?.randomUUID?.() || `farm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const configuration = JSON.parse(JSON.stringify(app.settings.profiles[type]));
    window.EcofluxSimulator.reset();
    app.settings.farms.push({ id, name, type, configuration });
    app.settings.activeFarmId = id;
    app.settings.profile = type;
    saveSettings();
    app.screen = "inicio";
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast(`${name} está lista. Personaliza los sensores y tanques en Configuración técnica.`);
  }

  function openFarm(id) {
    const farm = app.settings.farms.find((item) => item.id === id);
    if (!farm) return;
    window.EcofluxSimulator.reset();
    app.settings.activeFarmId = id;
    app.settings.profile = farm.type;
    app.screen = "inicio";
    saveSettings();
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function saveTechnicalConfiguration(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const config = profileSettings();
    for (const id of ["cisterna", "elevado"]) {
      const height = values.get(`tank.${id}.height_cm`);
      const diameter = values.get(`tank.${id}.diameter_cm`);
      const min = Number(values.get(`tank.${id}.min_pct`));
      const max = Number(values.get(`tank.${id}.max_pct`));
      if ((height && !(Number(height) > 0)) || (diameter && !(Number(diameter) > 0)) || Boolean(height) !== Boolean(diameter)) { toast("Para calcular el tanque, ingresa altura y diámetro interno positivos."); return; }
      if (!(min >= 0 && min < max && max <= 100)) { toast("En cada tanque, el mínimo debe ser menor que el máximo (0–100%)."); return; }
      config.tanks[id] = { height_cm: height || "", diameter_cm: diameter || "", min_pct: min, max_pct: max };
    }
    for (const [id] of selectedProfile().sensors) {
      const min = Number(values.get(`sensor.${id}.min`));
      const max = Number(values.get(`sensor.${id}.max`));
      if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) { toast("Revisa los límites: el mínimo debe ser menor que el máximo en cada sensor."); return; }
      config.sensors[id] = { ...config.sensors[id], type: String(values.get(`sensor.${id}.type`) || "Por definir").trim(), location: String(values.get(`sensor.${id}.location`) || "").trim(), unit: String(values.get(`sensor.${id}.unit`) || "").trim(), offset: Number(values.get(`sensor.${id}.offset`)) || 0, min, max, enabled: values.has(`sensor.${id}.enabled`) };
    }
    saveSettings();
    render();
    toast("Configuración guardada en este dispositivo.");
  }

  async function toggleVoiceRecording() {
    const button = $("#voice-button", content);
    if (app.voiceRecorder?.state === "recording") { app.voiceRecorder.stop(); if (button?.querySelector("span")) button.querySelector("span").textContent = "Procesando…"; return; }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { toast("Este navegador no permite grabar aquí. Escribe tu consulta."); return; }
    try {
      app.voiceStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
      app.voiceRecorder = mimeType ? new MediaRecorder(app.voiceStream, { mimeType }) : new MediaRecorder(app.voiceStream);
      app.voiceChunks = [];
      app.voiceRecorder.ondataavailable = (event) => { if (event.data.size) app.voiceChunks.push(event.data); };
      app.voiceRecorder.onstop = async () => {
        const recording = new Blob(app.voiceChunks, { type: app.voiceRecorder.mimeType || "audio/webm" });
        app.voiceStream?.getTracks().forEach((track) => track.stop()); app.voiceStream = null; app.voiceRecorder = null;
        try {
          const bytes = new Uint8Array(await recording.arrayBuffer());
          let binary = "";
          for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
          const response = await fetch(`${AIRA_API}/voice/transcribe`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ audio_base64: btoa(binary), mime_type: recording.type }), signal: AbortSignal.timeout(65_000) });
          const result = await response.json();
          if (!response.ok || !result.text?.trim()) throw new Error(result.error || "No se entendió el audio.");
          askAira(result.text.trim(), { voice: true });
        } catch (error) { toast(`${error.message || "No se pudo transcribir."} Puedes escribir tu consulta.`); }
        finally { const activeButton = $("#voice-button", content); if (activeButton?.querySelector("span")) activeButton.querySelector("span").textContent = "Hablar"; }
      };
      app.voiceRecorder.start();
      if (button?.querySelector("span")) button.querySelector("span").textContent = "Terminar";
      toast("Te escucho. Pulsa “Terminar” cuando acabes.");
    } catch {
      app.voiceStream?.getTracks().forEach((track) => track.stop()); app.voiceStream = null;
      toast("No se pudo iniciar el micrófono. Escribe tu consulta.");
    }
  }

  document.addEventListener("click", (event) => {
    const nav = event.target.closest("[data-screen]");
    if (nav && !content.contains(nav)) go(nav.dataset.screen);
    const link = event.target.closest("[data-screen-link]");
    if (link) { event.preventDefault(); go(link.dataset.screenLink); }
    if (event.target.closest("#sidebar-collapse")) {
      app.settings.collapsed = !app.settings.collapsed;
      saveSettings(); applyProfile();
    }
    const openFarmButton = event.target.closest("[data-open-farm]");
    if (openFarmButton) openFarm(openFarmButton.dataset.openFarm);
    if (event.target.closest("#edit-farm")) {
      const name = window.prompt("¿Cómo se llama tu finca?", $("#farm-name-top").textContent);
      if (name !== null) setFarmName(name);
    }
  });

  applyProfile();
  checkAiraConnection();
  window.EcofluxSimulator.subscribe((snapshot) => {
    app.simulation = { ...snapshot, farmId: activeFarm()?.id || null };
    // The simulator emits every few seconds and when a scenario is selected.
    // Re-rendering this form would replace the user's in-progress name/type.
    if (app.screen === "fincas") return;
    if (app.screen === "aira" && document.activeElement?.id === "chat-input") {
      syncHeader();
      return;
    }
    if (app.screen) render();
  });
  render();
})();
