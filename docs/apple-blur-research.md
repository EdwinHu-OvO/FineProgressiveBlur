# Apple 模糊实现与性能调研

调研日期：2026-09-08。范围：Apple 公开文档、官方 Metal 示例、WebKit 源码，以及本机 MPS 测量。

## 可确认的实现

Apple 的公开资料展示了多条模糊路径，不能把它们视为同一个内核。

| 路径                        | 公开证据                                                                            | 能确认的边界                                                      |
| --------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `MPSImageGaussianBlur`      | 优化过的高斯近似，适用于约 10-bit 或以下精度；官方称其吞吐量通常约为拷贝的一半      | 具体近似算法未在该文档公开，不能据此断言是三次 box、IIR 或 Kawase |
| Apple Metal 示例            | mipmap 降采样，各级横纵分离卷积，临时纹理内存复用                                   | 是官方示例，不是系统材质内核源码                                  |
| Safari 加速 CSS 模糊        | WebKit 将标准差传给 Core Animation 的 Gaussian blur filter；背景使用 backdrop layer | 能确认合成后端，无法从调用端推导闭源内核                          |
| Core Image 可变模糊         | `CIMaskedVariableBlur` 通过灰度 mask 指定各处的模糊程度                             | 支持空间变化的模糊，不证明系统滚动边缘调用它                      |
| SwiftUI 材质 / Liquid Glass | 材质使用平台相关混合；`GlassEffectContainer` 将多个效果一起渲染以改善性能           | 完整滤镜图、降采样比例与版本策略没有公开契约                      |

