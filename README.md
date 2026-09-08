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
      <GradientBlurOverlay direction="top" height={100} maxRadius={24} />
      <div className="scroll-container" data-gradient-blur-source>
        {/* 原生滚动内容 */}
      </div>
      <GradientBlurOverlay direction="bottom" height={100} maxRadius={24} />
    </GradientBlurProvider>
  );
}
```

Provider 需要稳定、可计算的尺寸。采集源优先使用 `sourceRef`，其次寻找直接子元素 `[data-gradient-blur-source]`，最后使用第一个非 Overlay 子元素。Overlay 绝对定位，不参与布局，默认穿透指针事件。

### Provider

| 属性                  | 类型                                   | 默认值   | 说明                                                      |
| --------------------- | -------------------------------------- | -------- | --------------------------------------------------------- |
| `sourceRef`           | `RefObject<HTMLElement \| null>`       | —        | Provider 内的正文容器                                     |
| `captureBackend`      | `"auto" \| "html-in-canvas" \| "rito"` | `"auto"` | 首选渲染路径                                              |
| `onBackendChange`     | `(backend) => void`                    | —        | `pending`、`html-in-canvas`、`rito`、`css`、`unavailable` |
| `maxDevicePixelRatio` | `number`                               | `2`      | 最大纹理 DPR，限制在 1–3                                  |
| `fallback`            | `"css" \| "transparent"`               | `"css"`  | 仅 WebGL2 不可用时生效                                    |

通过 ref 调用 `refresh()` 可以重建后端，刷新命令式 Canvas/CSSOM 变化，或重试失败的初始化。正文节点与滚动位置保留。

### Overlay

| 属性              | 类型                                | 默认值   | 说明                            |
| ----------------- | ----------------------------------- | -------- | ------------------------------- |
| `direction`       | `"top" \| "bottom"`                 | 必填     | 覆盖的边缘                      |
| `height`          | `number \| string`                  | `100`    | 覆盖高度                        |
| `maxRadius`       | `number`                            | `24`     | 外侧最大高斯标准差，单位 CSS px |
| `captureStrategy` | `"static" \| "scrollend" \| "live"` | `"live"` | 纹理更新时机                    |
| `onMetrics`       | `(metrics) => void`                 | —        | 图集、上传与渲染指标            |

## 后端策略

自动优先级为 **HTML-in-Canvas → Rito → CSS**，其中 CSS 有严格的能力门槛：

- **能创建 WebGL2 上下文**：优先 HTML-in-Canvas，原生 API 不可用、布局不适用或原生路径失败时使用 Rito。显式选择 `rito` 可跳过原生尝试。
- **不能创建 WebGL2 上下文**：启用配置的 CSS/透明保底，不启动纹理后端。
- **WebGL2 可用但 Rito 绘制失败**：释放呈现 Canvas，保留原生正文，报告 `unavailable`；不启用 CSS。初始化等待、滚动等待和运行中的 context loss 同样不会启用 CSS。

能力检查只在客户端执行一次；不会将后续的渲染错误当成设备缺少 WebGL。服务器输出在能力检测前保持 `pending`，不会先渲染 CSS 再切换。

演示页提供自动、HTML-in-Canvas 和 Rito 切换，不提供强制 CSS 选项。下方图片区域的普通 CSS blur 是视觉参考，独立于 Provider 的保底策略。

SnapDOM、快照采集器与公开的 `captureAdapter` / Canvas adapter 接口已移除。原生路径面向块级 Provider，Overlay 应为直接子元素；Rito 的支持范围见 [接入说明](docs/rito-renderer.md)。原生能力依赖实验性的 [HTML-in-Canvas API](https://github.com/WICG/html-in-canvas)。

### CSS 保底

使用 Layered Backdrop-Filter Stack，每个边缘最多 8 层不可点击的绝对定位元素，半径从 `Rmax / 128` 逐层翻倍到 `Rmax`。每层拥有重叠的 `mask-image`，顶部与底部互为镜像。零半径不创建滤镜层；不为容器增加整体 mask 或透明度动画。

## 内容更新

`live` 无固定采样间隔。事件合并到动画帧，只保留一个在途任务和最新待处理变化；页面不可见时暂停。

- 原生路径监听浏览器的 `paint.changedElements`，静止时不定时请求快照。
- Rito 读取浏览器布局并用提取的 Canvas 绘制器缓存正文块。缓存内普通滚动只改变 GPU 取样窗口，不重画或上传正文。
- 内容变化检查受影响块；候选纹理在 GPU 比较全部像素，相同则跳过视口与模糊更新。比较有候选上传、一个比较 pass 和异步查询成本，但没有 CPU 图像读回。
- 选区与焦点在 GPU 合成；嵌套滚动和 sticky 内容需要更新受影响的缓存块。动态 Canvas 可显式调用 `refresh()`。

`scrollend` 在滚动停止后更新模糊，等待时显示正文。`static` 只在初始化、尺寸变化和手动刷新时更新；过期的模糊隐藏到下一次更新。

## 模糊管线

1. Provider 共用一个 WebGL2 场景与正文纹理，边缘从 GPU 场景裁剪，不向 CPU 读回。
2. 按局部标准差与 DPR 将边缘拆成最多 8 个 Atlas band，分辨率从 1× 到 1/128×。保留混合区及 3σ 邻域，裁切对齐真实的降采样纹素，避免拉伸；零半径保持原始分辨率。
3. 将 sRGB 场景转换为编码 sRGB、预乘 Alpha 的 RGBA8 缓冲，再逐级降采样。奇数尺寸按源像素覆盖面积滤波，减少细线混叠。各 band 共享降采样结果。
4. 渐变模式先纵向、再横向高斯卷积，使每一行的两个方向使用相同 σ，避免纵向拉丝。合并相邻权重后每轴最多 13 次双线性采样，扣除重采样引入的近似方差。固定半径在 CPU 预计算权重；原始分辨率时将纵向卷积合入最终输出。
5. 较粗一级的 σ 从 2 降到 1.5 texel 时平滑混入下一档。最终通常读取 1–2 次，并以不透明颜色覆盖正文，避免二次混合；纹理与参数不变时复用卷积结果。

`maxRadius` 与 [CSS blur()](https://www.w3.org/TR/filter-effects-1/#funcdef-filter-blur) 同样表示高斯标准差。无随机采样噪点，使用 sRGB 混合以接近 CSS；降采样与浏览器实现仍会带来偏差。见 [CSS 模糊校准](docs/css-blur-alignment.md) 与 [Apple 模糊调研](docs/apple-blur-research.md)。

`onMetrics` 的 `savedRatio` 只比较边缘图集和原始条带，不代表总显存或上传节省。总资源另含正文、降采样与高斯中间缓冲，Rito 的内容块估算预算为 64 MiB。计时是 JS 提交耗时，不是 GPU 完成时间。Canvas 2D 的首次与变更上传仍然存在，不承诺浏览器内部零拷贝。

## 图片模糊对照

演示页 `#image-blur-comparison` 使用同一张本地照片、裁切与边缘延展，并排比较组件算法与普通 CSS `filter: blur()`。固定半径 0–48px，没有渐变或空间分区；「查看原图」同步归零。

半径变化复用源纹理，跨降采样档位只在 GPU 重建图集；图片加载、尺寸/DPR 变化和上下文恢复时才重新上传图片。WebGL2 不可用时左侧明确显示不可用，右侧 CSS 参考图仍可查看。见 [图片署名](public/images/ATTRIBUTION.md)。

## 许可证

仓库原有代码使用 MIT。Rito 提取模块沿用 **AGPL-3.0-only**；上游提交、提取清单、本地改动与完整许可证保存在 [UPSTREAM.md](components/gradient-blur/rito/vendor/UPSTREAM.md) 和 [LICENSE](components/gradient-blur/rito/vendor/LICENSE)。
