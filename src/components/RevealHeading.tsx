"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

export default function RevealHeading({
  children,
  as: Tag = "h1",
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  as?: "h1" | "h2" | "h3" | "p";
  className?: string;
  delay?: number;
}) {
  return (
    <div className="overflow-hidden">
      <motion.div
        initial={{ y: "110%" }}
        animate={{ y: 0 }}
        transition={{ duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] }}
      >
        <Tag className={className}>{children}</Tag>
      </motion.div>
    </div>
  );
}