来源：[MPS Gaussian blur](https://developer.apple.com/documentation/metalperformanceshaders/mpsimagegaussianblur?preferredLanguage=occ)、[Metal 多阶段滤镜示例](https://developer.apple.com/documentation/metal/implementing-a-multistage-image-filter-using-heaps-and-fences)、[WebKit 的 Core Animation 滤镜映射](https://github.com/WebKit/WebKit/blob/221348147d70038b32775a76ce4a7ba964126503/Source/WebCore/platform/graphics/ca/cocoa/PlatformCAFiltersCocoa.mm#L295)、[可变模糊](https://developer.apple.com/documentation/coreimage/cimaskedvariableblur)、[Material](https://developer.apple.com/documentation/swiftui/material)、[GlassEffectContainer](https://developer.apple.com/documentation/swiftui/glasseffectcontainer)。

“拷贝速度的一半”描述吞吐量，相同数据量的耗时约为拷贝的两倍。它是文档中的典型描述，不是任何分辨率、半径与设备下的保证。

官方 Metal 示例下载包的 `Renderer/APPLFilter.metal` 使用固定五点高斯核、横纵两次 compute，以及 `half` 颜色计算。模糊强度通过多级纹理配合输出时的 mipmap 采样调整。其主旨是降低资源分配与依赖管理成本，不能将示例五点核解释为 MPS 的实现。

## 低开销来自哪些地方

1. **接近合成器处理背景。** WebKit 的加速路径把滤镜附着到 Core Animation 图层，而不是让页面脚本重新描述并光栅化 DOM。由此可以推断，SnapDOM 的序列化、光栅化与上传成本不是这种系统路径的必要前置步骤；这仍不等于内存中完全没有复制。[WebKit 源码](https://github.com/WebKit/WebKit/blob/221348147d70038b32775a76ce4a7ba964126503/Source/WebCore/platform/graphics/ca/GraphicsLayerCA.cpp#L2722)
2. **用近似和多尺度限制工作量。** MPS 明确接受有限精度的高斯近似；官方 Metal 示例使用降采样后的小核，并复用中间纹理存储。[MPS](https://developer.apple.com/documentation/metalperformanceshaders/mpsimagegaussianblur?preferredLanguage=occ)、[Metal 示例](https://developer.apple.com/documentation/metal/implementing-a-multistage-image-filter-using-heaps-and-events)
3. **一起渲染多个材质。** `GlassEffectContainer` 的公开保证是合并渲染提高性能，并支持形状间的融合。不能进一步假定内部恰好只捕获一次、只有一次绘制。[Apple 文档](https://developer.apple.com/documentation/swiftui/glasseffectcontainer)
4. **控制内存带宽和资源生命周期。** Apple GPU 采用统一内存；Metal 提供 private 与 memoryless 等存储方式。片上 tile memory 的带宽、延迟和功耗有优势。但跨像素、跨 pass 的模糊不自动满足 memoryless 的使用条件；不能认为任意二维模糊都可完全留在片上。[Apple 存储模式文档](https://developer.apple.com/documentation/metal/choosing-a-resource-storage-mode-for-apple-gpus)

仍然存在成本。WebKit 官方说明 backdrop filter 会增加渲染 pass；Apple 在 visionOS 的性能资料中也提醒透明与模糊可能很昂贵。该平台还明确区分应用、render server 和 compositor 的工作，应用主线程占用不能代表全部成本。[WebKit 说明](https://webkit.org/blog/3632/introducing-backdrop-filters/)、[WWDC23 RealityKit Trace](https://developer.apple.com/videos/play/wwdc2023/10099/)

## 本机原生 MPS 测量

Apple M4、macOS 15.7.5，Metal private RGBA8 纹理。工作面为 802 × 632 CSS px；DPR 2 时实际处理 1604 × 1264 像素。
源数据预先上传；强制重复执行固定半径 MPS 卷积。每个参数预热 16 次，然后测 9 批、每批 32 次。使用 command buffer 的 GPU 起止时间，每批除以执行次数。
每轮参数结束后，在计时外读回阶跃边缘，验证输出非空且模糊生效。

下面是三次独立运行各自中位数的中位数，括号内为三次运行中位数的范围：

| 操作，DPR 2                        | GPU ms / 次          |
| ---------------------------------- | -------------------- |
| 同尺寸纹理拷贝                     | 0.157（0.155–0.169） |
| `σ = 12 CSS px`，实际 σ = 24 texel | 0.447（0.440–1.470） |
| `σ = 28 CSS px`，实际 σ = 56 texel | 0.490（0.433–0.922） |
| `σ = 48 CSS px`，实际 σ = 96 texel | 0.573（0.433–0.910） |

更早的一次探索测量在上述大半径下约为 0.26ms；正式复测保留了明显的轮次波动，因此不能将这个较低值当作稳定预算。
这些数据只衡量温热缓存下的 GPU 操作，不含 DOM 捕获、源纹理上传、CPU 提交耗时、渐变、材质混合或显示合成，不能与本项目完整帧耗时直接相除得出加速倍数。

原始数据：[三轮测量](benchmarks/apple-mps-m4-2026-09-08.json)。复测脚本：[benchmark-apple-blur.swift](../scripts/benchmark-apple-blur.swift)。在有 Metal 设备的 macOS 上运行：

```sh
xcrun swiftc -O scripts/benchmark-apple-blur.swift -o /tmp/fpb-apple-blur-benchmark
/tmp/fpb-apple-blur-benchmark
```

## 对本项目的建议

本项目已经有局部降采样、分离卷积、双线性合并采样、GPU 中间纹理复用、内容检测和空闲结果缓存，方向与公开优化思路一致。接下来应分别测源内容准备、卷积和合成，确定热点后再改。

**优先研究 Provider 范围内的模糊结果复用。** 当前 Rito 已缓存正文 tile，但视口滚动仍会被标记为内容变化，边缘条带重新打包并卷积，见 `rito-surface.ts` 与 `surface-overlay.ts`。
可以实验按文档坐标缓存多尺度模糊 tile：正文不变且缓存命中时，滚动只更新最终采样位置。变化的 tile 及其卷积邻域需要一起失效；必须保留 halo 和显存预算。这个策略需要适配 sticky、动画、选区等依赖视口的内容，不应直接推广为所有后端都能只改 UV。

对连续半径，可在已标定的若干 σ 层之间选择和混合，但混合两个高斯结果并不严格等价于中间 σ 的高斯。它应作为独立实验后端，沿用当前 CSS 对照、文字、细线和接缝测试，验证节省的 GPU 时间是否值得误差与显存代价。

**保留浏览器 CSS 路径作为整体成本基准。** 它更接近浏览器原生合成流程；现有多层渐变 fallback 的成本仍随层数、重叠面积、浏览器而变化。公开证据不支持“Apple 原生渐变就是堆叠 6–8 层 blur”的说法。

若后续实验 WebGPU compute，应比较中间读写、资源切换与端到端耗时；更换 API 本身没有已证实的性能收益。网页也不能直接调用原生 MPS，WebGPU 不会自动提供任意 DOM 的纹理。

本次新增调研记录与独立基准脚本，组件运行时保持原有实现。
