# Fine Progressive Blur：Agent 交接记录

## 2026-09-10：Provider 静态源与共享全模糊纹理

Provider 新增 `sourceMode="live" | "static"`，默认 live。Static 冻结采集源，尺寸/DPR 与 `ref.refresh()` 更新；现有 DOM `onChange` 没有被重定义。同半径的默认全模糊 Overlay 在 Provider 内共享完整背景的降采样和两轴高斯结果，后续只裁切合成；direction/mask 仍走原有管线。`SurfaceOverlays` 统一生命周期，`requestOverlay(element)` 把局部几何变化与背景刷新分开，`StaticUniformCache` 负责结果和闲置历史预算。

Massive Blur 已从下面的单 Overlay 页面实验改回每张可见卡片独立 Overlay，使用 Provider static，图片 onLoad 调用 refresh。3 秒滚动中约 1,451 次普通合成绘制，两个后端的新增高斯、编码、拷贝、分配和背景上传均为 0。两种后端刷新/冻结/不同半径/DPR/live 切换及 48 组像素对照通过，最大误差 1/255；19 文件 / 81 测试通过。API、边界与新验证记录见 [静态源](static-source.md)。以下记录保留为实现历史。

## 2026-09-10：Massive Blur Dashboard

`/massiveblur` 已接入必应每日一图与十张可交互卡片。一个 Provider 加一个固定的默认全模糊 Overlay 共享整张背景的模糊结果；滚动只改变 Provider 外部的圆角裁剪，前景 DOM 在采集层之外。初版逐卡片移动 Overlay 触发全体 resize 重采样，约 3 秒产生 9,400 次 GPU 绘制；共享结果后 Rito / HTML-in-Canvas 在同段滚动中均为 0 次新增 WebGL 绘制、拷贝和分配，保留半径、图片、尺寸变更的正常更新。不要恢复逐卡片位置更新；同一固定背景和同一半径可以共享已有结果。

页面使用窗口滚动，提供半径、后端、DPR 和性能详情，滚动后有小型帧率浮窗。同源 Bing 图片接口仅接收受限 ID，失败保留明确标记的本地预览。说明和验证记录见 [Massive Blur](massive-blur.md)。没有为该页扩展组件的公开 API；lint / typecheck 与 18 文件 / 77 测试通过。

## 2026-09-10：Overlay 三种互斥模式

最新 API：`direction` 和 `mask` 均省略时默认全模糊；仅 `direction` 为原渐变管线；仅 `mask` 为二维蒙版管线。TypeScript 联合类型与运行时检查拒绝同时启用。全模糊不构造蒙版，通过单块图集按半径与 DPR 降采样，再运行固定半径卷积。全模糊和蒙版默认 `height="100%"`；渐变保持 100px。局部底部覆盖使用 `height` 加 `style={{ bottom: 0 }}`，`direction` 不再用于蒙版定位。`blurCurve` 只影响方向渐变。指标新增 `mode`，`direction` 为可选字段。

非渐变模式共享 `overlay-capture` 的外部邻域采集。全模糊的最终 shader 通过 `sampleRegion` 将大采样区裁回覆盖区域；渐变和图片对照默认使用完整采样区。演示增加无蒙版选项。以下蒙版扩展记录中的旧验证数据保留作为初始实现记录。

`observe-overlay-layout` 监听覆盖层的 style / class 几何变化，补足 ResizeObserver 对纯位置变化的遗漏；CSS 保底显示属性变化不会触发重采样。最终 lint / typecheck、17 文件 / 74 测试通过；96 组蒙版和 36 组全模糊 GPU 对照通过，两种后端、模式切换、底部定位和移动端 / CSS 保底均已验证。具体数据及软件 GPU 限制见 [三模式验证数据](benchmarks/overlay-modes-2026-09-10.json)。

## 2026-09-10：蒙版扩展（初始实现）

Overlay 新增 `mask`，保持 Provider / 原生内容 / Overlay 结构。无蒙版时原渐变管线不变；蒙版模式通过 `OverlayRenderer` 路由到 `mask/MaskBlurRenderer`，共享 `AtlasTexture` 和 `GaussianBlur`。二维块使用可选水平裁剪与固定 σ，蒙版 R8 纹理在最终合成阶段选择相邻高斯结果。蒙版区间分析与布局分开缓存，正文滚动不会重新切分。

