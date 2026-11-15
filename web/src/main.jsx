import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
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
  const [log, setLog] = useState([]);
  const [connected, setConnected] = useState(false);
  const nextId = useRef(0);

  function record(direction, text) {
    const entry = { id: nextId.current++, direction, text };
    setLog((previous) => [entry, ...previous].slice(0, 20));
  }

  useEffect(() => {
    function receive(event) {
      const { type, message, percent } = JSON.parse(event.data);
      switch (type) {
        case "ready":
          setConnected(true);
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

  return (
    <main>
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
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
