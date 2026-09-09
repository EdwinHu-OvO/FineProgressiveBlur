# Fine Progressive Blur

面向滚动内容边缘的 React / Next.js 渐变模糊组件。顶部和底部使用连续半径，保留原生滚动、交互与无障碍语义。

## 开发

```bash
pnpm install
pnpm dev
```

打开 <http://localhost:3000>。常规检查：`pnpm lint`、`pnpm typecheck`、`pnpm test`。

## 使用

```tsx
import {
  GradientBlurOverlay,
  GradientBlurProvider,
} from "@/components/gradient-blur";

export function ScrollSurface() {
  return (
    <GradientBlurProvider captureBackend="auto">
      <GradientBlurOverlay
        direction="top"
        height={100}
        maxRadius={24}
        blurCurve={{ x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 }}
      />
      <div className="scroll-container" data-gradient-blur-source>
        {/* 原生滚动内容 */}
      </div>
      <GradientBlurOverlay direction="bottom" height={100} maxRadius={24} />
    </GradientBlurProvider>
  );
}
```

Provider 需要稳定、可计算的尺寸。采集源优先使用 `sourceRef`，其次寻找直接子元素 `[data-gradient-blur-source]`，最后使用第一个非 Overlay 子元素。Overlay 绝对定位，不参与布局，默认穿透指针事件。

`blurCurve` 使用 CSS `cubic-bezier(x1, y1, x2, y2)` 的四个控制点，输入位置是从模糊外缘到正文接缝的归一化进度。曲线输出 0 代表保持 `maxRadius`，输出 1 代表半径降为 0；未传入时使用内置 smootherstep 曲线。`x1`、`x2` 会限制在 0–1，`y1`、`y2` 允许 CSS 式过冲。

### Provider

| 属性                  | 类型                                   | 默认值   | 说明                                                    |
| --------------------- | -------------------------------------- | -------- | ------------------------------------------------------- |
| `sourceRef`           | `RefObject<HTMLElement \| null>`       | —        | Provider 内的正文容器                                   |
| `captureBackend`      | `"auto" \| "html-in-canvas" \| "rito"` | `"auto"` | 首选渲染路径                                            |
| `onBackendChange`     | `(backend) => void`                    | —        | `css`、`html-in-canvas`、`rito`；纹理后端就绪后报告切换 |
| `maxDevicePixelRatio` | `number`                               | `2`      | 最大纹理 DPR，限制在 1–3                                |
| `fallback`            | `"css" \| "transparent"`               | `"css"`  | 首屏及 WebGL 帧未就绪时的基础效果                       |

通过 ref 调用 `refresh()` 可以标记现有后端的内容，刷新命令式 Canvas/CSSOM 变化；后端尚未建立时会重试初始化。正文节点与滚动位置保留。

### Overlay

| 属性              | 类型                                | 默认值   | 说明                                               |
| ----------------- | ----------------------------------- | -------- | -------------------------------------------------- |
| `direction`       | `"top" \| "bottom"`                 | 必填     | 覆盖的边缘                                         |
| `height`          | `number \| string`                  | `100`    | 覆盖高度                                           |
| `maxRadius`       | `number`                            | `24`     | 外侧最大高斯标准差，单位 CSS px                    |
| `blurCurve`       | `{ x1, y1, x2, y2 }`                | —        | 可选 CSS `cubic-bezier()` 控制点，改变半径衰减曲线 |
| `captureStrategy` | `"static" \| "scrollend" \| "live"` | `"live"` | 纹理更新时机                                       |
| `onMetrics`       | `(metrics) => void`                 | —        | 图集、上传与渲染指标                               |

## 后端策略

组件采用渐进式增强：**默认 CSS → WebGL 管线就绪后接管**。自动模式的纹理后端优先级为 **HTML-in-Canvas → Rito**：

- **能创建 WebGL2 上下文**：优先 HTML-in-Canvas，原生 API 不可用、布局不适用或原生路径失败时使用 Rito。显式选择 `rito` 可跳过原生尝试。
- **不能创建 WebGL2 上下文**：启用配置的 CSS/透明保底，不启动纹理后端。
- **初始化或首帧等待**：保持配置的 CSS/透明保底。每个 Overlay 成功绘制首帧后同步以 `display: none` 关闭其 CSS 滤镜层，避免双重模糊。
- **绘制失败或 context loss**：释放失效的呈现 Canvas，保留原生正文并恢复保底；自动模式仍可从原生后端转向 Rito。没有就绪的纹理后端时报告 `css`，错误原因保留在 Provider 的诊断属性中。

服务器输出和 hydration 初始状态就包含 CSS 层，禁用 JavaScript 时也可显示基础模糊。能力检查只在客户端执行一次；不会将后续的渲染错误当成设备缺少 WebGL。后端切换或 Overlay 重新注册会恢复 CSS，直到新的有效帧完成。`fallback="transparent"` 显式关闭所有这些阶段的 CSS 保底。

演示页提供自动、HTML-in-Canvas 和 Rito 切换，不提供强制 CSS 选项。下方图片区域的普通 CSS blur 是视觉参考，独立于 Provider 的保底策略。

