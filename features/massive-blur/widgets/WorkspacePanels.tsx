import { useState } from "react";
import { GlassCard } from "../GlassCard";
import { Icon } from "../Icon";
import styles from "./workspace.module.css";
import base from "./widgets.module.css";

const INITIAL_TASKS = [
  { title: "整理本周的设计参考", tag: "设计", done: true },
  { title: "确认组件的交互细节", tag: "产品", done: true },
  { title: "检查大面积模糊表现", tag: "开发", done: false },
  { title: "为下一次迭代留下注记", tag: "计划", done: false },
];
const SCHEDULE = [
  ["09:30", "设计同步", "30 min · 工作室"],
  ["14:00", "留一段深度工作时间", "90 min · 个人安排"],
  ["16:30", "走出去，换一换视野", "30 min · 户外"],
];

export function WorkspacePanels() {
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const done = tasks.filter((task) => task.done).length;
  return (
    <>
      <GlassCard id="tasks">
        <div className={base.cardHeading}>
          <h2>今日待办</h2>
          <span>
            {done} / {tasks.length}
          </span>
        </div>
        <div className={styles.tasks}>
          {tasks.map((task, index) => (
            <label key={task.title} data-done={task.done}>
              <input
                type="checkbox"
                checked={task.done}
                onChange={() =>
                  setTasks((current) =>
                    current.map((entry, i) =>
                      i === index ? { ...entry, done: !entry.done } : entry,
                    ),
                  )
                }
              />
              <span>
                {task.title}
                <small>{task.tag}</small>
              </span>
            </label>
          ))}
        </div>
        <p className={base.cardFootnote}>按自己的节奏，一件一件完成。</p>
      </GlassCard>
      <GlassCard id="schedule">
        <div className={base.cardHeading}>
          <h2>日程安排</h2>
          <Icon name="clock" />
        </div>
        <div className={styles.schedule}>
          {SCHEDULE.map(([time, title, meta], index) => (
            <div key={time}>
              <time>{time}</time>
              <span
                className={styles.scheduleMark}
                data-current={index === 1}
              />
              <div>
                <strong>{title}</strong>
                <small>{meta}</small>
              </div>
            </div>
          ))}
        </div>
        <p className={base.cardFootnote}>日程为演示内容</p>
      </GlassCard>
      <GlassCard id="progress">
        <div className={base.cardHeading}>
          <h2>今日进度</h2>
          <Icon name="leaf" />
        </div>
        <div className={styles.progressNumber}>
          <strong>
            {Math.round((done / tasks.length) * 100)}
            <small>%</small>
          </strong>
          <span>已完成今日计划</span>
        </div>
        <div
          className={styles.progressTrack}
          role="progressbar"
          aria-label="今日任务完成度"
          aria-valuenow={done}
          aria-valuemin={0}
          aria-valuemax={tasks.length}
        >
          {tasks.map((task, index) => (
            <span key={task.title} data-filled={index < done} />
          ))}
        </div>
        <div className={styles.progressStats}>
          <div>
            <strong>{done}</strong>
            <span>已经完成</span>
          </div>
          <div>
            <strong>{tasks.length - done}</strong>
            <span>等待继续</span>
          </div>
        </div>
      </GlassCard>
    </>
  );
}