公开 API、设计选择、输入更新和限制见 [Variable Blur](variable-blur.md)。不要将任意二维蒙版直接接入原来的逐行 Y→X 半径 shader。不要将 masked CSS 保底描述成真正的 variable blur。新增纯算法测试覆盖透明度、反转、小孔洞、棋盘格、奇数尺寸/DPR 和邻域；首页有独立蒙版示例及本地上传。

扩展后的验证：lint / typecheck、15 个文件 / 65 项测试通过，另有 96 组 GPU 对照及两种采集后端的浏览器集成检查。数值、测量限制和结果文件见上述文档；临时浏览器脚本在 `/tmp/fpb-mask-check`。蒙版区间分析约 1ms / 1024²，仅蒙版或尺寸变化时执行，未引入 Rust/WASM。

更新时间：2026-09-09\
当前分支：`main`  
最近提交：

- `92005e4 feat: expose compact gaussian blur experiment`
- `d6971f8 refactor: remove snapdom and enforce webgl backend policy`

这两个提交之后的实现基线已经验证通过；本交接文档随后作为独立文档提交。后续 agent 应从这两个提交之后继续，不要恢复已经删除的 SnapDOM 路径。

## 用户目标与已经确定的决策

这个项目是一个面向滚动内容上下边缘的 React / Next.js 渐变模糊组件。Provider 内的 DOM 保持真实 DOM，用于布局、滚动、输入、选区和无障碍；模糊覆盖层使用 GPU 纹理或浏览器 CSS 合成。

用户在本轮对话中逐步确定了以下约束：

1. 最初调研过 html2canvas、html-in-canvas、Rito 和 SnapDOM，后来明确要求剔除 SnapDOM。当前代码和依赖中不应重新引入 SnapDOM、html2canvas 或公开的通用 DOM 快照 adapter。
2. 采用渐进式增强：首屏默认 CSS，WebGL2 可用时尝试 **HTML-in-Canvas → Rito**。
3. 2026-09-09 用户要求取代原有 CSS 能力门槛。CSS 在首屏、初始化及没有有效 WebGL 帧时提供保底；Overlay 成功绘制首帧后以 `display: none` 同步关闭 CSS，失败/context loss 时恢复保底并保留原生正文。
4. Demo 可切换自动、HTML-in-Canvas 和 Rito；不提供强制 CSS 后端。图片对比区里的普通 CSS `blur()` 是视觉参考，不能删除，也不等同于 Provider fallback。
5. CSS 保底每个边缘最多 8 个不可点击层，半径指数递增，使用重叠 `mask-image`。失效帧恢复 CSS，直到新帧有效；显式 `fallback="transparent"` 时不创建 CSS 层。
6. `live` 模式不再使用固定采样频率限制。更新应由纹理内容变化、浏览器 paint 通知或 Rito 内容事件触发，并合并到动画帧；纹理内容没有变化时不应重复上传和重做模糊。
7. Demo 必须保留实验算法切换，最终算法尚未定案。稳定算法作为默认和参考，实验算法只用于性能/画质对比，不要在没有基准结果前替换默认值。
8. 模糊半径需要尽可能对齐 CSS `blur()` 的高斯标准差，减少噪点、采样率分区断层和纵向拉丝。当前管线已采用 sRGB、确定性高斯和 Y→X 渐变卷积顺序。

## 当前后端状态机

核心文件：

- [GradientBlurProvider.tsx](../components/gradient-blur/GradientBlurProvider.tsx)：创建能力探测、原生后端、Rito 后端和上下文。
- [webgl-support.ts](../components/gradient-blur/engine/webgl-support.ts)：客户端只探测一次 WebGL2；后续 context loss 不能被误判为“不支持 WebGL2”。
- [backend-policy.ts](../components/gradient-blur/engine/backend-policy.ts)：唯一的后端决策函数。
- [useNativeSurface.ts](../components/gradient-blur/native/useNativeSurface.ts)：HTML-in-Canvas 生命周期。
- [useRitoSurface.ts](../components/gradient-blur/rito/useRitoSurface.ts)：Rito 生命周期。
- [GradientBlurOverlay.tsx](../components/gradient-blur/GradientBlurOverlay.tsx)：默认输出 CSS 层；`useSurfaceOverlay` 根据当前注册实例的绘制状态控制滤镜栈的显示。

