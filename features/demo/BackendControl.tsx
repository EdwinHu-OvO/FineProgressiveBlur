import { useSyncExternalStore } from "react";
import type {
  GradientBlurBackend,
  GradientBlurActiveBackend,
} from "@/components/gradient-blur";
import { supportsNativeCanvas } from "@/components/gradient-blur/native/html-in-canvas-api";
import { useWebGL2Support } from "@/components/gradient-blur/engine/webgl-support";
import styles from "./controls.module.css";

interface BackendControlProps {
  backend: GradientBlurBackend;
  activeBackend: GradientBlurActiveBackend;
  onChange(backend: GradientBlurBackend): void;
}

const subscribe = () => () => {};
const serverSupport = () => false;
const LABELS = {
  pending: "准备中",
  "html-in-canvas": "HTML-in-Canvas",
  rito: "Rito Canvas",
  css: "纯 CSS",
  unavailable: "纹理后端不可用",
};

export function BackendControl({
  backend,
  activeBackend,
  onChange,
}: BackendControlProps) {
  const webgl = useWebGL2Support();
  const nativeSupported = useSyncExternalStore(
    subscribe,
    supportsNativeCanvas,
    serverSupport,
  );
  return (
    <fieldset className={styles.fieldset}>
      <legend>
        <label htmlFor="render-backend">渲染后端</label>
      </legend>
      <select
        id="render-backend"
        className={styles.backendSelect}
        value={backend}
        onChange={(event) =>
          onChange(event.target.value as GradientBlurBackend)
        }
      >
        <option value="auto">自动选择</option>
        <option value="html-in-canvas" disabled={!nativeSupported || !webgl}>
          HTML-in-Canvas{nativeSupported ? "" : " · 不可用"}
        </option>
        <option value="rito" disabled={!webgl}>
          Rito Canvas + WebGL
        </option>
      </select>
      <p className={styles.strategyNote} role="status">
        当前：{LABELS[activeBackend]}。
        {activeBackend === "css"
          ? "WebGL2 不可用，启用分层 CSS 保底。"
          : activeBackend === "unavailable"
            ? "当前内容无法绘制，保留原生正文。切换后端可重试。"
            : activeBackend === "rito"
              ? "正文缓存，滚动复用 GPU 纹理。"
              : backend === "auto"
                ? "优先 HTML-in-Canvas，其次 Rito。"
                : null}
      </p>
    </fieldset>
  );
}
