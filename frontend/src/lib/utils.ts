import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind CSS classes with clsx. Used by shadcn/ui components. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number as CHF currency string. */
export function formatCHF(amount: number): string {
  return new Intl.NumberFormat("fr-CH", {
    style: "currency",
    currency: "CHF",
    minimumFractionDigits: 2,
  }).format(amount);
}

/** Format an ISO date string to a localised short date using fr-CH locale. */
export function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat("fr-CH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(isoDate));
}
