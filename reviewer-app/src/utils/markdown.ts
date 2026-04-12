export interface Section {
  id: string;
  title: string;
  level: number;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export function parseMarkdownToHtml(md: string): string {
  const lines = md.split('\n');
  const output: string[] = [];
  let i = 0;
  let inSection = false;

  function closeSection() {
    if (inSection) {
      output.push('</section>');
      inSection = false;
    }
  }

  function openSection(title: string) {
    closeSection();
    const id = slugify(title);
    output.push(
      `<section id="${id}" data-section-title="${escapeAttr(title)}" class="annotatable">`
    );
    inSection = true;
  }

  function escapeAttr(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  }

  function escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function inlineFormat(text: string): string {
    // Bold before italic to handle **bold** correctly
    return text
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  }

  while (i < lines.length) {
    const line = lines[i];

    // Code block (triple backtick)
    const codeBlockMatch = line.match(/^```(\w*)$/);
    if (codeBlockMatch) {
      const lang = codeBlockMatch[1];
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      const codeContent = escapeHtml(codeLines.join('\n'));
      if (lang === 'mermaid') {
        output.push(`<pre class="mermaid">${codeContent}</pre>`);
      } else if (lang) {
        output.push(
          `<pre><code class="language-${escapeAttr(lang)}">${codeContent}</code></pre>`
        );
      } else {
        output.push(`<pre><code>${codeContent}</code></pre>`);
      }
      i++;
      continue;
    }

    // Headings
    const h3Match = line.match(/^### (.+)$/);
    if (h3Match) {
      const title = h3Match[1];
      const id = slugify(title);
      output.push(`<h3 id="${id}">${inlineFormat(escapeHtml(title))}</h3>`);
      i++;
      continue;
    }

    const h2Match = line.match(/^## (.+)$/);
    if (h2Match) {
      const title = h2Match[1];
      openSection(title);
      output.push(`<h2>${inlineFormat(escapeHtml(title))}</h2>`);
      i++;
      continue;
    }

    const h1Match = line.match(/^# (.+)$/);
    if (h1Match) {
      const title = h1Match[1];
      const id = slugify(title);
      output.push(`<h1 id="${id}">${inlineFormat(escapeHtml(title))}</h1>`);
      i++;
      continue;
    }

    // Table: detect lines starting with |
    if (line.startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }

      if (tableLines.length >= 2) {
        const headerRow = tableLines[0];
        const separatorRow = tableLines[1];
        const isSeparator = /^\|[\s|:-]+\|$/.test(separatorRow);

        const parseRow = (row: string): string[] =>
          row
            .split('|')
            .slice(1, -1)
            .map((cell) => cell.trim());

        output.push('<table>');

        if (isSeparator) {
          const headers = parseRow(headerRow);
          output.push('<thead><tr>');
          for (const h of headers) {
            output.push(`<th>${inlineFormat(escapeHtml(h))}</th>`);
          }
          output.push('</tr></thead>');

          if (tableLines.length > 2) {
            output.push('<tbody>');
            for (let r = 2; r < tableLines.length; r++) {
              const cells = parseRow(tableLines[r]);
              output.push('<tr>');
              for (const c of cells) {
                output.push(`<td>${inlineFormat(escapeHtml(c))}</td>`);
              }
              output.push('</tr>');
            }
            output.push('</tbody>');
          }
        } else {
          output.push('<tbody>');
          for (const tl of tableLines) {
            const cells = parseRow(tl);
            output.push('<tr>');
            for (const c of cells) {
              output.push(`<td>${inlineFormat(escapeHtml(c))}</td>`);
            }
            output.push('</tr>');
          }
          output.push('</tbody>');
        }

        output.push('</table>');
      }
      continue;
    }

    // List items
    if (line.match(/^- /)) {
      const listLines: string[] = [];
      while (i < lines.length && lines[i].match(/^- /)) {
        listLines.push(lines[i]);
        i++;
      }
      output.push('<ul>');
      for (const ll of listLines) {
        const unchecked = ll.match(/^- \[ \] (.+)$/);
        const checked = ll.match(/^- \[x\] (.+)$/i);
        const plain = ll.match(/^- (.+)$/);

        if (unchecked) {
          output.push(
            `<li><input type="checkbox" disabled> ${inlineFormat(escapeHtml(unchecked[1]))}</li>`
          );
        } else if (checked) {
          output.push(
            `<li><input type="checkbox" disabled checked> ${inlineFormat(escapeHtml(checked[1]))}</li>`
          );
        } else if (plain) {
          output.push(`<li>${inlineFormat(escapeHtml(plain[1]))}</li>`);
        }
      }
      output.push('</ul>');
      continue;
    }

    // Blank line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Paragraph: collect non-blank, non-special lines
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].match(/^#{1,3} /) &&
      !lines[i].match(/^- /) &&
      !lines[i].startsWith('|') &&
      !lines[i].match(/^```/)
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      output.push(`<p>${inlineFormat(escapeHtml(paraLines.join(' ')))}</p>`);
    }
  }

  closeSection();
  return output.join('\n');
}

export function extractSections(md: string): Section[] {
  const sections: Section[] = [];
  const lines = md.split('\n');

  for (const line of lines) {
    const h1 = line.match(/^# (.+)$/);
    const h2 = line.match(/^## (.+)$/);
    const h3 = line.match(/^### (.+)$/);

    if (h1) {
      const title = h1[1];
      sections.push({ id: slugify(title), title, level: 1 });
    } else if (h2) {
      const title = h2[1];
      sections.push({ id: slugify(title), title, level: 2 });
    } else if (h3) {
      const title = h3[1];
      sections.push({ id: slugify(title), title, level: 3 });
    }
  }

  return sections;
}

export function extractMermaidBlocks(html: string): string[] {
  const regex = /<pre class="mermaid">([\s\S]*?)<\/pre>/g;
  const blocks: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    blocks.push(match[1]);
  }

  return blocks;
}
