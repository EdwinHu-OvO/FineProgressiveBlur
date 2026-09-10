import { useState } from "react";
import { GlassCard } from "../GlassCard";
import styles from "./projects.module.css";
import base from "./widgets.module.css";

const PROJECTS = [
  {
    name: "Fine Progressive Blur",
    detail: "渲染与交互实验",
    initials: "Fb",
    progress: 76,
    date: "09.18",
  },
  {
    name: "Quiet Workspace",
    detail: "个人工作区设计",
    initials: "Qw",
    progress: 48,
    date: "09.24",
  },
  {
    name: "Field Notes",
    detail: "观察与灵感收集",
    initials: "Fn",
    progress: 100,
    date: "09.08",
  },
];
export function ProjectTable() {
  const [activeOnly, setActiveOnly] = useState(false);
  const projects = PROJECTS.filter(
    (project) => !activeOnly || project.progress < 100,
  );
  return (
    <GlassCard id="projects" span={8}>
      <div className={base.cardHeading}>
        <h2>正在推进</h2>
        <div className={base.segmented}>
          <button
            type="button"
            aria-pressed={!activeOnly}
            onClick={() => setActiveOnly(false)}
          >
            全部
          </button>
          <button
            type="button"
            aria-pressed={activeOnly}
            onClick={() => setActiveOnly(true)}
          >
            进行中
          </button>
        </div>
      </div>
      <div className={styles.projectList}>
        {projects.map((project) => (
          <div key={project.name} className={styles.project}>
            <span className={styles.projectIcon}>{project.initials}</span>
            <div className={styles.projectName}>
              <strong>{project.name}</strong>
              <small>{project.detail}</small>
            </div>
            <div className={styles.projectProgress}>
              <span>{project.progress}%</span>
              <div>
                <i style={{ width: `${project.progress}%` }} />
              </div>
            </div>
            <span className={styles.projectDate}>{project.date}</span>
          </div>
        ))}
      </div>
      <div className={base.overviewFooter}>
        <span>示例项目</span>
        <span>{projects.length} 个项目</span>
      </div>
    </GlassCard>
  );
}
