# FineProgressiveBlur

<div align="center">

一个基于 React + Next.js 的细腻渐进式背景模糊组件，通过多层叠加技术实现平滑自然的模糊渐变效果。

[![Next.js](https://img.shields.io/badge/Next.js-16.0.1-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.0-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.x-38bdf8?logo=tailwind-css)](https://tailwindcss.com/)

</div>

## ✨ 特性

- 🎨 **细腻分层算法** - 独特的分层策略，将模糊区域分为细腻阶段和粗糙阶段，确保过渡平滑自然
- 📐 **精确的高斯模糊控制** - 基于方差可加性原理，科学分配每层的模糊强度
- 🎯 **灵活的位置配置** - 支持顶部、底部或两端同时应用模糊效果
- 🌈 **多种颜色格式** - 支持 `rgba()`、`#RRGGBB`、`#RRGGBBAA` 等颜色格式
- 🎛️ **完全可定制** - 提供丰富的参数配置，满足各种设计需求
- 📱 **响应式友好** - 适配各种屏幕尺寸和容器

## 🖼️ 效果预览

![演示效果](/readme/preview.png)

## 🚀 快速开始

### 安装依赖

```bash
npm install
# 或
pnpm install
# 或
yarn install
```

### 启动开发服务器

```bash
npm run dev
# 或
pnpm dev
# 或
yarn dev
```

打开浏览器访问 [http://localhost:3000](http://localhost:3000) 查看演示页面。

## 📖 使用方法

### 基础用法

```tsx
import FineProgressiveBlur from "@/component/FineProgressiveBlur";

export default function MyComponent() {
  return (
    <FineProgressiveBlur
      blur={24}
      height={120}
      color="rgba(255,255,255,0.85)"
      position="both"
      border={8}
    >
      {/* 你的内容 */}
    </FineProgressiveBlur>
  );
}
```

### Props 参数说明

| 参数       | 类型                          | 必填 | 默认值 | 说明                                            |
| ---------- | ----------------------------- | ---- | ------ | ----------------------------------------------- |
| `blur`     | `number`                      | ✅   | -      | 模糊强度（px），推荐范围 0-30                   |
| `height`   | `number`                      | ✅   | -      | 渐隐高度（px），模糊效果覆盖的区域高度          |
| `color`    | `string`                      | ✅   | -      | 遮罩颜色，支持 `rgba()`、`#RRGGBB`、`#RRGGBBAA` |
| `position` | `"top" \| "bottom" \| "both"` | ✅   | -      | 模糊效果位置                                    |
| `border`   | `number`                      | ❌   | `0`    | 圆角半径（px），用于匹配内容容器的圆角          |

### 使用示例

#### 1. 顶部白色渐变模糊

适用于长列表或滚动容器的顶部提示。

```tsx
<FineProgressiveBlur
  blur={32}
  height={140}
  color="rgba(255,255,255,0.85)"
  position="top"
  border={12}
>
  <div className="h-96 overflow-auto bg-white rounded-xl p-6">
    {/* 长列表内容 */}
  </div>
</FineProgressiveBlur>
```

#### 2. 底部透明模糊

适用于图片底部渐隐效果。

```tsx
<FineProgressiveBlur blur={16} height={100} color="#ffffff00" position="bottom">
  <img src="/image.jpg" alt="Demo" className="w-full" />
</FineProgressiveBlur>
```

## 🧮 核心算法原理

### 1. 分层策略

FineProgressiveBlur 采用创新的两阶段分层算法：

- **细腻阶段**：前 N 层（通常 15 层），每层固定 2px 高度，提供精细的过渡效果
- **粗糙阶段**：后续层按平方递增（4px, 9px, 16px...），快速覆盖剩余高度

```typescript
// 细腻阶段：前 N 层每层 2px
if (i <= fineLayers) {
  height -= 2;
}
// 粗糙阶段：按 j² 递增
else {
  const j = i - fineLayers;
  height -= Math.pow(j + 1, 2);
}
```

### 2. 高斯模糊分配

基于高斯模糊的方差可加性原理：

$$\sigma_{\text{total}}^2 = \sum_{i=1}^{n} \sigma_i^2$$

每层的模糊强度与其覆盖进度成正比，确保最终合成模糊强度等于设定值：

```typescript
const sumPSq = progressList.reduce((acc, p) => acc + p * p, 0);
const scale = sumPSq > 0 ? blur / Math.sqrt(sumPSq) : 0;
const perLayerBlur = progressList.map((p) => scale * p);
```

### 3. 颜色渐变

仅第一层应用线性渐变，其他层使用透明色，通过叠加实现自然的颜色过渡：

## 🔧 技术栈

- **框架**: [Next.js 16.0.1](https://nextjs.org/) (App Router)
- **前端库**: [React 19.2.0](https://react.dev/)
- **语言**: [TypeScript 5.x](https://www.typescriptlang.org/)
- **样式**: [Tailwind CSS 4.x](https://tailwindcss.com/)
- **编译优化**: React Compiler (Babel Plugin)

## 📊 性能特点

- ✅ 使用原生 CSS `backdrop-filter`
- ✅ 基于层数优化算法，避免过度分层
- ✅ 纯 CSS 实现，无 JavaScript 运行时开销

## 📝 注意事项

1. **浏览器兼容性**：`backdrop-filter` 需要现代浏览器支持（Chrome 76+, Safari 9+, Firefox 103+）
2. **性能考虑**：模糊层数过多可能影响性能，建议 `height` 不要设置过大（<300px）
3. **颜色透明度**：如果未指定透明度，默认使用 0.85
4. **圆角匹配**：`border` 参数应与内容容器的圆角保持一致，以获得最佳视觉效果

## 🔮 使用场景

- 📜 **长列表滚动提示** - 顶部/底部模糊暗示可滚动内容
- 🖼️ **图片渐隐效果** - 图片边缘平滑过渡到背景
- 🎴 **卡片设计** - 强调卡片中心内容
- 📱 **移动端列表** - 提升滚动体验
- 🎨 **视觉层次** - 创建内容的空间深度感

## 📄 许可证

本项目采用 MIT 许可证。

---

<div align="center">

**如果这个项目对你有帮助，请给一个 ⭐️ Star！**

</div>
