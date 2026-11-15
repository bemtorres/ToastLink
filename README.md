# ToastLink

Abre `WebDroidBridgeAPP` en Android Studio y ejecuta la configuración **app**
en un teléfono o emulador. El APK incluye los archivos locales de React y los
tres controles funcionan sin conexión.

1. Escribe un mensaje y pulsa **Enviar a Android**. Android muestra un toast y
   React registra el envío y la confirmación.
2. Pulsa **Saludar a React** en el encabezado nativo. Aparece **Hola desde Kotlin**
   en el último mensaje y en el registro.
3. Pulsa **Consultar batería**. React muestra el porcentaje devuelto por Android
   y registra la solicitud y su respuesta.

Para regenerar los archivos de React después de editar `WebDroidBridgeWeb/src`,
ejecuta desde `WebDroidBridgeWeb`:

```powershell
npm ci
npm run build
```

La compilación actualiza `WebDroidBridgeAPP/app/src/main/assets/toastlink`.
Vuelve a ejecutar **app** para incluir esos cambios en el APK.

## CI/CD en GitHub

**ToastLink Android** regenera React, ejecuta las pruebas unitarias de Android y
adjunta el APK de depuración a cada ejecución en **Actions**. Se ejecuta con
cada cambio en `main`, en los pull requests hacia `main` y de forma manual.

Para publicar una versión, crea una etiqueta en el commit que quieres distribuir:

```powershell
git tag -a v1.0.0 -m "ToastLink v1.0.0"
git push origin v1.0.0
```

Cuando pase la compilación de la etiqueta, GitHub Actions publica
`toastlink-debug.apk` en **Releases**. El archivo es un APK de demostración con
firma de depuración. Si una actualización se compiló con otra clave de
depuración, desinstala la versión anterior antes de instalar el APK nuevo.