`GradientBlurBackend` 目前是：

```ts
"auto" | "html-in-canvas" | "rito";
```

`GradientBlurActiveBackend` 目前是：

```ts
"pending" | "html-in-canvas" | "rito" | "css" | "unavailable";
```

决策规则：

- `webgl === null`：`css`，服务器输出即包含 CSS 层。
- `webgl === false`：`css`，只启动 CSS fallback，不创建纹理后端。
- `webgl === true` 且原生 surface 就绪：`html-in-canvas`。
- `webgl === true` 且纹理后端正在初始化：`css`。
- `webgl === true` 且 Rito 就绪：`rito`。
- `webgl === true` 且 Rito 失败：`css`，保留原生 DOM 并恢复配置的保底。

`pending` / `unavailable` 保留在公开类型中以兼容既有调用方，当前后端策略不再发出这两个状态。纹理后端就绪不等于每个 Overlay 的首帧完成；CSS 的关闭由各 Overlay 的成功绘制通知控制。

原生后端切换或卸载时要保存并恢复 source 的 `scrollTop` / `scrollLeft`。这已经在 `NativeSurface` 中处理；修改 shadow host 时必须保留这个行为。

## 当前纹理与模糊管线

Provider 共享同一个 WebGL2 场景。Rito 用 Canvas 2D 绘制缓存正文块，再上传到同一上下文；HTML-in-Canvas 使用浏览器提供的 drawable tree。`SurfaceOverlay` 从场景 framebuffer 裁剪边缘区域，然后交给 [GradientBlurRenderer.ts](../components/gradient-blur/engine/GradientBlurRenderer.ts)。

当前稳定管线：

- `atlas-layout.ts` 按局部标准差、DPR 和 3σ 邻域创建 band，分辨率可从 1× 降到 1/128×。
- 捕获和裁剪对齐实际降采样纹素；奇数尺寸使用面积覆盖降采样，避免细线断层。
- 纹理先转换为编码 sRGB、预乘 Alpha 的 RGBA8，再使用高斯分离卷积。
- 渐变半径先沿 Y、再沿 X，避免 X→Y 带来的纵向拉丝；固定半径可融合垂直 pass。
- `GradientBlurProfile.blurCurve` 可选传入 CSS cubic-bezier 四个控制点；它统一作用于 WebGL、Rito 和 CSS 保底的渐变半径映射，未传入时保持 smootherstep 默认行为。
- 高斯算法固定最多 9 次双线性读取/轴（中心 + 4 组相邻权重）。权重在 CPU 侧缓存，shader 不使用随机噪点。
- band 边界使用连续阈值和混合，不使用固定 2px 接缝。
- 纹理、radius、algorithm 没有变化时复用已完成的高斯结果；内容不变时 Rito 不重画正文块、不上传、不重做视口模糊。
- `SurfaceOverlay` 可按内容版本、文档视口、选区、方向、半径和算法保留最多 3 个已完成的模糊渲染器；命中时复用 GPU 图集与卷积结果。Rito 的 live 连续滚动会复用一个活动 renderer 并持续更新图集，避免 viewport key 每帧变化导致 GPU 资源 churn；HTML-in-Canvas 不使用该窗口缓存。

关键接口边界：

- [BlurSurface](../components/gradient-blur/engine/blur-surface.ts) 只负责注册 overlay、请求更新和设置半径。
- [SurfaceOverlay](../components/gradient-blur/engine/surface-overlay.ts) 管理 atlas、上传指标和最终绘制。
- [SceneTiles](../components/gradient-blur/rito/scene-tiles.ts) 只缓存 Rito 正文内容；它目前缓存的是未模糊正文纹理。
- [RitoSurface](../components/gradient-blur/rito/rito-surface.ts) 处理 DOM 场景读取、滚动、选区、内容变化和缓存块。

