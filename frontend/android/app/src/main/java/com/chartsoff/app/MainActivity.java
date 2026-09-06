package com.chartsoff.app;

import android.os.Bundle;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Disable WebView overscroll glow/stretch effect for native feel
        WebView webView = getBridge().getWebView();
        webView.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
    }
}
