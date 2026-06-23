export type ThemeName = "claude" | "claude-dark";

export function nextTheme(theme: ThemeName): ThemeName {
  return theme === "claude-dark" ? "claude" : "claude-dark";
}

export function applyTheme(root: HTMLElement, theme: ThemeName) {
  root.dataset.theme = theme;
}
