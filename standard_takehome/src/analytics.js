const FIREBASE_SDK_VERSION = "12.7.0";
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDgpgJqnDwkUjx_mJi70e-dKhHvHor5Jmc",
  authDomain: "canvascontext-9da05.firebaseapp.com",
  projectId: "canvascontext-9da05",
  storageBucket: "canvascontext-9da05.firebasestorage.app",
  messagingSenderId: "669013211901",
  appId: "1:669013211901:web:22bb07980b79f768c05c94",
  measurementId: "G-HS4MKPC3X7"
};

function disabledTracker(reason) {
  if (reason) console.info(`Firebase Analytics disabled: ${reason}`);
  return {
    enabled: false,
    logEvent() {}
  };
}

function cleanParams(params = {}) {
  const out = {};
  for (const [key, value] of Object.entries(params)) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(key)) continue;
    if (value == null) continue;
    if (typeof value === "string") out[key] = value.slice(0, 100);
    else if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
    else if (typeof value === "boolean") out[key] = value ? 1 : 0;
  }
  return out;
}

async function loadHostingConfig() {
  const res = await fetch("/__/firebase/init.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`init.json ${res.status}`);
  return res.json();
}

export async function initAnalytics(context = {}) {
  try {
    if (["localhost", "127.0.0.1", "0.0.0.0"].includes(location.hostname)) {
      return disabledTracker("local development host");
    }

    let config = FIREBASE_CONFIG;
    try {
      const hosted = await loadHostingConfig();
      if (hosted.appId && hosted.measurementId) config = { ...FIREBASE_CONFIG, ...hosted };
    } catch {
      config = FIREBASE_CONFIG;
    }

    if (!config.appId || !config.measurementId) {
      return disabledTracker("Firebase config is missing appId or measurementId");
    }

    const [{ initializeApp }, analyticsSdk] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-analytics.js`)
    ]);

    if (!(await analyticsSdk.isSupported())) {
      return disabledTracker("browser does not support Analytics");
    }

    const app = initializeApp(config);
    const analytics = analyticsSdk.getAnalytics(app);
    const tracker = {
      enabled: true,
      logEvent(name, params = {}) {
        if (!/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(name)) return;
        analyticsSdk.logEvent(analytics, name, cleanParams(params));
      }
    };

    tracker.logEvent("takehome_view", {
      sample_mode: context.sampleMode ? "on" : "off",
      sample_id: context.sampleId || "none",
      via: context.via || "direct",
      host: location.hostname
    });
    return tracker;
  } catch (e) {
    return disabledTracker(e.message);
  }
}
