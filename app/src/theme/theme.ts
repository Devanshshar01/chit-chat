/**
 * Theme system: light / dark / system, plus a font-size scale. Both
 * persist in the local settings table so they survive app restarts.
 */
export type ThemeMode = 'light' | 'dark' | 'system';
export type FontScale = 'small' | 'medium' | 'large';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceBorder: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  bubbleOutgoing: string;
  bubbleIncoming: string;
  bubbleTextOutgoing: string;
  bubbleTextIncoming: string;
  danger: string;
  tickDefault: string;
  tickRead: string;
  starAccent: string;
}

export const darkColors: ThemeColors = {
  background: '#0b0b0f',
  surface: '#151519',
  surfaceBorder: '#333',
  textPrimary: '#ffffff',
  textSecondary: '#888888',
  accent: '#4f46e5',
  bubbleOutgoing: '#4f46e5',
  bubbleIncoming: '#1f1f26',
  bubbleTextOutgoing: '#ffffff',
  bubbleTextIncoming: '#ffffff',
  danger: '#f87171',
  tickDefault: '#9ca3af',
  tickRead: '#60a5fa',
  starAccent: '#fbbf24',
};

export const lightColors: ThemeColors = {
  background: '#f5f5f7',
  surface: '#ffffff',
  surfaceBorder: '#d4d4d8',
  textPrimary: '#111114',
  textSecondary: '#6b7280',
  accent: '#4f46e5',
  bubbleOutgoing: '#4f46e5',
  bubbleIncoming: '#e5e7eb',
  bubbleTextOutgoing: '#ffffff',
  bubbleTextIncoming: '#111114',
  danger: '#dc2626',
  tickDefault: '#6b7280',
  tickRead: '#2563eb',
  starAccent: '#d97706',
};

export const FONT_SCALES: Record<FontScale, number> = {
  small: 0.85,
  medium: 1,
  large: 1.2,
};
