package com.bemtorres.webdroidbridgeapp

import android.content.res.AssetManager
import android.os.BatteryManager
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
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

private const val LOCAL_ORIGIN = "https://appassets.androidplatform.net"
private const val START_PAGE = "$LOCAL_ORIGIN/toastlink/index.html"

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var greetButton: Button
    private var reactReady = false

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
        }
        webView.webViewClient = LocalContentClient(assets)
        webView.addJavascriptInterface(ToastLinkBridge(), "ToastLinkAndroid")
        webView.loadUrl(START_PAGE)
    }

    private fun sendToReact(type: String, key: String? = null, value: Any = JSONObject.NULL) {
        if (!reactReady || isDestroyed) return

        val payload = JSONObject().put("type", type)
        if (key != null) payload.put(key, value)
        webView.evaluateJavascript(
            "window.dispatchEvent(new CustomEvent('toastlink:android', { detail: $payload }));",
            null
        )
    }

    override fun onDestroy() {
        reactReady = false
        webView.removeJavascriptInterface("ToastLinkAndroid")
        (webView.parent as? ViewGroup)?.removeView(webView)
        webView.destroy()
        super.onDestroy()
    }

    private inner class ToastLinkBridge {
        @JavascriptInterface
        fun ready() {
            runOnUiThread {
                if (!isDestroyed) {
                    reactReady = true
                    greetButton.isEnabled = true
                }
            }
        }

        @JavascriptInterface
        fun showToast(message: String) {
            val text = message.trim().take(120)
            if (text.isEmpty()) return

            runOnUiThread {
                if (reactReady && !isDestroyed) {
                    Toast.makeText(this@MainActivity, text, Toast.LENGTH_SHORT).show()
                    sendToReact("toastShown")
                }
            }
        }

        @JavascriptInterface
        fun requestBattery() {
            runOnUiThread {
                if (reactReady && !isDestroyed) {
                    val percent = getSystemService(BatteryManager::class.java)
                        ?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
                        ?.takeIf { it in 0..100 }
                    sendToReact("battery", "percent", percent ?: JSONObject.NULL)
                }
            }
        }
    }
}

private class LocalContentClient(private val assets: AssetManager) : WebViewClient() {
    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean = true

    override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse {
        val url = request.url.toString()
        val mimeType = when (url) {
            START_PAGE -> "text/html"
            "$LOCAL_ORIGIN/toastlink/main.css" -> "text/css"
            "$LOCAL_ORIGIN/toastlink/main.js" -> "text/javascript"
            else -> return WebResourceResponse(
                "text/plain", "UTF-8", 404, "Not Found", emptyMap(), ByteArrayInputStream(byteArrayOf())
            )
        }
        return WebResourceResponse(mimeType, "UTF-8", assets.open(url.removePrefix("$LOCAL_ORIGIN/")))
    }
}
