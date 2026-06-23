declare module "*.css";

declare module "markdown-text-editor" {
  export default class MarkdownEditor {
    constructor(target: string | HTMLTextAreaElement, options?: Record<string, unknown>);
    destroy(): void;
  }
}
