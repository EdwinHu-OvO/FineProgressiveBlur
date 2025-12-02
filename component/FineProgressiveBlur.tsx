interface FineProgressiveBlurProps {
  blur: number;
  height: number;
  color: string;
  children: React.ReactNode;
  position: "top" | "bottom" | "both";
  border?: number;
}
type Layer = {
  id: number;
  height: number;
  blur: number;
  color: string;
};
type Color = {
  r: number;
  g: number;
  b: number;
  a: number;
};
function transhextorgba(color: string): Color {
  if (color.startsWith("#")) {
    // length 7 or 9
    if (color.length === 7) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      return { r, g, b, a: 0.85 };
    } else if (color.length === 9) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      const a = parseInt(color.slice(7, 9), 16);
      return { r, g, b, a: a / 255 };
    }
  } else if (color.startsWith("rgba(")) {
    const [r, g, b, a] = color.slice(5, -1).split(",").map(Number);
    console.log(r, g, b, a);
    return { r, g, b, a };
  }
  return { r: 255, g: 255, b: 255, a: 0.85 } as Color;
}
export default function FineProgressiveBlur({
  blur,
  height,
  color,
  children,
  position,
  border,
}: FineProgressiveBlurProps) {
  // 细腻阶段覆盖总高度的 1/3，细腻阶段每层固定 2px
  function calculateFineLayers(totalHeight: number) {
    // 保证细腻阶段分层不要过度
    if (totalHeight < 100) {
      const fineTarget = Math.max(0, Math.floor(totalHeight / 4));
      const n = Math.max(0, Math.ceil(fineTarget / 2));
      return n;
    } else {
      return 15;
    }
  }
  // 计算总层数：细腻阶段每层 2px；之后按 4、9、16... 的平方递增
  function calculateLayersCount(totalHeight: number) {
    const N = calculateFineLayers(totalHeight);
    let h = totalHeight;
    let i = 1;
    let coarseBase = 2; // 2^2=4 开始
    while (h > 0) {
      if (i <= N) {
        h -= 2;
      } else {
        h -= coarseBase * coarseBase;
        coarseBase++;
      }
      i++;
    }
    return i;
  }
  const fineLayers = calculateFineLayers(height);
  const layersCount = calculateLayersCount(height);
  const toplayers: Layer[] = [];
  const bottomlayers: Layer[] = [];
  const color_rgba: Color = transhextorgba(color);
  let colort: string = "";
  let colorb: string = "";
  const flagtop = position === "top" || position === "both";
  const flagbottom = position === "bottom" || position === "both";
  // 使用高斯模糊方差可加性：sqrt(sum(sigma_i^2)) <= blur
  // 去掉“细腻增长”加权，改为按累计高度百分比线性增长
  const layerCount = Math.max(0, layersCount - 1);
  // 先基于分层逻辑模拟累计高度百分比 p_i ∈ [0,1]
  const progressList: number[] = [];
  {
    let tmpHeight = height;
    for (let i = 1; i <= layerCount; i++) {
      if (i <= fineLayers) {
        tmpHeight -= 2;
      } else {
        const j = i - fineLayers; // 从 1 开始
        tmpHeight -= Math.pow(j + 1, 2);
      }
      const covered = height - Math.max(0, tmpHeight);
      const p = height > 0 ? Math.max(0, Math.min(1, covered / height)) : 0;
      progressList.push(p);
    }
  }
  // 令每层 sigma_i 与 p_i 成正比，并用方差和约束到传入 blur
  const sumPSq = progressList.reduce((acc, p) => acc + p * p, 0);
  const scale = sumPSq > 0 ? blur / Math.sqrt(sumPSq) : 0;
  const perLayerBlur: number[] = progressList.map((p) => scale * p);

  let theight = height;
  for (let i = 1; i <= layerCount; i++) {
    if (i === 1) {
      colort = `linear-gradient(180deg, rgba(${color_rgba.r}, ${color_rgba.g}, ${color_rgba.b}, ${color_rgba.a}), transparent)`;
      colorb = `linear-gradient(0deg, rgba(${color_rgba.r}, ${color_rgba.g}, ${color_rgba.b}, ${color_rgba.a}), transparent)`;
    } else {
      colort = "rgba(0, 0, 0, 0)";
      colorb = "rgba(0, 0, 0, 0)";
    }
    const tblur = perLayerBlur[i - 1];
    if (i <= fineLayers) {
      theight -= 2;
    } else {
      const j = i - fineLayers; // 从 1 开始
      theight -= Math.pow(j + 1, 2);
    }

    toplayers.unshift({
      id: i,
      height: theight,
      blur: tblur,
      color: colort,
    });
    bottomlayers.unshift({
      id: i,
      height: theight,
      blur: tblur,
      color: colorb,
    });
  }
  return (
    <div className="relative h-fit w-fit" aria-hidden>
      <div className="w-full h-full">
        {flagtop && (
          <div
            className="absolute top-0 left-0 w-full z-99 pointer-events-none"
            style={{ height: `${height}px` }}
          >
            {toplayers.map((layer) => (
              <div
                key={layer.id}
                className="absolute left-0 top-0 w-full"
                style={{
                  background: layer.color,
                  height: `${layer.height}px`,
                  backdropFilter: `blur(${layer.blur}px)`,
                  borderTopLeftRadius: `${border}px`,
                  borderTopRightRadius: `${border}px`,
                }}
              ></div>
            ))}
          </div>
        )}
        {flagbottom && (
          <div
            className="absolute bottom-0 left-0 w-full flex flex-col-reverse z-99 pointer-events-none"
            style={{ height: `${height}px` }}
          >
            {bottomlayers.map((layer) => (
              <div
                key={layer.id}
                className="absolute left-0 bottom-0 w-full"
                style={{
                  background: layer.color,
                  height: `${layer.height}px`,
                  backdropFilter: `blur(${layer.blur}px)`,
                  borderBottomLeftRadius: `${border}px`,
                  borderBottomRightRadius: `${border}px`,
                }}
              ></div>
            ))}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