SnapDOM、快照采集器与公开的 `captureAdapter` / Canvas adapter 接口已移除。原生路径面向块级 Provider，Overlay 应为直接子元素；Rito 的支持范围见 [接入说明](docs/rito-renderer.md)。原生能力依赖实验性的 [HTML-in-Canvas API](https://github.com/WICG/html-in-canvas)。

### CSS 保底

使用 Layered Backdrop-Filter Stack，每个边缘最多 8 层不可点击的绝对定位元素，半径从 `Rmax / 128` 逐层翻倍到 `Rmax`。每层拥有重叠的 `mask-image`，顶部与底部互为镜像。零半径不创建滤镜层；不为容器增加整体 mask 或透明度动画。

## 内容更新

`live` 无固定采样间隔。事件合并到动画帧，只保留一个在途任务和最新待处理变化；页面不可见时暂停。

- 原生路径监听浏览器的 `paint.changedElements`，静止时不定时请求快照。
- Rito 读取浏览器布局并用提取的 Canvas 绘制器缓存正文块。缓存内普通滚动只改变 GPU 取样窗口，不重画或上传正文；live 路径在可稳定标识窗口的适配器上保留最多 3 个已完成模糊结果，Rito 的连续滚动则复用活动 renderer 并持续更新图集，避免每帧创建 GPU 资源。
- 内容变化先按绘制指令检查受影响块；未变化的块跳过 Canvas 2D 与 candidate 上传，变化块在 accepted/candidate 双纹理间原子交换，没有 CPU 图像读回。
- 选区与焦点在 GPU 合成；嵌套滚动和 sticky 内容需要更新受影响的缓存块。动态 Canvas 可显式调用 `refresh()`。

`scrollend` 在滚动停止后更新 WebGL 模糊，等待时使用配置的保底。`static` 只在初始化、尺寸变化和手动刷新时更新；过期的 WebGL 模糊隐藏并恢复保底，直到下一次有效帧。

## 模糊管线

1. Provider 共用一个 WebGL2 场景与正文纹理，边缘从 GPU 场景裁剪，不向 CPU 读回。
2. 按局部标准差与 DPR 将边缘拆成最多 8 个 Atlas band，分辨率从 1× 到 1/128×。保留混合区及 3σ 邻域，裁切对齐真实的降采样纹素，避免拉伸；零半径保持原始分辨率。
3. 将 sRGB 场景转换为编码 sRGB、预乘 Alpha 的 RGBA8 缓冲，再逐级降采样。奇数尺寸按源像素覆盖面积滤波，减少细线混叠。各 band 共享降采样结果。
4. 渐变模式先纵向、再横向高斯卷积，使每一行的两个方向使用相同 σ，避免纵向拉丝。合并相邻权重后每轴最多 9 次双线性采样，扣除重采样引入的近似方差。固定半径在 CPU 预计算权重；原始分辨率时将纵向卷积合入最终输出。
5. 较粗一级的 σ 从 2 降到 1.5 texel 时平滑混入下一档。最终通常读取 1–2 次，并以不透明颜色覆盖正文，避免二次混合；纹理与参数不变时复用卷积结果。

当前只保留 `compact9`：中心加四组双线性采样，即每轴最多 9 次有效采样；渐变权重递推使用范围缩减的五阶多项式近似 `exp(-x)`。

`maxRadius` 与 [CSS blur()](https://www.w3.org/TR/filter-effects-1/#funcdef-filter-blur) 同样表示高斯标准差。无随机采样噪点，使用 sRGB 混合以接近 CSS；降采样与浏览器实现仍会带来偏差。见 [CSS 模糊校准](docs/css-blur-alignment.md) 与 [Apple 模糊调研](docs/apple-blur-research.md)。

`onMetrics` 的 `savedRatio` 只比较边缘图集和原始条带，不代表总显存或上传节省。总资源另含正文、降采样与高斯中间缓冲，Rito 的内容块估算预算为 64 MiB。计时是 JS 提交耗时，不是 GPU 完成时间。Canvas 2D 的首次与变更上传仍然存在，不承诺浏览器内部零拷贝。

## 图片模糊对照

演示页 `#image-blur-comparison` 使用同一张本地照片、裁切与边缘延展，并排比较组件算法与普通 CSS `filter: blur()`。固定半径 0–48px，没有渐变或空间分区；「查看原图」同步归零。

半径变化复用源纹理，跨降采样档位只在 GPU 重建图集；图片加载、尺寸/DPR 变化和上下文恢复时才重新上传图片。WebGL2 不可用时左侧明确显示不可用，右侧 CSS 参考图仍可查看。见 [图片署名](public/images/ATTRIBUTION.md)。

## GPU 基准

打开 `/benchmark` 可运行浏览器端 GPU 基准。工具优先使用可选的 `EXT_disjoint_timer_query_webgl2` 测量生产渐变渲染路径；没有该扩展时自动使用包含 `gl.finish()` 的墙钟计时。每次重新上传图集以强制执行卷积；结果以中位数和 P10–P90 范围显示，并可下载 JSON。

## 许可证

仓库原有代码使用 MIT。Rito 提取模块沿用 **AGPL-3.0-only**；上游提交、提取清单、本地改动与完整许可证保存在 [UPSTREAM.md](components/gradient-blur/rito/vendor/UPSTREAM.md) 和 [LICENSE](components/gradient-blur/rito/vendor/LICENSE)。
