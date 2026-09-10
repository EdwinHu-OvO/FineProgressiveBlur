import { useState } from "react";
import { GlassCard } from "../GlassCard";
import { Icon } from "../Icon";
import styles from "./overview.module.css";
import base from "./widgets.module.css";

const WEEKS = [
  [3.2, 4.8, 3.9, 5.6, 4.1, 2.2, 0.8],
  [2.8, 3.7, 4.2, 3.8, 3.6, 2.8, 1.2],
];
export function ActivityOverview() {
  const [week, setWeek] = useState(0);
  const hours = WEEKS[week];
  return (
    <GlassCard id="overview" span={8}>
      <div className={base.cardHeading}>
        <h2>专注趋势</h2>
        <div className={base.segmented} aria-label="趋势时间范围">
          {["本周", "上周"].map((label, index) => (
            <button
              key={label}
              type="button"
              aria-pressed={week === index}
              onClick={() => setWeek(index)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.overviewTotal}>
        <strong>
          {hours.reduce((sum, value) => sum + value, 0).toFixed(1)}
          <small> 小时</small>
        </strong>
        <span>
          <Icon name="arrow" size={13} />
          {week === 0 ? "+11.3%" : "+6.2%"}
          <small> 较前一周</small>
        </span>
      </div>
      <div
        className={styles.barChart}
        role="img"
        aria-label={`${week === 0 ? "本周" : "上周"}每日专注时长：${hours.join("、")}小时`}
      >
        <div className={styles.chartLines}>
          <span>6h</span>
          <span>3h</span>
          <span>0h</span>
        </div>
        <div className={styles.bars}>
          {hours.map((value, index) => (
            <div key={index}>
              <div className={styles.barSlot}>
                <span
                  data-highlight={index === 3}
                  style={{ height: `${(value / 6) * 100}%` }}
                >
                  <i>{value}h</i>
                </span>
              </div>
              <small>
                {
                  ["周一", "周二", "周三", "周四", "周五", "周六", "周日"][
                    index
                  ]
                }
              </small>
            </div>
          ))}
        </div>
      </div>
      <div className={base.overviewFooter}>
        <span>
          <i /> 深度工作
        </span>
        <span>每日的投入，慢慢累积。</span>
      </div>
    </GlassCard>
  );
}
