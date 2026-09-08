"use client";

import { useState } from "react";
import styles from "./demo-stage.module.css";

const NOTES = [
  ["08:40", "北坡", "云层沿山脊抬升，能见度 12 km。"],
  ["10:15", "林线", "风速稳定在 4.8 m/s，针叶表面开始干燥。"],
  ["12:05", "溪谷", "水温 7.2°C，石面反射出现清晰高光。"],
  ["14:30", "西脊", "低饱和蓝灰进入阴影，轮廓保持完整。"],
] as const;

export function DemoScrollContent() {
  const [saved, setSaved] = useState(false);

  return (
    <article className={styles.document}>
      <nav className={styles.documentNav} aria-label="文档位置">
        <span>Field Notes</span>
        <span>028 / 064</span>
      </nav>

      <header className={styles.documentHeader}>
        <p>September survey · Hengduan range</p>
        <h2>山脊之上的缓慢天气</h2>
        <div className={styles.documentMeta}>
          <span>27°48′N</span>
          <span>3,840 m</span>
          <span>6 min read</span>
        </div>
      </header>

      <figure className={styles.terrainFigure} aria-label="抽象地形等高线图">
        <svg viewBox="0 0 720 300" role="img" aria-label="山地等高线">
          <rect width="720" height="300" fill="#dfe7e5" />
          <path d="M-20 248C92 178 121 75 226 98s107 129 221 90 133-137 294-102" />
          <path d="M-12 272C104 200 140 99 232 123s112 126 218 91 139-128 286-102" />
          <path d="M28 298C130 224 165 127 247 148s111 121 211 91 138-113 269-96" />
          <path d="M72 316C159 247 193 154 266 174s107 110 198 84 129-94 244-79" />
          <path d="M103 330C184 270 223 186 290 199s96 94 180 73 118-78 217-67" />
          <path d="M383-18c-21 65-1 113 53 133s111-14 157 26 40 97 93 125" />
          <path d="M425-28c-16 58 2 101 51 119s102-11 144 25 39 86 86 111" />
          <circle cx="229" cy="99" r="5" />
          <circle cx="594" cy="141" r="5" />
        </svg>
        <figcaption>
          <span>观测剖面 B–07</span>
          <span>等高距 40 m</span>
        </figcaption>
      </figure>

      <section className={styles.lead}>
        <p>
          云并不是突然抵达的。它先把远处岩层的对比度轻轻压低，再沿着林线移动，像一层极薄、连续变化的玻璃。
        </p>
        <button type="button" onClick={() => setSaved((value) => !value)}>
          {saved ? "已保存" : "保存片段"}
        </button>
      </section>

      <section
        className={styles.observations}
        aria-labelledby="observations-title"
      >
        <div className={styles.sectionHeading}>
          <h3 id="observations-title">逐时观测</h3>
          <span>UTC +08</span>
        </div>
        {NOTES.map(([time, place, note], index) => (
          <div
            className={styles.observation}
            key={time}
            id={`field-note-${index + 1}`}
          >
            <time>{time}</time>
            <span>{place}</span>
            <p>{note}</p>
          </div>
        ))}
      </section>

      <blockquote className={styles.quote}>
        “边缘真正消失时，人不会注意到效果本身，只会自然地继续阅读。”
      </blockquote>

      <section className={styles.textColumns}>
        <p>
          午后风向转西，湿润空气被推向更高的坡面。近处细节仍然锋利，远处的树冠则逐渐合并为安静的灰绿色层次。
        </p>
        <p>
          记录的意义不在于冻结景象，而在于保留变化的速度：哪些边界先软化，哪些纹理最后才从视野里退去。
        </p>
      </section>

      <footer className={styles.documentFooter}>
        <span>End of note 028</span>
        <a href="#field-note-1">返回首条观测</a>
      </footer>
    </article>
  );
}
