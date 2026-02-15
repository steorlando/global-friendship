export function parseCsvText(text: string, delimiter = ";"): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  const pushCell = () => {
    currentRow.push(currentCell);
    currentCell = "";
  };

  const pushRow = () => {
    if (currentRow.length === 0) return;
    rows.push(currentRow);
    currentRow = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentCell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      pushCell();
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") i += 1;
      pushCell();
      pushRow();
      continue;
    }

    currentCell += char;
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    pushCell();
    pushRow();
  }

  return rows;
}

export function parseCsvObjects(text: string, delimiter = ";"): Record<string, string>[] {
  const rows = parseCsvText(text, delimiter);
  if (rows.length === 0) return [];

  const rawHeaders = rows[0].map((header) => header.replace(/^\uFEFF/, "").trim());
  const body = rows.slice(1);

  return body.map((row) => {
    const obj: Record<string, string> = {};
    for (let i = 0; i < rawHeaders.length; i += 1) {
      obj[rawHeaders[i]] = (row[i] ?? "").trim();
    }
    return obj;
  });
}