## Demo 与实验算法

Demo 状态在 [GradientBlurDemo.tsx](../features/demo/GradientBlurDemo.tsx) 中维护，算法固定为 compact9，由 [BlurControls.tsx](../features/demo/BlurControls.tsx) 暴露，并同步给 Provider、两个 Overlay 和图片对比区。

当前类型：

```ts
type GradientBlurAlgorithm = "compact9";
```

- `compact9`：唯一算法，最多中心 + 4 组双线性读取，也就是最多 9 个有效采样点。
- `compact9`：实验值，最多中心 + 4 组双线性读取，也就是最多 9 个有效采样点。它通过截断远端尾部降低开销，可能降低大半径画质；当前不能称为最终算法。

实验算法通过 `GradientBlurProfile.algorithm` 进入 `GaussianBlur` 和 `GradientBlurRenderer`，并包含在过滤缓存 key 中。若新增算法，必须同时更新：

1. `GradientBlurAlgorithm` 类型和 Provider/Overlay 传递链。
2. `GaussianBlur` 的 shader 参数、kernel 缓存 key 和 `GradientBlurMetrics.sampleCount`。
3. 图片对比区的 `UniformImageRenderer` / `useImageComparison`。
4. Demo 的算法选择说明和运行时诊断。
5. 单元测试、CSS 对齐截图和 GPU 性能基准。

需要继续测量半径 1、4、12、28、48，DPR 1/2，照片和高频条纹，校准截断尾部带来的误差。

## Apple / Metal 调研结论

调研记录在 [apple-blur-research.md](apple-blur-research.md)，MPS 独立基准和结果在：

- [benchmark-apple-blur.swift](../scripts/benchmark-apple-blur.swift)
- [apple-mps-m4-2026-09-08.json](benchmarks/apple-mps-m4-2026-09-08.json)

目前能确认的是公开的 MPS/Metal 路径支持高效的分离卷积、纹理/中间目标复用、低分辨率工作纹理和 GPU 内存管理；无法从公开资料证明 Apple UI 使用某个完全相同的私有模糊 kernel。MPS 测量存在明显波动，不能直接当作 WebKit/Core Animation UI 的耗时承诺。

后续最值得验证的方向是 **按文档坐标缓存多尺度预模糊 tile**：

- Rito 现在只缓存未模糊 tile，滚动时仍会对边缘重新做模糊。
- 可以按半径等级缓存带 halo 的预模糊 tile，普通滚动只改变采样窗口。
- 内容变化应按 tile + blur halo 失效；sticky、嵌套滚动、选区和焦点需要单独处理。
- 需要明确 GPU 内存预算、淘汰策略和相邻半径等级的混合误差。
- 先做独立 benchmark 和截图误差评估，再合并到稳定路径。

不要把“Apple 设备开销低”直接等同于“多层 CSS”或“零拷贝”。当前 Canvas 2D → GPU 的 Rito 首次/变更上传仍然存在，项目文档不应声称浏览器内部严格零拷贝。

## 历史问题与已采取的修复

- Via 检测到 WebGL2 后模糊区黑色：真机复现为 `RenderTarget` 在纹理存储分配前挂载附件，framebuffer 持续返回 `0x8cd7`。已改为分配后挂载并检查完整性，尺寸未变化时直接复用；生产构建、Via 刷新、滑动及失败保底均已验证。详见 [Via 排查记录](via-webgl-framebuffer.md)。
- html2canvas/SnapDOM 捕获慢：已移除快照后端，Rito 作为原生路径失败后的 WebGL 后端。
- `live` 固定 FPS 限制：已删除，改为内容事件、paint 通知和队列背压。
- 纹理内容未变化仍重复上传：Rito 使用 DOM 脏标记、内容签名和 tile halo，静止时跳过 Canvas 2D、candidate 上传与模糊。
- 不同采样率拼接断层：band 捕获网格对齐降采样像素，使用连续阈值和混合 halo。
- 渐变模糊纵向拉丝：渐变卷积顺序改为 Y→X，并修复底部镜像/奇数高度的采样坐标。
- 随机噪点：移除旧的随机旋转/蓝噪点路径，改为确定性高斯权重。
- CSS 半径不一致：组件把 `maxRadius` 定义为 CSS `blur()` 同义的高斯标准差，并在 sRGB 中混合。
- 后端切换滚动位置丢失：原生 shadow host 重建前后保存并恢复滚动位置。
- SnapDOM 的 inline/table-cell warning：该依赖和调用链已经删除；旧 warning 不再是当前实现的运行时问题。

