package com.bemtorres.webdroidbridgeapp

import android.graphics.Bitmap
import android.net.Uri
import android.os.BatteryManager
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.WebMessage
import android.webkit.WebMessagePort
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.Toast
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import org.json.JSONObject
import java.io.ByteArrayInputStream

private const val WEB_ORIGIN = "https://toastlink.cafeycodigo.org"
private const val START_PAGE = "$WEB_ORIGIN/analisis/"
private const val LOCAL_ORIGIN = "https://appassets.androidplatform.net"
private const val OFFLINE_PAGE = "$LOCAL_ORIGIN/toastlink/index.html"
private const val LOAD_TIMEOUT_MS = 6000L

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var greetButton: Button
    private var port: WebMessagePort? = null
    private var offline = false
    private val fallback = Runnable { loadOffline() }

    private val currentPage: String
        get() = if (offline) OFFLINE_PAGE else START_PAGE

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
        webView.postDelayed(fallback, LOAD_TIMEOUT_MS)
        webView.loadUrl(START_PAGE)
    }

    private fun loadOffline() {
        if (offline || isDestroyed) return
        offline = true
        webView.removeCallbacks(fallback)
        disconnect()
        webView.stopLoading()
        webView.settings.blockNetworkLoads = true
        webView.loadUrl(OFFLINE_PAGE)
    }

    private fun disconnect() {
        greetButton.isEnabled = false
        port?.close()
        port = null
    }

    private fun connect() {
        val origin = Uri.parse(if (offline) LOCAL_ORIGIN else WEB_ORIGIN)
        val (nativePort, reactPort) = webView.createWebMessageChannel()
        port = nativePort
        nativePort.setWebMessageCallback(object : WebMessagePort.WebMessageCallback() {
            override fun onMessage(sender: WebMessagePort, message: WebMessage) {
                if (sender !== port || webView.url != currentPage) return
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
            webView.removeCallbacks(fallback)
            greetButton.isEnabled = true
            sendToReact("ready")
            return
        }
        if (!greetButton.isEnabled) return

        when (type) {
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

    private fun sendToReact(type: String, key: String? = null, value: Any = JSONObject.NULL) {
        val payload = JSONObject().put("type", type)
        if (key != null) payload.put(key, value)
        port?.postMessage(WebMessage(payload.toString()))
    }

    override fun onDestroy() {
        webView.removeCallbacks(fallback)
        disconnect()
        (webView.parent as? ViewGroup)?.removeView(webView)
        webView.destroy()
        super.onDestroy()
    }

    private inner class DemoClient : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
            !request.isForMainFrame || request.url.toString() != currentPage

        override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
            disconnect()
        }

        override fun onPageFinished(view: WebView, url: String) {
            if (url == currentPage && view.url == currentPage && port == null) connect()
        }

        override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
            if (request.isForMainFrame && request.url.toString() == START_PAGE) loadOffline()
        }

        override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, error: WebResourceResponse) {
            if (request.isForMainFrame && request.url.toString() == START_PAGE) loadOffline()
        }

        override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
            val url = request.url.toString()
            return when (url) {
                START_PAGE, "$WEB_ORIGIN/analisis/main.css", "$WEB_ORIGIN/analisis/main.js" -> null
                OFFLINE_PAGE -> localAsset("index.html", "text/html")
                "$LOCAL_ORIGIN/toastlink/main.css" -> localAsset("main.css", "text/css")
                "$LOCAL_ORIGIN/toastlink/main.js" -> localAsset("main.js", "text/javascript")
                else -> WebResourceResponse(
                    "text/plain", "UTF-8", 404, "Not Found", emptyMap(), ByteArrayInputStream(byteArrayOf())
                )
            }
        }

        private fun localAsset(file: String, mimeType: String) =
            WebResourceResponse(mimeType, "UTF-8", assets.open("toastlink/$file"))
    }
}
