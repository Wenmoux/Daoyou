/**
 * [INPUT]: Android 生命周期、BuildConfig.DAOYOU_WEB_URL 与用户协议偏好
 * [OUTPUT]: 道友 Android WebView 容器，复用现有登录、注册和游戏页面
 * [POS]: Android 壳层入口；不承载认证和游戏业务，所有账号状态由 Web API 管理
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package org.daoyou.app;

import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;

public final class MainActivity extends AppCompatActivity {
    private static final String ALLOWED_HOST = "client.daoyou.org";
    private WebView webView;
    private String appHost;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        openWebApp();
    }

    private void openWebApp() {
        webView = new WebView(this);
        appHost = Uri.parse(BuildConfig.DAOYOU_WEB_URL).getHost();
        webView.setBackgroundColor(0xFFF6F0E2);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setDatabaseEnabled(true);
        webView.getSettings().setMediaPlaybackRequiresUserGesture(true);
        webView.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);
        webView.setWebViewClient(new SecureWebViewClient());
        setContentView(webView);
        webView.loadUrl(BuildConfig.DAOYOU_WEB_URL);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack(); else finish();
            }
        });
    }

    private final class SecureWebViewClient extends WebViewClient {
        @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return handleUrl(view, request.getUrl());
        }

        @Override public boolean shouldOverrideUrlLoading(WebView view, String url) {
            return handleUrl(view, Uri.parse(url));
        }

        private boolean handleUrl(WebView view, Uri uri) {
            if ("https".equalsIgnoreCase(uri.getScheme()) && isAllowedHost(uri.getHost())) {
                return false;
            }
            if ("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme())) {
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
            }
            return true;
        }

        private boolean isAllowedHost(String host) {
            return host != null && (host.equalsIgnoreCase(ALLOWED_HOST)
                    || (appHost != null && host.equalsIgnoreCase(appHost)));
        }

        @Override public void onPageStarted(WebView view, String url, Bitmap favicon) {
            super.onPageStarted(view, url, favicon);
            view.setAlpha(0.96f);
        }

        @Override public void onPageFinished(WebView view, String url) {
            super.onPageFinished(view, url);
            view.animate().alpha(1f).setDuration(180L).start();
        }
    }

    @Override protected void onPause() {
        CookieManager.getInstance().flush();
        super.onPause();
    }

    @Override protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.setWebViewClient(null);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
