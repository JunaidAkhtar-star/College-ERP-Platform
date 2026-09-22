/**
 * Minimal RFC4180-ish CSV parser/serializer. No external dependency.
 * Handles quoted fields, escaped quotes (""), commas inside quotes, and \r\n.
 */

export const csvUtil = {
  parse(input: string | Buffer): Record<string, string>[] {
    const text = (typeof input === "string" ? input : input.toString("utf8")).replace(
      /^\uFEFF/,
      "",
    );
    const rows: string[][] = [];
    let cur: string[] = [];
    let field = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += ch;
        }
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === ",") {
          cur.push(field);
          field = "";
        } else if (ch === "\n" || ch === "\r") {
          if (ch === "\r" && text[i + 1] === "\n") i++;
          cur.push(field);
          field = "";
          if (cur.length > 1 || cur[0] !== "") rows.push(cur);
          cur = [];
        } else {
          field += ch;
        }
      }
    }
    if (field !== "" || cur.length) {
      cur.push(field);
      rows.push(cur);
    }
    if (!rows.length) return [];
    const headers = rows[0].map((h) => h.trim());
    return rows.slice(1).map((r) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        obj[h] = (r[idx] ?? "").trim();
      });
      return obj;
    });
  },

  serialize(headers: string[], rows: Record<string, unknown>[]): string {
    const escape = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(",")];
    for (const r of rows) lines.push(headers.map((h) => escape(r[h])).join(","));
    return lines.join("\n");
  },
};
