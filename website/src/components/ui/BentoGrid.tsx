import { ReactNode } from "react";

export interface BentoGridProps {
  children: ReactNode;
  /** Number of columns on desktop (2-4) */
  columns?: 2 | 3 | 4;
  className?: string;
}

export interface BentoItemProps {
  children: ReactNode;
  /** Column span (1-3) */
  colSpan?: 1 | 2 | 3;
  /** Row span (1-2) */
  rowSpan?: 1 | 2;
  className?: string;
}

export function BentoGrid({ children, columns = 3, className = "" }: BentoGridProps) {
  const colClass = {
    2: "md:grid-cols-2",
    3: "md:grid-cols-3",
    4: "md:grid-cols-4",
  }[columns];

  return (
    <div className={`grid grid-cols-1 ${colClass} gap-4 md:gap-6 ${className}`}>
      {children}
    </div>
  );
}

export function BentoItem({ children, colSpan = 1, rowSpan = 1, className = "" }: BentoItemProps) {
  const spanClass = `col-span-1 md:col-span-${colSpan} row-span-${rowSpan}`;
  return (
    <div className={`${spanClass} ${className}`}>
      {children}
    </div>
  );
}
