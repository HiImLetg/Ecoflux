(() => {
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const scenarios = {
    normal: { label: "Día normal", temp: 28.4, outside: 30.2, humidity: 67, outsideHumidity: 61, tanks: { cisterna: 74, elevado: 83 }, battery: 12.6, solar: 86, fans: false, pumpFill: false, pumpCirculate: false },
    heat: { label: "Ola de calor", temp: 34.2, outside: 37.1, humidity: 71, outsideHumidity: 48, tanks: { cisterna: 62, elevado: 70 }, battery: 12.2, solar: 124, fans: true, pumpFill: false, pumpCirculate: true },
    tank: { label: "Tanque bajo", temp: 31.1, outside: 33.4, humidity: 66, outsideHumidity: 55, tanks: { cisterna: 58, elevado: 14 }, battery: 12.1, solar: 103, fans: true, pumpFill: false, pumpCirculate: false },
    dryPump: { label: "Bomba sin agua", temp: 30.6, outside: 32.2, humidity: 64, outsideHumidity: 58, tanks: { cisterna: 8, elevado: 36 }, battery: 12.0, solar: 97, fans: false, pumpFill: false, pumpCirculate: true },
    sensor: { label: "Falla de sensor", temp: null, outside: 31.7, humidity: 65, outsideHumidity: 57, tanks: { cisterna: 55, elevado: 68 }, battery: 12.4, solar: 91, fans: false, pumpFill: false, pumpCirculate: false },
    offline: { label: "Pérdida de conexión", temp: 32.8, outside: 35.1, humidity: 70, outsideHumidity: 51, tanks: { cisterna: 50, elevado: 61 }, battery: 11.9, solar: 77, fans: true, pumpFill: false, pumpCirculate: true },
    cycling: { label: "Conmutación rápida", temp: 30.1, outside: 32.3, humidity: 68, outsideHumidity: 56, tanks: { cisterna: 63, elevado: 75 }, battery: 12.3, solar: 88, fans: true, pumpFill: false, pumpCirculate: false },
  };
  scenarios.mpptOff = { ...scenarios.normal, label: "MPPT apagado" };

  class EcofluxSimulator {
    constructor() {
      this.running = false;
      this.scenario = "normal";
      this.sequence = 0;
      this.history = [];
      this.listeners = new Set();
      this.timer = null;
      this.current = null;
      this.thresholdC = 30;
    }

    subscribe(listener) { this.listeners.add(listener); listener(this.snapshot()); return () => this.listeners.delete(listener); }
    start(scenario = this.scenario) {
      this.scenario = scenarios[scenario] ? scenario : "normal";
      if (!this.running) { this.running = true; this.tick(); this.timer = window.setInterval(() => this.tick(), 5000); }
      else this.tick();
    }
    stop() { this.running = false; if (this.timer) window.clearInterval(this.timer); this.timer = null; this.emit(); }
    reset() { this.stop(); this.scenario = "normal"; this.sequence = 0; this.history = []; this.current = null; this.thresholdC = 30; this.emit(); }
    setScenario(scenario) { if (!scenarios[scenario]) return; this.scenario = scenario; if (this.running) this.tick(); else this.emit(); }
    setThreshold(value) { const number = Number(value); if (!Number.isFinite(number)) return; this.thresholdC = clamp(number, 20, 40); if (this.running) this.tick(); else this.emit(); }

    tick() {
      if (!this.running) return;
      this.sequence += 1;
      const base = scenarios[this.scenario];
      const drift = Math.sin(this.sequence / 3) * 0.35;
      const temp = base.temp === null ? null : Number((base.temp + drift).toFixed(1));
      const tempOutside = Number((base.outside + Math.sin(this.sequence / 4) * 0.3).toFixed(1));
      const battery = Number(clamp(base.battery - (this.sequence % 12) * 0.006, 10.8, 13.1).toFixed(2));
      const tempFault = this.scenario === "sensor";
      const tankFault = this.scenario === "tank";
      const dryPump = this.scenario === "dryPump";
      const currentA = {
        pump_fill: base.pumpFill ? 0.28 : 0,
        pump_circulate: dryPump ? 0.02 : (base.pumpCirculate ? 0.3 : 0),
        fans: base.fans ? 0.37 : 0,
        battery: -0.12,
        pv: Number((base.solar / 13.1).toFixed(2)),
      };
      const loads = {
        pump_fill: { on: base.pumpFill, current_a: currentA.pump_fill, cmd_source: base.pumpFill ? "analog" : "unknown" },
        pump_circulate: { on: base.pumpCirculate, current_a: currentA.pump_circulate, cmd_source: base.pumpCirculate ? "analog" : "unknown" },
        fans: { on: base.fans, current_a: currentA.fans, cmd_source: base.fans ? "analog" : "unknown" },
      };
      const tanks = Object.fromEntries(Object.entries(base.tanks).map(([id, level]) => {
        const measured = id === "elevado" && tankFault ? 14 : level;
        return [id, { level_pct: measured, distance_cm: Number((40 - measured * 0.32).toFixed(1)), float_low: measured < 20, float_high: measured > 90, valid: true }];
      }));
      const reading = {
        schema_version: "1.2", unit_id: "maqueta01", ts: new Date().toISOString(), uptime_s: this.sequence * 5,
        simulated: true, simulation: { scenario: this.scenario, scenario_label: base.label },
        environment: { temp_int_c: temp, hum_int_pct: base.humidity, temp_ext_c: tempOutside, hum_ext_pct: base.outsideHumidity },
        tanks, groups: {
          pumps: { current_a: Number((currentA.pump_fill + currentA.pump_circulate).toFixed(2)), power_w: Number(((currentA.pump_fill + currentA.pump_circulate) * 12).toFixed(2)), pumps: { fill: currentA.pump_fill, circulate: currentA.pump_circulate } },
          fans: { current_a: currentA.fans, power_w: Number((currentA.fans * 12).toFixed(2)) },
          battery: { voltage_v: battery, current_a: currentA.battery, power_w: Number((battery * currentA.battery).toFixed(2)), switch_on: true },
          pv: { voltage_v: Number((13.1 + Math.sin(this.sequence / 5) * 0.25).toFixed(2)), current_a: currentA.pv, power_w: Math.round(base.solar + Math.sin(this.sequence / 4) * 5) },
        },
        mppt: this.scenario === "mpptOff" ? { status: "off", indicator: "off", controller_present: true } : { status: "charging", indicator: "green", controller_present: true },
        control: { temperature_target_c: this.thresholdC, target_source: "platform_simulated", target_applied: false, comparator_on: temp !== null && temp >= this.thresholdC, mode: "auto" },
        health: { connected: this.scenario !== "offline", rssi_dbm: this.scenario === "offline" ? null : -51, sensor_lost: tempFault, cycling_count_10m: this.scenario === "cycling" ? 8 : 1, fw_version: "simulador-1.2" },
        loads,
      };
      this.current = reading;
      this.history.push(reading);
      if (this.history.length > 240) this.history.shift();
      this.emit();
    }

    snapshot() { return { running: this.running, scenario: this.scenario, current: this.current, history: [...this.history], scenarios: Object.fromEntries(Object.entries(scenarios).map(([key, item]) => [key, item.label])), thresholdC: this.thresholdC }; }
    emit() { const snapshot = this.snapshot(); this.listeners.forEach((listener) => listener(snapshot)); }
  }

  window.EcofluxSimulator = new EcofluxSimulator();
})();
