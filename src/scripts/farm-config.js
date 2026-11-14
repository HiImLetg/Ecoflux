(() => {
  const profiles = {
    vivienda: {
      label: "Vivienda", theme: "home", note: "Confort térmico, agua y energía del hogar.",
      sensors: [
        ["temp_int", "Temperatura interior", "Sensor NTC 10 kΩ (existente)", "Interior", "°C", 20, 35],
        ["hum_int", "Humedad interior", "Sensor de humedad (por definir)", "Interior", "%", 30, 80],
        ["temp_ext", "Temperatura exterior", "Sensor de temperatura (por definir)", "Exterior", "°C", 10, 40],
        ["cisterna", "Nivel de cisterna", "Boyas / medición continua por validar", "Cisterna", "%", 15, 95],
        ["tanque", "Nivel de tanque elevado", "Boyas / medición continua por validar", "Tanque elevado", "%", 15, 95],
        ["pumps", "Corriente de bombas", "Sensor de corriente (por definir)", "Bombas", "A", 0, 10],
        ["fans", "Corriente de ventiladores", "Sensor de corriente (por definir)", "Ventiladores", "A", 0, 10],
        ["solar", "Potencia solar / MPPT", "Interfaz MPPT (por definir)", "Sistema solar", "W", 0, 1000],
      ],
    },
    avicola: {
      label: "Avícola", theme: "poultry", note: "Ambiente, ventilación y abastecimiento de agua para galpón.",
      sensors: [
        ["temp_galpon", "Temperatura del galpón", "Sensor de temperatura (por seleccionar)", "Galpón · altura de aves", "°C", 18, 35],
        ["hum_galpon", "Humedad del galpón", "Sensor de humedad (por seleccionar)", "Galpón", "%", 30, 80],
        ["agua", "Reserva de agua", "Boyas / medición continua por validar", "Tanque o cisterna", "%", 20, 95],
        ["fans", "Corriente de ventiladores", "Sensor de corriente (por seleccionar)", "Ventilación del galpón", "A", 0, 20],
        ["pumps", "Corriente de bombas", "Sensor de corriente (por seleccionar)", "Abastecimiento", "A", 0, 15],
        ["solar", "Potencia solar / MPPT", "Interfaz MPPT (por definir)", "Sistema solar", "W", 0, 2000],
      ],
    },
    porcino: {
      label: "Porcino", theme: "porcine", note: "Clima, ventilación y agua para instalaciones porcinas.",
      sensors: [
        ["temp_corrales", "Temperatura de corrales", "Sensor de temperatura (por seleccionar)", "Área de corrales", "°C", 16, 34],
        ["hum_corrales", "Humedad de corrales", "Sensor de humedad (por seleccionar)", "Área de corrales", "%", 30, 85],
        ["agua", "Reserva de agua", "Boyas / medición continua por validar", "Tanque o cisterna", "%", 15, 95],
        ["fans", "Corriente de ventiladores", "Sensor de corriente (por seleccionar)", "Ventilación", "A", 0, 20],
        ["pumps", "Corriente de bombas", "Sensor de corriente (por seleccionar)", "Bebederos / abastecimiento", "A", 0, 15],
        ["solar", "Potencia solar / MPPT", "Interfaz MPPT (por definir)", "Sistema solar", "W", 0, 2000],
      ],
    },
    ganadero: {
      label: "Ganadero", theme: "livestock", note: "Agua, clima y energía para establos y zonas de manejo.",
      sensors: [
        ["temp_establo", "Temperatura de establo", "Sensor de temperatura (por seleccionar)", "Establo / sombra", "°C", 10, 38],
        ["hum_establo", "Humedad de establo", "Sensor de humedad (por seleccionar)", "Establo", "%", 25, 85],
        ["agua", "Reserva / abrevadero", "Boyas / medición continua por validar", "Tanque o abrevadero", "%", 15, 95],
        ["fans", "Corriente de ventiladores", "Sensor de corriente (por seleccionar)", "Ventilación", "A", 0, 20],
        ["pumps", "Corriente de bombas", "Sensor de corriente (por seleccionar)", "Bombeo de agua", "A", 0, 20],
        ["solar", "Potencia solar / MPPT", "Interfaz MPPT (por definir)", "Sistema solar", "W", 0, 3000],
      ],
    },
  };

  const storageKey = "ecoflux-sector-config-v1";
  const defaults = () => ({
    profile: "vivienda",
    farms: [],
    activeFarmId: null,
    collapsed: false,
    profiles: Object.fromEntries(Object.keys(profiles).map((key) => [key, {
      tanks: {
        cisterna: { height_cm: "", diameter_cm: "", min_pct: 15, max_pct: 95 },
        elevado: { height_cm: "", diameter_cm: "", min_pct: 15, max_pct: 95 },
      },
      sensors: Object.fromEntries(profiles[key].sensors.map(([id, name, type, location, unit, min, max]) => [id, { name, type, location, unit, offset: 0, min, max, enabled: true }])),
    }]))
  });

  function load() {
    const base = defaults();
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (saved && typeof saved === "object") {
        base.profile = profiles[saved.profile] ? saved.profile : base.profile;
        if (Array.isArray(saved.farms)) {
          base.farms = saved.farms.filter((farm) => farm && typeof farm.id === "string" && typeof farm.name === "string" && profiles[farm.type]).map((farm) => {
            const configuration = JSON.parse(JSON.stringify(base.profiles[farm.type]));
            for (const tank of ["cisterna", "elevado"]) Object.assign(configuration.tanks[tank], farm.configuration?.tanks?.[tank] || {});
            for (const sensorId of Object.keys(configuration.sensors)) Object.assign(configuration.sensors[sensorId], farm.configuration?.sensors?.[sensorId] || {});
            return { id: farm.id, name: farm.name.trim().slice(0, 40) || profiles[farm.type].label, type: farm.type, configuration };
          });
        }
        base.activeFarmId = base.farms.some((farm) => farm.id === saved.activeFarmId) ? saved.activeFarmId : null;
        base.collapsed = Boolean(saved.collapsed);
        for (const key of Object.keys(profiles)) {
          const incoming = saved.profiles?.[key];
          if (!incoming) continue;
          for (const tank of ["cisterna", "elevado"]) Object.assign(base.profiles[key].tanks[tank], incoming.tanks?.[tank] || {});
          for (const [sensorId, sensor] of Object.entries(incoming.sensors || {})) {
            if (base.profiles[key].sensors[sensorId]) Object.assign(base.profiles[key].sensors[sensorId], sensor);
          }
        }
      }
    } catch { /* Si el navegador bloquea el almacenamiento, se usan perfiles iniciales. */ }
    return base;
  }

  function volumeLiters(tank, percent = 100) {
    const height = Number(tank?.height_cm);
    const diameter = Number(tank?.diameter_cm);
    if (!(height > 0) || !(diameter > 0)) return null;
    return Math.PI * (diameter / 2) ** 2 * height * Math.min(100, Math.max(0, percent)) / 100 / 1000;
  }

  window.EcofluxFarmConfig = Object.freeze({ profiles, load, storageKey, volumeLiters });
})();
