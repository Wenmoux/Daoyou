/**
 * [INPUT]: 本地协议同意偏好与用户点击
 * [OUTPUT]: 道友首启“入道”页，确认协议后进入 Web 登录/注册页
 * [POS]: Android 壳层的合规入口；不承载认证、角色和游戏业务
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package org.daoyou.app;

import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Bundle;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;
import android.text.style.StyleSpan;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

public final class ConsentActivity extends AppCompatActivity {
    private static final String PREFS = "daoyou_app";
    private static final String CONSENT_ACCEPTED = "consent_accepted";
    private static final int INK = Color.rgb(27, 33, 31);
    private static final int MUTED = Color.rgb(109, 116, 109);
    private static final int PAPER = Color.rgb(246, 240, 226);
    private static final int PAPER_DEEP = Color.rgb(232, 221, 200);
    private static final int VERMILION = Color.rgb(158, 59, 47);

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (hasConsent()) {
            openWebApp();
            return;
        }
        setContentView(buildContent());
    }

    private boolean hasConsent() {
        return getSharedPreferences(PREFS, MODE_PRIVATE).getBoolean(CONSENT_ACCEPTED, false);
    }

    private View buildContent() {
        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(PAPER);
        scroll.setFillViewport(true);

        LinearLayout page = new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        page.setGravity(Gravity.CENTER_HORIZONTAL);
        int padding = dp(24);
        page.setPadding(padding, dp(42), padding, dp(24));

        TextView seal = text("道友", 38, INK, Typeface.BOLD);
        seal.setGravity(Gravity.CENTER);
        seal.setBackgroundResource(org.daoyou.app.R.drawable.card_paper);
        LinearLayout.LayoutParams sealParams = new LinearLayout.LayoutParams(dp(96), dp(96));
        sealParams.gravity = Gravity.CENTER_HORIZONTAL;
        page.addView(seal, sealParams);

        TextView title = text("一念入道，万界同行", 24, INK, Typeface.BOLD);
        title.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        titleParams.topMargin = dp(24);
        page.addView(title, titleParams);

        TextView lead = text("文字修仙 · 角色成长 · 山海垂钓", 13, MUTED, Typeface.NORMAL);
        lead.setGravity(Gravity.CENTER);
        page.addView(lead, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        TextView divider = text("────────────────────", 12, Color.rgb(190, 174, 149), Typeface.NORMAL);
        divider.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams dividerParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        dividerParams.topMargin = dp(20);
        dividerParams.bottomMargin = dp(16);
        page.addView(divider, dividerParams);

        TextView intro = text("欢迎进入道友的修仙世界。登录或注册前，请阅读并同意用户协议与隐私政策。我们仅处理账号认证、游戏存档、服务安全和客服支持所需的信息。", 15, INK, Typeface.NORMAL);
        intro.setLineSpacing(dp(4), 1.12f);
        intro.setBackgroundResource(org.daoyou.app.R.drawable.card_paper);
        page.addView(intro, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        LinearLayout links = new LinearLayout(this);
        links.setGravity(Gravity.CENTER);
        links.setPadding(0, dp(18), 0, dp(8));
        TextView terms = link("用户协议");
        terms.setOnClickListener(v -> openPolicy());
        TextView separator = text("  ·  ", 14, MUTED, Typeface.NORMAL);
        TextView privacy = link("隐私政策");
        privacy.setOnClickListener(v -> openPolicy());
        links.addView(terms);
        links.addView(separator);
        links.addView(privacy);
        page.addView(links, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        CheckBox consent = new CheckBox(this);
        consent.setText("我已阅读并同意《用户协议》和《隐私政策》");
        consent.setTextColor(INK);
        consent.setTextSize(14);
        consent.setButtonTintList(new android.content.res.ColorStateList(
                new int[][] { new int[] { android.R.attr.state_checked }, new int[] {} },
                new int[] { VERMILION, MUTED }
        ));
        page.addView(consent, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        Button enter = button("同意并进入道友", VERMILION, Color.WHITE);
        enter.setEnabled(false);
        enter.setAlpha(0.45f);
        consent.setOnCheckedChangeListener((view, checked) -> {
            enter.setEnabled(checked);
            enter.setAlpha(checked ? 1f : 0.45f);
        });
        enter.setOnClickListener(v -> {
            getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean(CONSENT_ACCEPTED, true).apply();
            openWebApp();
        });
        LinearLayout.LayoutParams enterParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(52));
        enterParams.topMargin = dp(18);
        page.addView(enter, enterParams);

        Button exit = button("暂不进入", PAPER_DEEP, INK);
        exit.setOnClickListener(v -> finish());
        LinearLayout.LayoutParams exitParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(48));
        exitParams.topMargin = dp(8);
        page.addView(exit, exitParams);

        TextView version = text("道友 · 文字修仙  0.1.0", 12, MUTED, Typeface.NORMAL);
        version.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams versionParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        versionParams.topMargin = dp(20);
        page.addView(version, versionParams);
        scroll.addView(page);
        return scroll;
    }

    private TextView text(String value, float size, int color, int style) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(size);
        view.setTextColor(color);
        view.setTypeface(Typeface.create(Typeface.SANS_SERIF, style));
        return view;
    }

    private TextView link(String value) {
        TextView view = text(value, 14, VERMILION, Typeface.BOLD);
        view.setPadding(dp(4), dp(4), dp(4), dp(4));
        return view;
    }

    private Button button(String value, int backgroundColor, int textColor) {
        Button button = new Button(this);
        button.setText(value);
        button.setTextSize(15);
        button.setTextColor(textColor);
        button.setAllCaps(false);
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        button.setBackgroundColor(backgroundColor);
        return button;
    }

    private void openPolicy() {
        startActivity(new Intent(this, PolicyActivity.class));
    }

    private void openWebApp() {
        startActivity(new Intent(this, MainActivity.class));
        finish();
    }

    private int dp(int value) {
        return (int) (value * getResources().getDisplayMetrics().density + 0.5f);
    }
}
