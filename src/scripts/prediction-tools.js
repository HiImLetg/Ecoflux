/* Herramientas separadas del modelo conversacional. No estiman hasta validar datos y método. */
(() => {
  const noData = (reason) => ({ status: "no_data", reason, model_version: null, samples_used: 0 });
  window.EcofluxPredictionTools = Object.freeze({
    forecast_temp(horizon_min, history = []) {
      if (!Number.isFinite(Number(horizon_min)) || Number(horizon_min) <= 0) return noData("horizon_invalid");
      if (!Array.isArray(history) || history.length === 0) return noData("measurements_missing");
      return { status: "calibrating", horizon_min: Number(horizon_min), estimate_c: null, interval_c: null, samples_used: history.length, model_version: null, reason: "model_validation_pending" };
    },
    battery_autonomy(history = []) {
      return { status: "calibrating", hours_remaining: null, samples_used: Array.isArray(history) ? history.length : 0, model_version: null, reason: "battery_calibration_pending" };
    },
    check_anomalies(reading = null) {
      if (!reading || typeof reading !== "object") return noData("measurements_missing");
      return { status: "calibrating", anomalies: [], samples_used: 0, model_version: null, reason: "baseline_validation_pending" };
    },
  });
})();
