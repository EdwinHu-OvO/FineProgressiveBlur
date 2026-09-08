import type {
  CaptureStrategy,
  GradientBlurDirection,
  GradientBlurBackend,
  GradientBlurActiveBackend,
} from "@/components/gradient-blur";
import styles from "./controls.module.css";
import { BackendControl } from "./BackendControl";
import { RangeControl } from "./RangeControl";
import { CSS_BLUR_LAYERS } from "@/components/gradient-blur/fallback/layered-blur";

interface BlurControlsProps {
  backend: GradientBlurBackend;
  activeBackend: GradientBlurActiveBackend;
  onBackendChange: (backend: GradientBlurBackend) => void;
  directions: Record<GradientBlurDirection, boolean>;
  height: number;
  maxRadius: number;
  strategy: CaptureStrategy;
  onHeightChange: (value: number) => void;
  onRadiusChange: (value: number) => void;
  onReset: () => void;
  onStrategyChange: (value: CaptureStrategy) => void;
  onToggleDirection: (direction: GradientBlurDirection) => void;
}

const STRATEGIES = [
  { value: "static", label: "初始" },
  { value: "scrollend", label: "停止后" },
  { value: "live", label: "实时" },
] as const;

const STRATEGY_NOTES: Record<CaptureStrategy, string> = {
  static: "仅初始化与尺寸变化时捕获，开销最低。",
  scrollend: "滚动时显示正文，停止后更新 WebGL 模糊。",
  live: "纹理内容变化时更新，无固定帧率上限。",
};

export function BlurControls({
  backend,
  activeBackend,
  onBackendChange,
  directions,
  height,
  maxRadius,
  strategy,
  onHeightChange,
  onRadiusChange,
  onReset,
  onStrategyChange,
  onToggleDirection,
}: BlurControlsProps) {
  const cssOnly = activeBackend === "css";
  return (
    <aside className={styles.controls} aria-label="模糊参数">
      <div className={styles.controlsHeader}>
        <div>
          <p>渲染参数</p>
          <span>
            {cssOnly ? "指数半径 · 重叠遮罩" : "采样分区随模糊半径调整"}
          </span>
        </div>
        <button type="button" onClick={onReset}>
          重置
        </button>
      </div>

      <BackendControl
        backend={backend}
        activeBackend={activeBackend}
        onChange={onBackendChange}
      />

      <fieldset className={styles.fieldset}>
        <legend>覆盖边缘</legend>
        <div className={styles.directionButtons}>
          {(["top", "bottom"] as const).map((direction) => (
            <button
              key={direction}
              type="button"
              aria-pressed={directions[direction]}
              onClick={() => onToggleDirection(direction)}
            >
              <span aria-hidden="true" data-direction={direction} />
              {direction === "top" ? "顶部" : "底部"}
            </button>
          ))}
        </div>
      </fieldset>

      <RangeControl
        id="radius"
        label="最大半径"
        max={48}
        min={0}
        value={maxRadius}
        onChange={onRadiusChange}
      />
      <RangeControl
        id="height"
        label="覆盖高度"
        max={176}
        min={64}
        value={height}
        onChange={onHeightChange}
      />

      {!cssOnly && (
        <fieldset className={styles.fieldset}>
          <legend>纹理更新</legend>
          <div className={styles.segmented}>
            {STRATEGIES.map((option) => (
              <label key={option.value}>
                <input
                  checked={strategy === option.value}
                  name="capture-strategy"
                  type="radio"
                  value={option.value}
                  onChange={() => onStrategyChange(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          <p className={styles.strategyNote}>
            <code>{strategy}</code>
            {STRATEGY_NOTES[strategy]}
          </p>
        </fieldset>
      )}

      <div className={styles.renderFact}>
        <span>
          {cssOnly
            ? maxRadius > 0
              ? CSS_BLUR_LAYERS
              : 0
            : 9}
        </span>
        <p>
          {cssOnly ? "层 backdrop-filter / 边缘" : "次双线性采样 / 轴（至多）"}
        </p>
        <small>
          {cssOnly
            ? "随原生滚动合成，无快照延迟"
            : "分离式高斯 · 自适应分辨率 · 按内容更新"}
        </small>
      </div>
    </aside>
  );
}
