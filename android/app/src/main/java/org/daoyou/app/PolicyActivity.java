/**
 * [INPUT]: 用户协议与隐私政策静态文本
 * [OUTPUT]: 可滚动的协议阅读页面
 * [POS]: Android 壳层合规入口；不保存账号信息，不替代服务端隐私声明
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package org.daoyou.app;

import android.graphics.Color;
import android.os.Bundle;
import android.text.SpannableStringBuilder;
import android.text.style.StyleSpan;
import android.graphics.Typeface;
import android.view.ViewGroup;
import android.widget.ScrollView;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

public final class PolicyActivity extends AppCompatActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(Color.rgb(246, 240, 226));
        TextView text = new TextView(this);
        text.setTextColor(Color.rgb(27, 33, 31));
        text.setTextSize(16);
        text.setLineSpacing(8f, 1.15f);
        int padding = (int) (24 * getResources().getDisplayMetrics().density);
        text.setPadding(padding, padding, padding, padding);
        text.setText(buildPolicy());
        scroll.addView(text, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        setContentView(scroll);
        setTitle("道友协议");
    }

    private SpannableStringBuilder buildPolicy() {
        SpannableStringBuilder b = new SpannableStringBuilder();
        appendHeading(b, "道友用户协议\n");
        b.append("欢迎进入道友文字修仙世界。使用本应用前，请阅读并同意本协议。\n\n");
        appendHeading(b, "一、服务内容\n");
        b.append("道友提供角色创建、修炼、探索、垂钓、社交及相关文字游戏服务。游戏规则、活动内容和维护安排可能因版本更新调整。\n\n");
        appendHeading(b, "二、账号与安全\n");
        b.append("账号由登录邮箱、密码或其他已启用的认证方式管理。你应妥善保管登录凭据，不得转让、出租或利用他人账号。发现异常时请及时联系客服。\n\n");
        appendHeading(b, "三、行为规范\n");
        b.append("不得利用漏洞、脚本、自动化请求或其他方式破坏游戏公平性、干扰服务运行或侵犯他人权益。违规行为可能导致限制功能或终止服务。\n\n");
        appendHeading(b, "四、免责声明\n");
        b.append("因不可抗力、网络故障或第三方服务中断造成的暂时不可用，我们会尽力恢复并减少影响。\n\n");
        appendHeading(b, "道友隐私政策\n");
        b.append("我们处理以下必要信息：邮箱或登录标识，用于账号认证和找回；角色、资源和操作记录，用于保存游戏进度、防作弊和故障排查；设备与请求日志，用于安全审计和服务稳定性。我们不会出售个人信息。除法律要求、履行服务或获得你的明确授权外，不向无关第三方披露。你可以通过用户中心管理账号，或联系运营方申请查询、更正和删除。\n\n");
        b.append("协议版本：2026-09-14\n最后更新：2026-09-14");
        return b;
    }

    private void appendHeading(SpannableStringBuilder b, String heading) {
        int start = b.length();
        b.append(heading);
        b.setSpan(new StyleSpan(Typeface.BOLD), start, b.length(), 0);
    }
}