## Rito 的限制

Rito 是受限的 DOM 绘制器，不是浏览器完整 CSS 的替代品。复杂 filter/mask/mix-blend、inset shadow、复杂背景、生成内容、foreignObject、部分 SVG、嵌入控件、iframe、video、Shadow DOM、显式 RTL/纵向排版等可能无法绘制。

在 WebGL2 可用时遇到这些内容，正确行为是：

1. 记录 `data-rito-error`。
2. active backend 变为 `css`。
3. 释放 Rito 呈现 Canvas，保留原生正文。
4. 恢复配置的 CSS/透明保底。

当前提取代码位于 `components/gradient-blur/rito/`，其中 `vendor/` 保留上游代码、`LICENSE` 和 `UPSTREAM.md`。不要在没有重新确认许可证边界的情况下大规模改写 vendor 文件。

## 验证基线

提交前至少运行：

```bash
pnpm typecheck
pnpm lint
pnpm test
```

当前基线：12 个测试文件、51 个测试通过。浏览器验证还覆盖：

- Rito 后端初始化、滚动、选区、按钮交互和内容更新。
- HTML-in-Canvas 原生模式和自动模式的优先级。
- 原生失败后自动转 Rito。
- 无 WebGL2 时仅 CSS 保底，且不创建纹理 Canvas。
- 禁用 JavaScript 的服务器输出、Rito 初始化等待时显示 CSS；原生/Rito 首帧完成后 CSS 滤镜栈为 `display: none`。
- WebGL2 可用但 Rito 不支持内容时恢复 CSS 保底。
- context loss、后端来回切换、滚动位置和窄屏布局。
- 图片对比区半径变化、原图切换、DPR 1/2 和 CSS 参考图。
- 运行时固定显示 9 次采样上限。

浏览器验证脚本位于临时目录 `/tmp/fpb-browser-check`，不是仓库资产。若脚本不存在，使用 Playwright 重新编写等价场景；不要把临时依赖提交进项目。

## 后续工作顺序

1. 对 `compact9` 做照片、高频条纹和文本截图对齐，记录 MAE、最大误差、band 接缝误差和 GPU 时间。
2. 仅当实验算法在目标半径和设备上画质可接受时，才考虑调整默认算法；否则保留为实验选项。
3. 优先研究 Rito 文档坐标的预模糊多尺度 tile 缓存，先用独立 benchmark 验证滚动收益和显存成本。
4. 处理缓存失效 halo、sticky/嵌套滚动、选区/焦点和动态 Canvas 的边界。
5. 保持渐进式增强：有效 WebGL 帧完成后才关闭 CSS；首屏、失效和切换期间保留配置的保底。
6. 每次改动后同步 README、`docs/rito-renderer.md`、本交接文档和测试基线，避免把历史 SnapDOM 描述重新写回当前架构。

## 给下一位 agent 的启动提示

开始工作前先阅读：

1. `AGENTS.md` 和项目根目录的开发规则。
2. 本文件。
3. `README.md` 的当前 API/后端策略。
4. 与任务直接相关的 `docs/apple-blur-research.md`、`docs/css-blur-alignment.md` 或 `docs/rito-renderer.md`。

先运行 `git status --short`、`git log --oneline -5`、`pnpm typecheck`、`pnpm lint`、`pnpm test`，确认基线后再修改。除非用户明确要求，不要重新引入 SnapDOM、通用 DOM 快照 adapter 或固定 live FPS。CSS 采用上面的渐进式增强策略。
