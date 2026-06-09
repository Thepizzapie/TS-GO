"use client";
/**
 * ArcadeButton — chunky pixel button with a physical press (:active shifts
 * into its own hard shadow). Variants map to .arc-btn-- classes in globals.css.
 */
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

export type ButtonVariant = "confirm" | "primary" | "danger" | "gold" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  confirm: "", // default green
  primary: "arc-btn--primary",
  danger: "arc-btn--danger",
  gold: "arc-btn--gold",
  ghost: "arc-btn--ghost",
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "arc-btn--sm",
  md: "",
  lg: "arc-btn--lg",
};

export function ArcadeButton({
  children,
  variant = "confirm",
  size = "md",
  style,
  className,
  ...rest
}: {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  style?: CSSProperties;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = ["arc-btn", VARIANT_CLASS[variant], SIZE_CLASS[size], className]
    .filter(Boolean)
    .join(" ");
  return (
    <button className={cls} style={style} {...rest}>
      {children}
    </button>
  );
}
