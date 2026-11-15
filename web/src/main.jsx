import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import DeliveryStore, { Credits } from "./DeliveryStore.jsx";
import "./style.css";

let androidPort = null;
window.addEventListener("message", (event) => {
  if (event.data !== "toastlink:connect" || event.ports.length !== 1 || androidPort) return;
  androidPort = event.ports[0];
  window.dispatchEvent(new Event("toastlink:connect"));
});

function App() {
  const [message, setMessage] = useState("Hola desde React");
  const [greeting, setGreeting] = useState("");
  const [battery, setBattery] = useState(null);
  const [batteryPending, setBatteryPending] = useState(false);
  const [notificationsSupported, setNotificationsSupported] = useState(false);
  const [notificationPending, setNotificationPending] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState("");
  const [log, setLog] = useState([]);
  const [connected, setConnected] = useState(false);
  const [storeOpen, setStoreOpen] = useState(false);
  const [nativeQrSupported, setNativeQrSupported] = useState(false);
  const [nativeScan, setNativeScan] = useState(null);
  const [shareSupported, setShareSupported] = useState(false);
  const [shareStatus, setShareStatus] = useState("");
  const nextId = useRef(0);

  function record(direction, text) {
    const entry = { id: nextId.current++, direction, text };
    setLog((previous) => [entry, ...previous].slice(0, 20));
  }

  useEffect(() => {
    function receive(event) {
      const { type, message, percent, notifications, nativeQr, nativeShare, value } = JSON.parse(event.data);
      switch (type) {
        case "ready":
          setConnected(true);
          setNotificationsSupported(notifications === true);
          setNativeQrSupported(nativeQr === true);
          setShareSupported(nativeShare === true);
          break;
        case "shareOrderResult":
          setShareStatus(message);
          record("Kotlin → React", message);
          break;
        case "nativeQrResult":
          setNativeScan(value === null
            ? { source: "Cámara nativa", error: "Escaneo cancelado o cámara no disponible." }
            : { source: "Cámara nativa", value });
          record("Kotlin → React", value === null ? "Escaneo nativo sin resultado" : "Código QR recibido");
          break;
        case "notificationResult":
          setNotificationPending(false);
          setNotificationStatus(message);
          record("Kotlin → React", message);
          break;
        case "greeting":
          setGreeting(message);
          record("Kotlin → React", message);
          break;
        case "toastShown":
          record("Kotlin → React", "Android ejecutó el toast");
          break;
        case "battery": {
          const result = percent === null ? "No disponible" : `${percent} %`;
          setBattery(result);
          setBatteryPending(false);
          record("Kotlin → React", `Batería · ${result}`);
          break;
        }
      }
    }

    function connect() {
      if (!androidPort) return;
      androidPort.onmessage = receive;
      requestAndroid("ready");
    }

    window.addEventListener("toastlink:connect", connect);
    connect();
    return () => {
      window.removeEventListener("toastlink:connect", connect);
      if (androidPort) androidPort.onmessage = null;
    };
  }, []);

  function requestAndroid(type, fields = {}) {
    androidPort?.postMessage(JSON.stringify({ type, ...fields }));
  }

  function sendToast(event) {
    event.preventDefault();
    const text = message.trim();
    if (!connected || !text) return;
    record("React → Kotlin", `Mostrar toast · ${text}`);
    requestAndroid("showToast", { message: text });
  }

  function requestBattery() {
    if (!connected || batteryPending) return;
    setBatteryPending(true);
    record("React → Kotlin", "Consultar nivel de batería");
    requestAndroid("requestBattery");
  }

  function sendNotification() {
    if (!notificationsSupported || notificationPending) return;
    setNotificationPending(true);
    record("React → Kotlin", "Enviar notificación");
    requestAndroid("showNotification");
  }

  function scanNative() {
    if (!nativeQrSupported || nativeScan?.pending) return;
    setNativeScan({ pending: true });
    record("React → Kotlin", "Abrir lector QR nativo");
    requestAndroid("scanNativeQr");
  }

  function shareOrder(summary) {
    if (!shareSupported) return;
    setShareStatus("");
    record("React → Kotlin", "Abrir panel para compartir el pedido");
    requestAndroid("shareOrder", { summary });
  }

  return (
    <>
    <main hidden={storeOpen}>
      <h1>{connected ? "React dentro del WebView" : "Análisis del puente React y Android"}</h1>
      {!connected && (
        <p className="notice">
          Aquí puedes ver los controles y el registro del puente. Abre ToastLink en Android para probarlos.
          {" "}<a href="../">Volver al inicio</a>
        </p>
      )}

      <form className="card" onSubmit={sendToast}>
        <label htmlFor="message">Mensaje del toast</label>
        <div className="field">
          <input id="message" value={message} maxLength={120} onChange={(event) => setMessage(event.target.value)} />
          <button disabled={!connected || !message.trim()}>Enviar a Android</button>
        </div>
      </form>

      <section className="card results" aria-label="Respuestas de Android">
        <div className="battery">
          <div>
            <h2>Batería</h2>
            <output aria-live="polite">{batteryPending ? "Consultando…" : battery ?? "Sin consultar"}</output>
          </div>
          <button className="secondary" type="button" disabled={!connected || batteryPending} onClick={requestBattery}>
            Consultar batería
          </button>
        </div>
        <div className="greeting">
          <h2>Último mensaje de Android</h2>
          <p aria-live="polite">{greeting || "Aún no hay mensajes"}</p>
        </div>
      </section>

      <section className="card action-row" aria-label="Notificaciones">
        <div>
          <h2>Notificaciones</h2>
          <output aria-live="polite">
            {notificationPending ? "Esperando a Android…" : notificationStatus ||
              (connected && !notificationsSupported ? "Actualiza ToastLink para usar esta función." : "")}
          </output>
        </div>
        <button className="secondary" type="button" disabled={!notificationsSupported || notificationPending} onClick={sendNotification}>
          Enviar notificación
        </button>
      </section>

      <section className="trace" aria-labelledby="trace-title">
        <h2 id="trace-title">Registro de interacción</h2>
        <div role="log" aria-live="polite">
          {log.length === 0 ? <p className="empty">Las interacciones aparecerán aquí.</p> : (
            <ol>
              {log.map(({ id, direction, text }) => (
                <li key={id}>
                  <span className="direction">{direction}</span>
                  <span>{text}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
      <section className="card action-row" aria-label="Tienda de demostración">
        <div><h2>Prueba el puente en una tienda</h2><p className="store-entry-copy">Explora el catálogo y compara las dos cámaras.</p></div>
        <button type="button" onClick={() => { setStoreOpen(true); window.scrollTo(0, 0); }}>Ir a la tienda</button>
      </section>
      <Credits />
    </main>
    <DeliveryStore
      active={storeOpen}
      onBack={() => { setStoreOpen(false); window.scrollTo(0, 0); }}
      nativeSupported={nativeQrSupported}
      onNativeScan={scanNative}
      nativeScan={nativeScan}
      shareSupported={shareSupported}
      onShare={shareOrder}
      shareStatus={shareStatus}
    />
    </>
  );
}

createRoot(document.getElementById("root")).render(<App />);
