(() => {
  const appendInline = (parent, text) => {
    const pattern = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*]+\*|_[^_]+_)/g;
    let cursor = 0;

    for (const match of text.matchAll(pattern)) {
      if (match.index > cursor) parent.append(document.createTextNode(text.slice(cursor, match.index)));

      const token = match[0];
      const element = document.createElement(token.startsWith('`') ? 'code' : token.length > 3 && (token.startsWith('**') || token.startsWith('__')) ? 'strong' : 'em');
      element.textContent = token.slice(element.tagName === 'STRONG' ? 2 : 1, element.tagName === 'STRONG' ? -2 : -1);
      parent.append(element);
      cursor = match.index + token.length;
    }

    if (cursor < text.length) parent.append(document.createTextNode(text.slice(cursor)));
  };

  const appendLines = (parent, lines) => {
    lines.forEach((line, index) => {
      if (index) parent.append(document.createElement('br'));
      appendInline(parent, line);
    });
  };

  const tableCells = line => line.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim());
  const isTableDivider = line => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
  const isBlockStart = (lines, index) => {
    const line = lines[index] || '';
    return /^#{1,4}\s+/.test(line) || /^\s*[-*+]\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line) || /^\s*([-*_])\1{2,}\s*$/.test(line) || (line.includes('|') && isTableDivider(lines[index + 1] || ''));
  };

  const renderMarkdown = text => {
    const root = document.createElement('div');
    root.className = 'ai-message-content';
    const lines = text.replace(/\r\n?/g, '\n').split('\n');

    for (let index = 0; index < lines.length;) {
      const line = lines[index];
      if (!line.trim()) { index += 1; continue; }

      const heading = line.match(/^(#{1,4})\s+(.+)$/);
      if (heading) {
        const element = document.createElement(`h${heading[1].length}`);
        appendInline(element, heading[2]);
        root.append(element);
        index += 1;
        continue;
      }

      if (line.includes('|') && isTableDivider(lines[index + 1] || '')) {
        const table = document.createElement('table');
        const head = document.createElement('thead');
        const headRow = document.createElement('tr');
        tableCells(line).forEach(value => {
          const cell = document.createElement('th');
          appendInline(cell, value);
          headRow.append(cell);
        });
        head.append(headRow);
        table.append(head);
        const body = document.createElement('tbody');
        index += 2;
        while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
          const row = document.createElement('tr');
          tableCells(lines[index]).forEach(value => {
            const cell = document.createElement('td');
            appendInline(cell, value);
            row.append(cell);
          });
          body.append(row);
          index += 1;
        }
        table.append(body);
        root.append(table);
        continue;
      }

      const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
      const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
      if (unordered || ordered) {
        const list = document.createElement(unordered ? 'ul' : 'ol');
        const matcher = unordered ? /^\s*[-*+]\s+(.+)$/ : /^\s*\d+[.)]\s+(.+)$/;
        while (index < lines.length) {
          const item = lines[index].match(matcher);
          if (!item) break;
          const listItem = document.createElement('li');
          appendInline(listItem, item[1]);
          list.append(listItem);
          index += 1;
        }
        root.append(list);
        continue;
      }

      if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
        root.append(document.createElement('hr'));
        index += 1;
        continue;
      }

      const paragraphLines = [line];
      index += 1;
      while (index < lines.length && lines[index].trim() && !isBlockStart(lines, index)) {
        paragraphLines.push(lines[index]);
        index += 1;
      }
      const paragraph = document.createElement('p');
      appendLines(paragraph, paragraphLines);
      root.append(paragraph);
    }

    return root;
  };

  const renderMessages = () => {
    document.querySelectorAll('.ai-message.assistant:not(.thinking) > p').forEach(message => {
      message.replaceWith(renderMarkdown(message.textContent || ''));
    });
  };

  new MutationObserver(renderMessages).observe(document.documentElement, { childList: true, subtree: true });
  renderMessages();
})();
