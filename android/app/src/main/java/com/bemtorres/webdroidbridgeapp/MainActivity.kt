package com.bemtorres.webdroidbridgeapp

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import android.os.BatteryManager
import android.os.Build
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.WebMessage
import android.webkit.WebMessagePort
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.Toast
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import com.journeyapps.barcodescanner.CaptureActivity
import org.json.JSONObject
import java.io.ByteArrayInputStream

private const val WEB_ORIGIN = "https://toastlink.cafeycodigo.org"
private const val START_PAGE = "$WEB_ORIGIN/analisis/"
private const val NOTIFICATION_CHANNEL = "toastlink_demo"
private const val DEMO_NOTIFICATION_ID = 1

class ProductQrActivity : CaptureActivity()

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var greetButton: Button
    private var port: WebMessagePort? = null
    private var pendingWebCamera: PermissionRequest? = null
    private var nativeScannerPort: WebMessagePort? = null
    private val requestCameraPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            val request = pendingWebCamera
            pendingWebCamera = null
            if (request != null) {
                if (granted && canGrantWebCamera(request)) {
                    request.grant(arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE))
                } else {
                    request.deny()
                }
            }
        }
    private val qrScanner = registerForActivityResult(ScanContract()) { result ->
        val requestingPort = nativeScannerPort
        nativeScannerPort = null
        if (requestingPort != null && requestingPort === port) {
            sendToReact("nativeQrResult", "value", result.contents ?: JSONObject.NULL)
        }
    }
    private var permissionRequestPort: WebMessagePort? = null
    private val requestNotificationPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            val requestingPort = permissionRequestPort
            permissionRequestPort = null
            if (requestingPort != null && requestingPort === port) {
                if (granted) postDemoNotification()
                else sendNotificationResult(R.string.notification_blocked)
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        WindowInsetsControllerCompat(window, window.decorView).isAppearanceLightStatusBars = false
        setContentView(R.layout.activity_main)

        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.main)) { view, insets ->
            val padding = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or
                    WindowInsetsCompat.Type.displayCutout() or
                    WindowInsetsCompat.Type.ime()
            )
            view.setPadding(padding.left, padding.top, padding.right, padding.bottom)
            insets
        }

        webView = findViewById(R.id.web_view)
        greetButton = findViewById(R.id.greet_react)
        greetButton.isEnabled = false
        greetButton.setOnClickListener {
            sendToReact("greeting", "message", getString(R.string.kotlin_greeting))
        }

        webView.settings.apply {
            javaScriptEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        }
        webView.webViewClient = DemoClient()
        webView.webChromeClient = CameraChromeClient()
        webView.loadUrl(START_PAGE)
    }

    private var loadFailed = false

    private fun showLoadError() {
        if (loadFailed) return
        loadFailed = true
        disconnect()
        Toast.makeText(this, R.string.web_load_error, Toast.LENGTH_LONG).show()
    }

    private fun disconnect() {
        pendingWebCamera?.deny()
        pendingWebCamera = null
        greetButton.isEnabled = false
        port?.close()
        port = null
    }

    private fun connect() {
        val origin = Uri.parse(WEB_ORIGIN)
        val (nativePort, reactPort) = webView.createWebMessageChannel()
        port = nativePort
        nativePort.setWebMessageCallback(object : WebMessagePort.WebMessageCallback() {
            override fun onMessage(sender: WebMessagePort, message: WebMessage) {
                if (sender !== port || webView.url != START_PAGE) return
                receiveFromReact(message.data)
            }
        })
        webView.postWebMessage(WebMessage("toastlink:connect", arrayOf(reactPort)), origin)
    }

    private fun receiveFromReact(data: String?) {
        if (data == null || data.length > 2048) return
        val request = runCatching { JSONObject(data) }.getOrNull() ?: return
        val type = request.optString("type")
        if (type == "ready") {
            greetButton.isEnabled = true
            port?.postMessage(WebMessage("""{"type":"ready","notifications":true,"nativeQr":true,"nativeShare":true}"""))
            return
        }
        if (!greetButton.isEnabled) return

        when (type) {
            "shareOrder" -> shareOrder(request.optString("summary"))
            "scanNativeQr" -> openNativeScanner()
            "showNotification" -> showDemoNotification()
            "showToast" -> {
                val text = request.optString("message").trim().take(120)
                if (text.isEmpty()) return
                Toast.makeText(this, text, Toast.LENGTH_SHORT).show()
                sendToReact("toastShown")
            }
            "requestBattery" -> {
                val percent = getSystemService(BatteryManager::class.java)
                    ?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
                    ?.takeIf { it in 0..100 }
                sendToReact("battery", "percent", percent ?: JSONObject.NULL)
            }
        }
    }

    private fun shareOrder(summary: String) {
        val text = summary.trim()
        if (text.isEmpty() || text.length > 1000) {
            sendToReact("shareOrderResult", "message", getString(R.string.order_share_unavailable))
            return
        }
        val intent = Intent(Intent.ACTION_SEND)
            .setType("text/plain")
            .putExtra(Intent.EXTRA_TEXT, text)
        val result = try {
            startActivity(Intent.createChooser(intent, getString(R.string.order_share_title)))
            R.string.order_share_opened
        } catch (_: ActivityNotFoundException) {
            R.string.order_share_unavailable
        }
        sendToReact("shareOrderResult", "message", getString(result))
    }

    private fun openNativeScanner() {
        if (nativeScannerPort != null) return
        if (!packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY)) {
            sendToReact("nativeQrResult", "value", JSONObject.NULL)
            return
        }
        nativeScannerPort = port
        qrScanner.launch(
            ScanOptions()
                .setCaptureActivity(ProductQrActivity::class.java)
                .setDesiredBarcodeFormats(ScanOptions.QR_CODE)
                .setPrompt(getString(R.string.scan_qr_prompt))
                .setBeepEnabled(false)
        )
    }

    private fun canGrantWebCamera(request: PermissionRequest): Boolean {
        val origin = Uri.parse(WEB_ORIGIN)
        return request.origin.scheme == origin.scheme &&
            request.origin.encodedAuthority == origin.encodedAuthority &&
            webView.url == START_PAGE &&
            request.resources.contentEquals(arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE))
    }

    private inner class CameraChromeClient : WebChromeClient() {
        override fun onPermissionRequest(request: PermissionRequest) {
            if (pendingWebCamera != null || !canGrantWebCamera(request)) {
                request.deny()
            } else if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                request.grant(arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE))
            } else {
                pendingWebCamera = request
                requestCameraPermission.launch(Manifest.permission.CAMERA)
            }
        }

        override fun onPermissionRequestCanceled(request: PermissionRequest) {
            if (pendingWebCamera === request) pendingWebCamera = null
        }
    }

    private fun showDemoNotification() {
        if (permissionRequestPort != null) {
            if (permissionRequestPort !== port) sendNotificationResult(R.string.notification_blocked)
            return
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            permissionRequestPort = port
            requestNotificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
            return
        }
        postDemoNotification()
    }

    private fun postDemoNotification() {
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(
                NOTIFICATION_CHANNEL,
                getString(R.string.notification_channel),
                NotificationManager.IMPORTANCE_DEFAULT
            )
        )
        if (!manager.areNotificationsEnabled() ||
            manager.getNotificationChannel(NOTIFICATION_CHANNEL)?.importance == NotificationManager.IMPORTANCE_NONE
        ) {
            sendNotificationResult(R.string.notification_blocked)
            return
        }

        val notification = Notification.Builder(this, NOTIFICATION_CHANNEL)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(getString(R.string.app_name))
            .setContentText(getString(R.string.notification_body))
            .build()

        try {
            manager.notify(DEMO_NOTIFICATION_ID, notification)
            sendNotificationResult(R.string.notification_sent)
        } catch (_: SecurityException) {
            sendNotificationResult(R.string.notification_blocked)
        }
    }

    private fun sendNotificationResult(message: Int) {
        sendToReact("notificationResult", "message", getString(message))
    }

    private fun sendToReact(type: String, key: String? = null, value: Any = JSONObject.NULL) {
        val payload = JSONObject().put("type", type)
        if (key != null) payload.put(key, value)
        port?.postMessage(WebMessage(payload.toString()))
    }

    override fun onDestroy() {
        disconnect()
        (webView.parent as? ViewGroup)?.removeView(webView)
        webView.destroy()
        super.onDestroy()
    }

    private inner class DemoClient : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            if (!request.isForMainFrame) return true
            val url = request.url.toString()
            if (url == START_PAGE) return false
            if (request.hasGesture() &&
                (url == "https://github.com/bemtorres" || url == "https://cafeycodigo.org/")
            ) {
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, request.url))
                } catch (_: ActivityNotFoundException) {
                    Toast.makeText(this@MainActivity, R.string.link_unavailable, Toast.LENGTH_SHORT).show()
                }
            }
            return true
        }

        override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
            loadFailed = false
            disconnect()
        }

        override fun onPageFinished(view: WebView, url: String) {
            if (!loadFailed && url == START_PAGE && view.url == START_PAGE && port == null) connect()
        }

        override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
            if (request.isForMainFrame && request.url.toString() == START_PAGE) showLoadError()
        }

        override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, error: WebResourceResponse) {
            if (request.isForMainFrame && request.url.toString() == START_PAGE) showLoadError()
        }

        override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
            val url = request.url.toString()
            return when (url) {
                START_PAGE, "$WEB_ORIGIN/analisis/main.css", "$WEB_ORIGIN/analisis/main.js",
                "$WEB_ORIGIN/analisis/qr-demo.svg" -> null
                else -> WebResourceResponse(
                    "text/plain", "UTF-8", 404, "Not Found", emptyMap(), ByteArrayInputStream(byteArrayOf())
                )
            }
        }

    }
}
