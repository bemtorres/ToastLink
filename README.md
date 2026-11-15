# ToastLink

ToastLink demuestra cómo React y Kotlin comparten una pantalla y se envían mensajes en ambas direcciones. La [portada](https://toastlink.cafeycodigo.org/) explica la arquitectura y el código. El WebView de Android carga el [análisis](https://toastlink.cafeycodigo.org/analisis/) por HTTPS, por lo que necesita conexión.

1. Abre `android` en Android Studio y ejecuta **app**.
2. Escribe un mensaje y pulsa **Enviar a Android** para mostrar el toast.
3. Pulsa **Saludar a React** para recibir un mensaje de Kotlin.
4. Pulsa **Consultar batería** para ver el nivel que informa el dispositivo.

Para compilar el sitio, ejecuta `npm ci` y `npm run build` desde `web/`. GitHub Actions publica `web/dist/` en GitHub Pages cuando se actualiza `main`.

El workflow de Android ejecuta las pruebas y adjunta un APK de depuración. Las etiquetas `v*` publican el APK en GitHub Releases.
