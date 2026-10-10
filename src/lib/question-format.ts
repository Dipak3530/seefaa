/** Repair only visibly wrapped Markdown table rows; never infer missing cells. */
export function formatQuestionMarkdown(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const result: string[] = [];
  let columns = 0;
  const cells = (line: string) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|");
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (line.trim().startsWith("|")) {
      const parts = cells(line);
      if (parts.every((cell) => /^\s*:?-+:?\s*$/.test(cell))) {
        columns = parts.length;
        line = `| ${parts.map((cell) => cell.trim().replace(/-+/, "---")).join(" | ")} |`;
      } else if (columns && parts.length < columns && i + 1 < lines.length) {
        const next = lines[i + 1].trim();
        if (next && !next.startsWith("|") && next.endsWith("|") && cells(`${line} ${next}`).length === columns) {
          line = `${line} ${next}`;
          i++;
        }
      }
    } else {
      columns = 0;
    }
    result.push(line);
  }
  return result.join("\n");
}