import React, { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { ArrowLeft, Camera, Coffee, Croissant, Globe, Minus, Plus, Sandwich, ScanLine, Share2, ShoppingBag, Store, Wheat } from "lucide-react";

const products = [
  { id: "TL-CAFE", name: "Café de la casa", detail: "Americano de grano tostado", icon: Coffee, price: 2400, tone: "coffee" },
  { id: "TL-CROISSANT", name: "Croissant de mantequilla", detail: "Hojaldre recién horneado", icon: Croissant, price: 2900, tone: "pastry" },
  { id: "TL-SANDWICH", name: "Sándwich de palta", detail: "Pan de masa madre y tomate", icon: Sandwich, price: 4600, tone: "sandwich" },
  { id: "TL-ROLLO", name: "Rollo de canela", detail: "Glaseado de vainilla", icon: Wheat, price: 3200, tone: "roll" },
];

const money = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const tabs = [["catalog", "Catálogo", Store], ["scan", "Escanear QR", ScanLine], ["cart", "Carrito", ShoppingBag]];

export function Credits() {
  return (
    <footer className="web-credits">
      Creado por <a href="https://github.com/bemtorres">Bemtorres en GitHub</a> para <a href="https://cafeycodigo.org/">cafeycodigo.org</a>.
    </footer>
  );
}

function WebScanner({ onRead, onError }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    let canceled = false;
    let stream;
    let timer;

    function scanFrame() {
      if (canceled) return;
      if (video.videoWidth && video.videoHeight && video.readyState >= 2) {
        const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frame = context.getImageData(0, 0, canvas.width, canvas.height);
        const result = jsQR(frame.data, frame.width, frame.height);
        if (result?.data) {
          onRead(result.data);
          return;
        }
      }
      timer = window.setTimeout(scanFrame, 170);
    }

    async function start() {
      try {
        if (!context || !navigator.mediaDevices?.getUserMedia) {
          onError("La cámara web requiere HTTPS y un navegador compatible.");
          return;
        }
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (canceled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        video.srcObject = stream;
        await video.play();
        scanFrame();
      } catch (error) {
        if (canceled) return;
        const denied = error.name === "NotAllowedError";
        onError(denied
          ? "Permiso de cámara denegado. Revisa los ajustes del navegador o de ToastLink."
          : "No se pudo abrir la cámara. Comprueba que esté disponible.");
      }
    }

    start();
    return () => {
      canceled = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    };
  }, [onRead, onError]);

  return <video ref={videoRef} className="store-video" muted playsInline aria-label="Vista previa de la cámara web" />;
}

