# 蒙版驱动的 Variable Blur

`GradientBlurProvider`、原生内容和 `GradientBlurOverlay` 的组合保持不变。Overlay 有三种互斥模式：不传 `direction` 和 `mask` 为默认全模糊；仅传 `direction` 启用方向渐变；仅传 `mask` 启用任意二维蒙版。类型约束和运行时检查均拒绝同时传入两者。蒙版始终以左上角为原点，拉伸到覆盖区域，底部不会自动镜像。

```tsx
<GradientBlurProvider captureBackend="auto">
  <GradientBlurOverlay maxRadius={24} mask="/masks/focus.svg" />
  <div data-gradient-blur-source className="scroll-container">
    {/* 保留原生 DOM、滚动、输入和选区 */}
  </div>
  {/* 仍可按需组合其他顶部或底部 Overlay */}
</GradientBlurProvider>
```

全模糊和蒙版默认覆盖整个容器，方向渐变默认高度为 100px。全模糊走单块图集，只根据半径与 DPR 选择降采样率，再执行 compact9 固定半径卷积；不读取蒙版，不生成渐变分带。局部全模糊和蒙版都会保留覆盖范围外的采样邻域。覆盖层位置通过 `style` 设置。

## 输入

`mask` 支持 URL 字符串（包括 SVG、data URL 和 blob URL），或下面的配置：

```tsx
<GradientBlurOverlay
  height={180}
  style={{ bottom: 0 }}
  maxRadius={32}
  mask={{ source: canvas, channel: "alpha", invert: false, revision }}
/>
```

`source` 接受字符串、`HTMLImageElement`、`HTMLCanvasElement`、`OffscreenCanvas`、`ImageBitmap` 或 `ImageData`。浏览器对象应在 Client Component 中创建。默认 `channel="luminance"`：使用编码 RGB 的亮度系数 `0.2126 R + 0.7152 G + 0.0722 B` 再乘 Alpha。全黑或全透明为 0，全白且不透明为 1；`channel="alpha"` 只读 Alpha。`invert` 在通道提取之后反转。

每个输出像素的目标标准差为 `maxRadius × strength`，单位为 CSS px。`blurCurve` 仅参与方向渐变，全模糊与蒙版均忽略该属性（包括 Provider 的配置）。移除 `mask` 后回到默认全模糊；需要渐变时移除 `mask` 并传入 `direction`。

Canvas / ImageData 原地修改后递增 `revision`。`refresh()` 更新正文采集，蒙版快照的更新由 `source` / `revision` 控制。配置对象可以内联，稳定的字段不会因 `onMetrics` 等重渲染重复注册。替换蒙版时取消旧的加载任务，首帧完成后才关闭保底。

输入保留原始像素，不做低分辨率蒙版分析，避免漏掉小孔洞。当前限制为 16 megapixels，长边也不能超出设备的 `MAX_TEXTURE_SIZE`。外部图片必须允许匿名 CORS；跨域污染的 Canvas 无法读取。加载/解码失败写入 Overlay 的 `data-mask-error`。

## 分块与 GPU 管线

1. **读取蒙版一次**：转成不可变的 8-bit 单通道强度场。GPU 用 R8 纹理双线性采样，CPU 使用同一份像素规划采集块。不会读回正文纹理。
2. **保守区间分析**：将输出区域分成最多 32 × 32 个规划单元，每个单元扫描所有可能参与双线性采样的蒙版像素，记录最小/最大强度。小清晰区域、硬边界和高频蒙版都不能被均值采样抹掉。
3. **按半径生成区域**：建立包含 0 的半 octave 高斯半径序列，即相邻非零标准差约为 √2 倍；从 0.5 设备像素开始，最后一档精确落在 `maxRadius`。对每档只保留可能使用它的单元。横向连续单元合并成行，宽度相同的相邻行再纵向合并。
4. **控制块数和边界**：各块扩张 3σ 加重建 guard，裁剪对齐共享降采样纹素。局部 Overlay 还会采集覆盖范围之外的正文邻域，仅在场景边缘截断，避免把覆盖边界误当成图片边缘。重叠邻域总面积大于包围矩形，或某档超过 24 块时，合并为包围矩形；这会增加采集面积，不会删除需要的半径。图集有尺寸和分配预算检查。
5. **复用渲染管线**：仍然使用 `AtlasTexture` 的编码 sRGB 复制、面积降采样金字塔、`GaussianBlur` 的 compact9 两轴卷积以及方差补偿。每块的固定 σ 在 CPU 生成核，低清块最高降低到 1/128 分辨率，同级块共享降采样结果。
6. **按像素合成**：逐档从清晰向模糊绘制。一个像素只需要目标半径上下两档的结果，按 `(σ² - σlow²) / (σhigh² - σlow²)` 连续混合。零蒙版读取真实清晰内容；蒙版不决定最终覆盖层的透明度。

