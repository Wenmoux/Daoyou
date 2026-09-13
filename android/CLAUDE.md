# android/
> L2 | 父级: ../CLAUDE.md

Android 原生壳层；负责应用启动协议确认、WebView 登录态、返回键和外链安全，业务认证与游戏状态仍由 React/Hono 服务提供。

成员清单
app/src/main/java/org/daoyou/app/MainActivity.java: 协议确认、WebView 容器、Cookie/返回键和 URL 安全边界。
app/src/main/java/org/daoyou/app/PolicyActivity.java: 用户协议与隐私政策的可滚动文字页面。
app/src/main/res/values/: 应用主题、颜色、字符串和尺寸。
app/src/main/res/drawable/: 文字游戏风格应用图标和启动背景。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
