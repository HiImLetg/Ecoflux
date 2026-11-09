(() => {
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const scenarios = {
    normal: { label: "Día normal", temp: 28.4, humidity: 67, tankLow: 74, tankHigh: 83, battery: 12.6, solar: 86, fan1: false, fan2: false, pumpLow: false, pumpHigh: false, valve: false },
    heat: { label: "Ola de calor", temp: 34.2, humidity: 71, tankLow: 62, tankHigh: 70, battery: 12.2, solar: 124, fan1: true, fan2: true, pumpLow: false, pumpHigh: true, valve: true },
    tank: { label: "Tanque bajo", temp: 31.1, humidity: 66, tankLow: 58, tankHigh: 14, battery: 12.1, solar: 103, fan1: true, fan2: true, pumpLow: false, pumpHigh: false, valve: false },
    dryPump: { label: "Bomba sin agua", temp: 30.6, humidity: 64, tankLow: 8, tankHigh: 36, battery: 12.0, solar: 97, fan1: true, fan2: false, pumpLow: false, pumpHigh: true, valve: true },
    sensor: { label: "Falla de sensor", temp: null, humidity: 65, tankLow: 55, tankHigh: 68, battery: 12.4, solar: 91, fan1: false, fan2: false, pumpLow: false, pumpHigh: false, valve: false },
    offline: { label: "Pérdida de conexión", temp: 32.8, humidity: 70, tankLow: 50, tankHigh: 61, battery: 11.9, solar: 77, fan1: true, fan2: true, pumpLow: false, pumpHigh: true, valve: true },
    cycling: { label: "Conmutación rápida", temp: 30.1, humidity: 68, tankLow: 63, tankHigh: 75, battery: 12.3, solar: 88, fan1: true, fan2: false, pumpLow: false, pumpHigh: false, valve: false },
  };

  class EcofluxSimulator {
    constructor() {
      this.running = false;
      this.scenario = "normal";
      this.sequence = 0;
      this.history = [];
      this.listeners = new Set();
      this.timer = null;
      this.current = null;
    }

    subscribe(listener) {
      this.listeners.add(listener);
      listener(this.snapshot());
      return () => this.listeners.delete(listener);
    }

    start(scenario = this.scenario) {
      this.scenario = scenarios[scenario] ? scenario : "normal";
      if (!this.running) {
        this.running = true;
        this.tick();
        this.timer = window.setInterval(() => this.tick(), 5000);
      } else {
        this.tick();
      }
    }

    stop() {
      this.running = false;
      if (this.timer) window.clearInterval(this.timer);
      this.timer = null;
      this.emit();
    }

    setScenario(scenario) {
      if (!scenarios[scenario]) return;
      this.scenario = scenario;
      if (this.running) this.tick();
      else this.emit();
    }

    tick() {
      if (!this.running) return;
      this.sequence += 1;
      const base = scenarios[this.scenario];
      const drift = Math.sin(this.sequence / 3) * 0.35;
      const temp = base.temp === null ? null : Number((base.temp + drift).toFixed(1));
      const battery = Number(clamp(base.battery - (this.sequence % 12) * 0.006, 10.8, 13.1).toFixed(2));
      const tempFault = this.scenario === "sensor";
      const highTankFault = this.scenario === "tank";
      const dryPump = this.scenario === "dryPump";
      const loads = {
        fan1: { on: base.fan1, current_a: base.fan1 ? 0.19 : 0, cmd_source: base.fan1 ? "analog" : "unknown" },
        fan2: { on: base.fan2, current_a: base.fan2 ? 0.18 : 0, cmd_source: base.fan2 ? "analog" : "unknown" },
        pump_low: { on: base.pumpLow, current_a: base.pumpLow ? 0.13 : 0, cmd_source: base.pumpLow ? "analog" : "unknown" },
        pump_high: { on: base.pumpHigh, current_a: dryPump ? 0.02 : (base.pumpHigh ? 0.3 : 0), cmd_source: base.pumpHigh ? "analog" : "unknown" },
        valve: { on: base.valve, current_a: base.valve ? 0.44 : 0, cmd_source: base.valve ? "analog" : "unknown" },
      };
      const reading = {
        schema_version: "1.1",
        unit_id: "maqueta01",
        ts: new Date().toISOString(),
        uptime_s: this.sequence * 5,
        simulated: true,
        scenario: this.scenario,
        scenario_label: base.label,
        connected: this.scenario !== "offline",
        temp_int_c: temp,
        hum_int_pct: base.humidity,
        tank_low_pct: this.scenario === "dryPump" ? 8 : base.tankLow,
        tank_high_pct: highTankFault ? 14 : base.tankHigh,
        batt_v: battery,
        batt_a: -0.12,
        panel_v: Number((13.1 + Math.sin(this.sequence / 5) * 0.25).toFixed(2)),
        panel_a: Number((base.solar / 13.1).toFixed(2)),
        solar_w: Math.round(base.solar + Math.sin(this.sequence / 4) * 5),
        comparator_on: temp !== null && temp >= 30,
        mode: "auto",
        rssi_dbm: this.scenario === "offline" ? null : -51,
        fw_version: "simulador-1.1",
        sensor_lost: tempFault,
        cycling_count_10m: this.scenario === "cycling" ? 8 : 1,
        loads,
      };
      this.current = reading;
      this.history.push(reading);
      if (this.history.length > 240) this.history.shift();
      this.emit();
    }

    snapshot() {
      return { running: this.running, scenario: this.scenario, current: this.current, history: [...this.history], scenarios: Object.fromEntries(Object.entries(scenarios).map(([key, item]) => [key, item.label])) };
    }

    emit() {
      const snapshot = this.snapshot();
      this.listeners.forEach((listener) => listener(snapshot));
    }
  }

  window.EcofluxSimulator = new EcofluxSimulator();
})();