任意二维半径场不能直接套用渐变模式的 Y→X 变半径卷积：第二轴会混入相邻像素已经使用不同 σ 的结果，方向性拖影会随蒙版而变化。这里的各档先做固定半径二维高斯，再按目标像素选择，避免这个问题。中间半径是相邻高斯图像的方差插值近似，不宣称等于逐像素无限精度高斯；每档沿用 compact9 的采样截断与降采样误差。

分析结果按蒙版和尺寸缓存，图集布局再按半径/DPR 缓存。滚动只更新内容纹理采样和卷积，不重新扫描蒙版。半径改变只重建区域布局；蒙版/尺寸改变才重新分析。当前分块纯 TypeScript，无 Rust/WASM 初始化或打包开销；若动态大蒙版成为主要负载，可独立替换 `analyzeMask` / `createMaskAtlasLayout`，保持 GPU 消费的矩形协议不变。

## 保底与诊断

图片 URL 在服务器输出时即可提供蒙版 CSS 保底。浏览器对象和反转蒙版在解码后生成 Alpha 图片。该保底使用最大半径的 masked backdrop blur，是近似外观；真正随像素变化的半径由 WebGL 管线实现。`fallback="transparent"` 关闭 CSS 保底和 Alpha 图片生成。加载失败时不会偷偷切换为无关的方向渐变。

`onMetrics.mode` 区分 `uniform` / `gradient` / `mask`，`direction` 仅在渐变模式提供。`bands` 在全模糊模式只有一块，在蒙版模式下代表二维采集块，可能超过渐变模式的 8 条 band；`coreLeft` / `coreRight` / `coreStart` / `coreEnd` 是归一化输出范围，`sigma` 是蒙版块的固定 CSS 标准差。`atlasBuildMs` 包含首次区间扫描/布局生成，缓存命中后仅包含缓存查询。`savedRatio` 仍只比较图集与同尺寸原图，不包含共享正文、降采样和卷积工作缓冲；复杂蒙版或局部覆盖层的外部邻域可能产生负值。GPU 指标中的每轴 9 次采样上限不包含所有块与最终合成的总工作量。

首页 `#variable-blur` 提供偏心焦点、独立模糊区域和硬边清晰窗口，也可选择“不使用蒙版 · 全模糊”检查单块降采样；可上传图片、反转、选择 Alpha 通道并查看采样率和图集尺寸。

## 验证记录（2026-09-10）

Apple M4、Chromium Headless 153 / ANGLE SwiftShader：84 组 GPU 对照覆盖 0–48px、DPR 1/2、黑白、硬边窗口、二维灰度、棋盘格和低分辨率蒙版，另有 12 组覆盖层外部邻域对照。参考是全幅纹理的同管线固定半径结果及其方差插值，最大通道误差为 1.45/255，清晰像素无差异；这不是对 CSS 或精确高斯的误差声明。GPU 使用软件后端，本次不据此报告真实硬件 GPU 耗时。

区间分析在 512² / 1024² / 2048² / 4096² 蒙版上的本机暖机后中位数约 0.3 / 1.0 / 3.8 / 14.5ms；区域布局约 0–0.1ms（时钟粒度约 0.1ms），不含图片加载、解码、Alpha 保底生成及 GPU 上传。静态蒙版扫描不在滚动热路径，当前保留 TypeScript 实现。原始结果见 [验证数据](benchmarks/variable-blur-2026-09-10.json)。

浏览器集成验证了 Rito / HTML-in-Canvas（启用实验 flag）、原生交互、半径变更与重渲染不重新上传蒙版、所有输入类型、`revision`、移除/恢复蒙版、static / scrollend、context loss / refresh、加载失败恢复、390px 布局和无 WebGL2 的 CSS 保底。

三模式 API 调整后，`pnpm lint`、`pnpm typecheck`、17 个测试文件 / 74 项测试通过；包含默认全模糊、类型与运行时互斥、三管线路由及位置变化监听。重新运行上述 96 组蒙版 GPU 对照，并增加 36 组全模糊对照，覆盖全幅、局部覆盖与实际邻域裁剪，半径 0 / 1 / 4 / 12 / 28 / 48px、DPR 1/2。全模糊相对同管线全幅参考的最大通道误差为 2/255，最大平均绝对误差约 0.21/255；仅用于验证裁剪与输出一致性。浏览器也验证了蒙版移除后的全模糊、半径降采样、方向渐变切换、`style` 定位变更和单层无蒙版 CSS 保底，均无页面运行错误。结果见 [三模式验证数据](benchmarks/overlay-modes-2026-09-10.json)。
