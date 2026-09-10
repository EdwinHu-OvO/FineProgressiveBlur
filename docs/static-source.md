# Provider 静态背景

`GradientBlurProvider` 的 `sourceMode` 控制背景纹理的更新，默认 `"live"`。设置 `"static"` 后，首次采集完整的 Provider 采集区域；同一背景版本下，尺寸/DPR 不变就保留纹理，普通 DOM 变更和滚动不会自动重新采集。背景实际变化时调用已有的 `ref.refresh()`。

```tsx
const provider = useRef<GradientBlurProviderHandle>(null);

<GradientBlurProvider ref={provider} sourceMode="static">
  <div data-gradient-blur-source="">
    <img src={wallpaper} alt="" onLoad={() => provider.current?.refresh()} />
  </div>
  <GradientBlurOverlay maxRadius={48} height={160} />
  <GradientBlurOverlay
    maxRadius={48}
    height={220}
    style={{ top: 240, left: 80, width: 320, insetInline: "auto" }}
  />
</GradientBlurProvider>;
```

图片应在加载/解码完成后通知更新。已有的背景 `onChange`、Canvas 绘制回调或外部订阅也可以调用 `provider.current?.refresh()`。Provider 的 DOM `onChange` 保持 React 事件含义；它不是背景缓存失效接口。

## 更新与共享

- 首次渲染、采集区域尺寸/DPR 改变或手动 `refresh()` 时更新背景；后端切换与 context 恢复重新建立纹理。
- 移动、缩放或新增 Overlay 只请求该 Overlay 的布局更新，复用已有背景。半径改变也不会导致背景重新上传。
- 默认全模糊 Overlay 按背景版本、纹理尺寸、DPR、半径和算法共享完整背景的预模糊结果。相同配置只建立一次降采样图集并完成两轴高斯，后续各自的显示区域使用归一化坐标裁切。
- 小半径的共享结果也会预先完成两轴卷积，不把另一轴的计算留在每次合成中。每个 Overlay 的合成仍有 GPU 绘制成本。
- 不同半径建立不同的共享结果。活动配置保持有效；闲置历史按最多 4 项及 64 MiB 保守估算预算淘汰，至少保留最近一项。活动配置的纹理和 Provider 场景不受这个闲置预算硬限制。
- `direction` 与 `mask` 保留原有渐变/二维蒙版管线；它们能复用静态的背景源，但局部半径场不等价于同一张固定半径结果，不能直接套用全模糊裁切。

`sourceMode="static"` 与 Overlay 的 `captureStrategy="static"` 是不同层次：前者冻结 Provider 的采集源并启用共享结果；后者只控制单个 Overlay 何时更新。在 Provider 的默认 live 模式下，已有 Overlay 策略含义不变。CSS 保底仍使用浏览器原生背景模糊。

## 内部边界

`SurfaceOverlays` 统一两个后端的 Overlay 生命周期、局部尺寸通知和共享缓存。`requestOverlay(element)` 只标记一个覆盖区域；`request("manual")` 才用于显式源更新。`StaticUniformCache` 保存共享图集和已完成的高斯结果；`static-overlay` 计算输出坐标和指标。

同一个 Provider 内，`GradientBlurMetrics.sharedTexture` 相同表示复用同一项；不能把这些 Overlay 的 `atlasBytes` 重复相加。`data-gradient-blur-shared` 与 Canvas 的 `data-gradient-blur-shared-textures` 可用于调试。指标仍是 JS 提交和估算字节数，不能作为 GPU 完成时间或整机占用率。

后端 Surface 与单个 Overlay 的协调器约 220–240 行，保留各自完整的异步帧/就绪生命周期；共享缓存、注册管理和坐标裁切已经独立拆分，避免将两种后端流程混在一起。

## 验证

两种真实 WebGL 后端都验证了：移动或新增同半径 Overlay 不增加背景上传、编码和高斯次数；修改背景样式不通知时保留旧纹理；`refresh()` 后只重新采集一次并共享一次两轴卷积；不同半径、DPR 变化、切回 live 均正确更新。48 组 GPU 像素对照覆盖半径 0/1/4/12/28/48、DPR 1/2、非整齐纹理尺寸、不同尺寸与越界的 Overlay，最大通道误差为 1/255。

详细结果见 [静态 Provider 验证数据](benchmarks/static-source-2026-09-10.json)，页面接入见 [Massive Blur](massive-blur.md)。
