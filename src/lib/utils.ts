import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Joins class names and resolves Tailwind conflicts (used by the Magic UI components). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
