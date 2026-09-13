# 道友 Android App 打包说明

> [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

`android/` 是道友移动端壳层，参考了 `taoyuan-2.4.0.APK` 的 Capacitor 资源组织方式，但没有复制其代码或资源。原生层只做启动协议、WebView 和安全边界，避免 Android 与 Web 端出现两套登录注册逻辑。

App 首次启动显示协议确认；确认后加载 `https://client.daoyou.org/login`，因此邮箱验证码、密码注册、找回密码和后续游戏功能自动跟随线上 Web 版本。用户在网页端生成 Telegram 绑定密钥后，仍可在 App 内进入用户中心完成绑定流程。

本机没有 Android SDK/Gradle 时，不能在开发容器直接生成 APK；将 `android/` 导入 Android Studio，或在带 JDK 17、Android SDK 35 和 Gradle 8.x 的 CI runner 执行：

```bash
./gradlew :app:assembleRelease -PdaoyouWebUrl=https://client.daoyou.org/login
```

发布 APK 前需要配置正式签名、应用商店隐私声明和实际运营主体信息；当前工程默认只生成未签名 release 产物，避免把私钥提交到仓库。
