# 道友 Android App

这是参考 `taoyuan-2.4.0.APK` 的 WebView/Capacitor 类壳层实现。App 本身负责协议确认、登录态 Cookie、返回键和外链边界；登录、注册、邮箱验证码、密码认证、游戏存档和 Telegram 绑定继续复用道友现有 Web/API。

本次已在 Windows 环境实际生成并校验 `app-debug.apk`；应用启动后先进入“入道”协议页，勾选同意后加载现有 `/login`。

## 打包

用 Android Studio 打开本目录，等待 Gradle 同步后选择 `app` 运行或生成 APK。命令行环境需要 JDK 17、Android SDK 35 和 Gradle 8.x：

```bash
./gradlew :app:assembleDebug
./gradlew :app:assembleRelease -PdaoyouWebUrl=https://client.daoyou.org/login
```

输出位于 `app/build/outputs/apk/{debug,release}/`。测试服务器可以替换地址：

```bash
./gradlew :app:assembleDebug -PdaoyouWebUrl=https://测试前端域名/login
```

测试域名必须在 API 的 `PUBLIC_WEB_ORIGINS` 中允许，否则登录写请求会被 Origin Guard 拒绝。生产环境只使用 HTTPS；壳层默认禁止明文网络。

## 首次启动

首次启动先展示《道友用户协议》和《道友隐私政策》确认页；同意后进入 `/login`。登录页继续提供邮箱验证码、密码登录和注册入口，账号体系与网页端一致。协议同意状态只保存在当前设备，清除 App 数据后会再次确认。

## 安全边界

- WebView 只允许配置的道友前端域名继续导航，其他链接交给系统浏览器。
- Telegram Bot token、数据库凭据和 API 私钥不进入 APK。
- WebView 仅保存认证所需 Cookie/Storage，不在原生层复制登录凭据。
