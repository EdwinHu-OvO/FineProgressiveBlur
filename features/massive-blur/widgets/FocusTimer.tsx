import { useEffect, useRef, useState } from "react";
import { GlassCard } from "../GlassCard";
import { Icon } from "../Icon";
import styles from "./focus.module.css";
import base from "./widgets.module.css";

const SESSION = 25 * 60;
export function FocusTimer() {
  const [remaining, setRemaining] = useState(SESSION);
  const [running, setRunning] = useState(false);
  const deadline = useRef(0);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      const seconds = Math.max(
        0,
        Math.ceil((deadline.current - Date.now()) / 1000),
      );
      setRemaining(seconds);
      if (!seconds) setRunning(false);
    }, 250);
    return () => clearInterval(timer);
  }, [running]);
  const toggle = () => {
    if (!running) {
      const duration = remaining || SESSION;
      setRemaining(duration);
      deadline.current = Date.now() + duration * 1000;
    }
    setRunning(!running);
  };
  return (
    <GlassCard id="focus">
      <div className={base.cardHeading}>
        <h2>专注时段</h2>
        <Icon name="clock" />
      </div>
      <div className={styles.timer}>
        <svg viewBox="0 0 180 180" aria-hidden="true">
          <circle cx="90" cy="90" r="79" className={styles.ringTrack} />
          <circle
            cx="90"
            cy="90"
            r="79"
            className={styles.ringValue}
            strokeDasharray={496.37}
            strokeDashoffset={496.37 * (1 - remaining / SESSION)}
          />
        </svg>
        <div>
          <strong>
            {String(Math.floor(remaining / 60)).padStart(2, "0")}
            <span>:</span>
            {String(remaining % 60).padStart(2, "0")}
          </strong>
          <small>
            {running
              ? "留在此刻"
              : remaining === 0
                ? "专注完成"
                : "准备好，再开始"}
          </small>
        </div>
      </div>
      <div className={styles.timerControls}>
        <button type="button" className={base.primaryButton} onClick={toggle}>
          <Icon name={running ? "pause" : "play"} size={14} />
          {running ? "暂停" : remaining === SESSION ? "开始专注" : "继续专注"}
        </button>
        <button
          type="button"
          className={base.iconButton}
          aria-label="重置专注计时"
          onClick={() => {
            setRunning(false);
            setRemaining(SESSION);
          }}
        >
          <Icon name="reset" size={17} />
        </button>
      </div>
    </GlassCard>
  );
}
