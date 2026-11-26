import type { ReactNode } from 'react';

/**
 * Renderizador mínimo y seguro de Markdown para las respuestas del asesor:
 * títulos, listas, negrita, cursiva y código en línea. Construye elementos de
 * React (nunca HTML crudo), así que el texto del modelo no puede inyectar
 * etiquetas ni scripts.
 */
const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;

function renderInline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }
    if (
      part.length > 2 &&
      ((part.startsWith('*') && part.endsWith('*')) ||
        (part.startsWith('_') && part.endsWith('_')))
    ) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

const BULLET = /^\s*[-*+]\s+/;
const NUMBERED = /^\s*\d+[.)]\s+/;
const HEADING = /^\s*#{1,6}\s+(.*)$/;
const TABLE = /^\s*\|/;
const TABLE_SEPARATOR = /^\s*\|?\s*:?-{2,}/;
const RULE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;

function isSpecial(line: string): boolean {
  return (
    RULE.test(line) ||
    BULLET.test(line) ||
    NUMBERED.test(line) ||
    HEADING.test(line) ||
    TABLE.test(line)
  );
}

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }

    if (RULE.test(line)) {
      blocks.push(<hr key={i} />);
      i++;
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push(
        <h4 className="md-heading" key={i}>
          {renderInline(heading[1].replace(/\*\*/g, ''))}
        </h4>,
      );
      i++;
      continue;
    }

    if (BULLET.test(line) || NUMBERED.test(line)) {
      const ordered = NUMBERED.test(line);
      const pattern = ordered ? NUMBERED : BULLET;
      const start = i;
      const items: string[] = [];
      while (i < lines.length && pattern.test(lines[i])) {
        items.push(lines[i].replace(pattern, ''));
        i++;
      }
      const children = items.map((item, k) => (
        <li key={k}>{renderInline(item)}</li>
      ));
      blocks.push(
        ordered ? (
          <ol key={start}>{children}</ol>
        ) : (
          <ul key={start}>{children}</ul>
        ),
      );
      continue;
    }

    if (TABLE.test(line)) {
      // Las tablas se muestran como filas de texto: no hace falta otro formato.
      const start = i;
      const rows: string[] = [];
      while (i < lines.length && TABLE.test(lines[i])) {
        if (!TABLE_SEPARATOR.test(lines[i].replace(/^\s*\|/, '|'))) {
          rows.push(
            lines[i]
              .split('|')
              .map((cell) => cell.trim())
              .filter(Boolean)
              .join(' · '),
          );
        }
        i++;
      }
      blocks.push(
        <p key={start}>
          {rows.flatMap((row, k) =>
            k
              ? [<br key={`br${k}`} />, ...renderInline(row)]
              : renderInline(row),
          )}
        </p>,
      );
      continue;
    }

    const start = i;
    const paragraph: string[] = [];
    while (i < lines.length && lines[i].trim() && !isSpecial(lines[i])) {
      paragraph.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={start}>
        {paragraph.flatMap((row, k) =>
          k ? [<br key={`br${k}`} />, ...renderInline(row)] : renderInline(row),
        )}
      </p>,
    );
  }

  return <div className="md">{blocks}</div>;
}