export default function DeliveryStore({
  active, onBack, nativeSupported, onNativeScan, nativeScan,
  shareSupported, onShare, shareStatus,
}) {
  const [tab, setTab] = useState("catalog");
  const [cart, setCart] = useState({});
  const [webCamera, setWebCamera] = useState(false);
  const [webResult, setWebResult] = useState(null);
  const [cartStatus, setCartStatus] = useState("");
  const items = products.filter((product) => cart[product.id] > 0);
  const quantity = items.reduce((sum, product) => sum + cart[product.id], 0);
  const total = items.reduce((sum, product) => sum + product.price * cart[product.id], 0);
  const results = [webResult, nativeScan?.pending ? null : nativeScan].filter(Boolean);

  const onWebRead = useCallback((value) => {
    setWebCamera(false);
    setWebResult({ source: "Cámara web", value });
  }, []);
  const onWebError = useCallback((error) => {
    setWebCamera(false);
    setWebResult({ source: "Cámara web", error });
  }, []);

  function changeQuantity(product, change) {
    setCart((previous) => ({
      ...previous,
      [product.id]: Math.max(0, (previous[product.id] || 0) + change),
    }));
    setCartStatus(change > 0 ? `${product.name} se añadió al carrito.` : `Carrito actualizado. ${product.name}.`);
  }

  function selectTab(next) {
    setWebCamera(false);
    setTab(next);
    window.scrollTo(0, 0);
  }

  function shareOrder() {
    const summary = [
      "Pedido de demostración · Despensa ToastLink",
      ...items.map(({ id, name, price }) => `${cart[id]} × ${name} · ${money.format(price * cart[id])}`),
      `Total: ${money.format(total)}`,
    ].join("\n");
    onShare(summary);
  }

  if (!active) return null;

  return (
    <main className="store">
      <header className="store-header">
        <button type="button" className="store-back" onClick={() => { setWebCamera(false); onBack(); }}>
          <ArrowLeft size={18} aria-hidden="true" /> Volver al puente
        </button>
        <h1>Despensa ToastLink</h1>
        <p>Café, panadería y almuerzos para llevar.</p>
      </header>

      <p className="store-announcement" role="status">{cartStatus}</p>

      {tab === "catalog" && (
        <section className="store-panel" aria-labelledby="catalog-title">
          <h2 id="catalog-title">Catálogo</h2>
          <div className="product-grid">
            {products.map((product) => (
              <article className="product" key={product.id}>
                <div className={`product-art ${product.tone}`} aria-hidden="true"><product.icon size={38} strokeWidth={1.7} /></div>
                <div className="product-info">
                  <h3>{product.name}</h3>
                  <p>{product.detail}</p>
                  <div className="product-actions">
                    <strong>{money.format(product.price)}</strong>
                    <button type="button" aria-label={`Agregar ${product.name}`} onClick={() => changeQuantity(product, 1)}>Agregar</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === "scan" && (
        <section className="store-panel" aria-labelledby="scan-title">
          <h2 id="scan-title">Escanear QR</h2>
          <p>Escanea el código de un producto para buscarlo en el catálogo.</p>
          <div className="scanner-actions">
            <button type="button" disabled={nativeScan?.pending} onClick={() => {
              setWebResult(null);
              setWebCamera((open) => !open);
            }}><Globe size={17} aria-hidden="true" /> {webCamera ? "Cerrar cámara web" : "Abrir cámara web"}</button>
            <button type="button" className="secondary" disabled={!nativeSupported || webCamera || nativeScan?.pending} onClick={onNativeScan}>
              <Camera size={17} aria-hidden="true" /> {nativeScan?.pending ? "Cámara nativa abierta…" : "Abrir cámara nativa"}
            </button>
          </div>
          {!nativeSupported && <p>Abre la versión actualizada de ToastLink en Android para usar la cámara nativa.</p>}
          {webCamera && <WebScanner onRead={onWebRead} onError={onWebError} />}
          <div aria-live="polite">
            {results.map(({ source, value, error }) => {
              const product = products.find(({ id }) => id === value?.trim());
              return (
                <div className="scan-result" key={source}>
                  <h3>{source}</h3>
                  <p>{error || (product ? product.name : "El código no coincide con el catálogo.")}</p>
                  {value && <code>{value}</code>}
                  {product && <button type="button" onClick={() => changeQuantity(product, 1)}>Agregar al carrito</button>}
                </div>
              );
            })}
          </div>
          <details className="sample-qr">
            <summary>Mostrar QR de prueba</summary>
            <img src="qr-demo.svg" width="152" height="152" alt="Código QR de prueba para Café de la casa" />
            <p>Abre este QR en otra pantalla y apúntale con la cámara. Corresponde al café de la casa.</p>
          </details>
        </section>
      )}

      {tab === "cart" && (
        <section className="store-panel" aria-labelledby="cart-title">
          <h2 id="cart-title">Tu carrito</h2>
          {items.length === 0 ? <p>Agrega productos desde el catálogo o escanea un QR.</p> : (
            <>
              <ul className="cart-items">
                {items.map((product) => (
                  <li key={product.id}>
                    <div><strong>{product.name}</strong><p>{money.format(product.price * cart[product.id])}</p></div>
                    <div className="quantity-controls">
                      <button type="button" className="secondary" aria-label={`Quitar una unidad de ${product.name}`} onClick={() => changeQuantity(product, -1)}><Minus size={16} aria-hidden="true" /></button>
                      <span>{cart[product.id]}</span>
                      <button type="button" className="secondary" aria-label={`Agregar una unidad de ${product.name}`} onClick={() => changeQuantity(product, 1)}><Plus size={16} aria-hidden="true" /></button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="cart-total"><strong>Total</strong><strong>{money.format(total)}</strong></div>
              <div className="share-order">
                <button type="button" disabled={!shareSupported} onClick={shareOrder}>
                  <Share2 size={18} aria-hidden="true" /> Compartir pedido
                </button>
                {!shareSupported && <p>Abre el APK actualizado de ToastLink para compartir desde Android.</p>}
                <p role="status">{shareStatus}</p>
              </div>
            </>
          )}
        </section>
      )}

      <Credits />
      <div className="store-dock">
        <nav className="store-nav" aria-label="Navegación de la tienda">
          {tabs.map(([id, label, Icon]) => {
            const cartCount = id === "cart" && quantity > 0;
            return (
              <button key={id} type="button" aria-current={tab === id ? "page" : undefined}
                aria-label={cartCount ? `Carrito, ${quantity} unidades` : label} onClick={() => selectTab(id)}>
                <span className="store-nav-icon">
                  <Icon size={22} strokeWidth={tab === id ? 2.4 : 1.8} aria-hidden="true" />
                  {cartCount && <span className="store-nav-count" aria-hidden="true">{quantity > 99 ? "99+" : quantity}</span>}
                </span>
                <span>{label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </main>
  );
}
