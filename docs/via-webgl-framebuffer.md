# Via 黑色模糊区域：真机排查记录

日期：2026-09-09。

## 环境与现象

- Via 7.3.3，Android System WebView 151.0.7922.199。
- 页面实际获得 WebGL2 上下文，使用 Rito 后端；正文可见，上下模糊区为黑色。
- `drawArrays` 和 `blitFramebuffer` 报 `INVALID_FRAMEBUFFER_OPERATION`（1286）。
- 出错的 Atlas、降采样和高斯中间 framebuffer 返回 `FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT`（`0x8cd7`）。
- GPU 计时扩展不可用，但修复后同一设备可以正常渲染，因此它不是这次黑块的原因。

所有页面验收均使用 `pnpm build` 后重启的 `pnpm start`，通过局域网访问并禁用缓存刷新，没有使用开发服务器。

## 根因与最小复现

`RenderTarget` 原先在构造时挂载尚未分配存储的纹理，随后在 `resize` 中调用 `texImage2D`。这个 WebView/驱动组合未正确更新附件状态；JavaScript 仍能查询到附件纹理对象，但 framebuffer 一直不完整，实际 draw/blit 被拒绝。最终合成把空纹理输出成不透明黑色。

在同一个 Via 页面创建独立 WebGL2 上下文，使用 64 × 32 纹理清屏并读取像素：

| 顺序 | RGBA8 状态 | 清屏与读回 |
| --- | --- | --- |
| 挂载 → 分配存储 | `0x8cd7` | 错误 1286，像素 `[0, 0, 0, 0]` |
| 分配存储 → 挂载 | `0x8cd5`，完整 | 无错误，像素 `[64, 128, 191, 255]` |
| 挂载 → 分配存储 → 重新挂载 | `0x8cd5`，完整 | 无错误，像素 `[64, 128, 191, 255]` |

`SRGB8_ALPHA8` 也呈现相同的顺序差异。因此不能把问题简单归结为 WebGL2 不可用或 RGBA8 格式不受支持；目前证据定位到这个运行环境中的附件更新行为，不足以区分 Via、WebView 和底层驱动各自的责任。

## 修复

[render-target.ts](../components/gradient-blur/engine/render-target.ts) 在分配或调整纹理存储后挂载附件，并检查 framebuffer 完整性。操作只绑定 `DRAW_FRAMEBUFFER`，结束时恢复原来的绘制目标，保留共享上下文的读写状态。

检查失败会抛出带 framebuffer 状态的错误，使现有 Provider 失败处理恢复 CSS 保底。尺寸未变化时直接复用，不在每个滚动帧重新分配、挂载或检查。

## 验收结果

- `pnpm lint`、`pnpm typecheck`、`pnpm test` 通过，12 个测试文件、51 项测试通过；生产构建通过。
- 生产页面初始化后 draw/blit/纹理操作错误为 0。后端为 `rito`，两个 Overlay 均为 `ready`，CSS 滤镜栈为 `display: none`。
- 真机截图确认上下模糊区域恢复图像。Demo 配置的 `rgba(35, 35, 35, 0.45)` 渐变背景仍然保留，它与空纹理黑块是两回事。
- 对修复后的实际 `RenderTarget` 执行 64 × 32、31 × 47、642 × 224 以及相同尺寸复用：全部完整、像素正确、无 GL 错误，原有 READ/DRAW 绑定均保留。
- 注入 `FRAMEBUFFER_UNSUPPORTED`：Provider 转为 `css`，记录 `Blur render target is incomplete: 0x8cdd`，两个 CSS 保底均恢复。移除注入并刷新后重新使用 Rito。
- 预热后执行两次各 1 秒的 ADB 滑动：236 次 scroll 事件、237 个发生绘制的动画帧；触摸期间 6820 次 draw 调用；纹理存储重新分配 0 次、正文纹理更新 12 次、GL 错误 0。
- 绘制动画帧间隔中位数 8.3 ms、P95 8.4 ms。这是短时测试中的 rAF/提交间隔，不是 GPU 执行时间或屏幕实际呈现帧率。

诊断注入在验收后移除，并重新刷新生产页面。
