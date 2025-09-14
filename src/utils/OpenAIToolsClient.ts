export class OpenAIToolsClient {
  static extractJavaScriptCode(text: string): string[] {
    if (!text) return [];
    const codeBlocks: string[] = [];
    const regex = /```\s*javascript\s*([\s\S]*?)```/gi;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const code = (match[1] || '').trim();
      if (code) codeBlocks.push(code);
    }
    // Fallback: generic triple backticks without language
    if (codeBlocks.length === 0) {
      const generic = /```\s*([\s\S]*?)```/gi;
      while ((match = generic.exec(text)) !== null) {
        const snippet = (match[1] || '').trim();
        // Heuristic: looks like JS if it has document/querySelector/function/await
        if (/document|querySelector|function\s*\(|=>|await|console\./.test(snippet)) {
          codeBlocks.push(snippet);
        }
      }
    }
    return codeBlocks;
  }

  static generateExecutableCodePrompt(context: Record<string, unknown>, previous?: string): string {
    const ctx = JSON.stringify(context, null, 2);
    const prev = previous ? `\nPrevious analysis/context:\n${previous.substring(0, 2000)}` : '';
    return `Generate ONLY executable JavaScript code (inside a javascript code block) that runs in the page context.\n` +
      `Requirements:\n` +
      `- Handle modals/popups first if present\n` +
      `- Use querySelector/querySelectorAll carefully\n` +
      `- Await async operations and return a result object { success: boolean, message?: string }\n` +
      `- Include try/catch with meaningful errors\n\n` +
      `Context:\n${ctx}${prev}`;
  }
}

