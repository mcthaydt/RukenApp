/**
 * Rows of text from a CSV file: commas between fields, quoted fields that may hold commas and line breaks, a doubled
 * quote for a quote inside one, and `\r\n` or `\n` between rows. Every field comes back as written, as text. An empty
 * line is not a row, so a file's last line end does not add one.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  // True once the line has a field, even an empty one, so an empty line can be told from a line of one empty field.
  let lineHasField = false;

  const endRow = () => {
    if (lineHasField) {
      row.push(field);
      rows.push(row);
    }
    row = [];
    field = "";
    lineHasField = false;
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text.charAt(index);
    if (inQuotes) {
      if (char !== '"') {
        field += char;
      } else if (text.charAt(index + 1) === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = false;
      }
    } else if (char === '"' && field === "") {
      inQuotes = true;
      lineHasField = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
      lineHasField = true;
    } else if (char === "\n" || (char === "\r" && text.charAt(index + 1) === "\n")) {
      if (char === "\r") index += 1;
      endRow();
    } else {
      field += char;
      lineHasField = true;
    }
  }
  if (inQuotes) throw new RangeError("The CSV has a quote that never closes");
  endRow();
  return rows;
}
