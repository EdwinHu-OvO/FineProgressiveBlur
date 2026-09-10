import type { ReactNode } from "react";
import styles from "./dashboard.module.css";

export function GlassCard({
  id,
  span = 4,
  children,
  className = "",
}: {
  id: string;
  span?: 4 | 5 | 7 | 8 | 12;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      data-blur-card={id}
      data-span={span}
      className={`${styles.card} ${className}`}
    >
      {children}
    </section>
  );
}
