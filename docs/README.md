# 文档索引

- [Agent 交接记录](AGENT-HANDOFF.md)：当前架构、用户决策、提交基线、实验算法和后续开发顺序。新 agent 应先阅读。
- [Apple 模糊调研](apple-blur-research.md)：公开 Metal/MPS、Core Animation/WebKit 线索和本地 M4 基准。
- [Rito 后端接入](rito-renderer.md)：Rito DOM 绘制、缓存、交互和限制。
- [Variable Blur](variable-blur.md)：全模糊 / 方向渐变 / 蒙版的互斥 API、二维分块、半径插值、缓存和保底限制。
- [Massive Blur Dashboard](massive-blur.md)：每日图片、共享背景上的滚动卡片、可见区域跟踪与性能读数。
- [Provider 静态背景](static-source.md)：sourceMode、显式刷新与多个 Overlay 共享预模糊纹理。
- [纹理获取调研](texture-capture-research.md)：HTML-in-Canvas、Rito 和历史捕获方案的调研资料；其中历史方案描述不代表当前依赖。
- [CSS 模糊校准](css-blur-alignment.md)：CSS `blur()` 对齐方法和截图误差记录。
- [基准数据](benchmarks/)：可复现或已提交的性能数据。
