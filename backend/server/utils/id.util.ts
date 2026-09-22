import { nextSeq } from "../models/counter.model";

/**
 * Extract a two-digit year ("26") from either a 4-digit year (2026),
 * a numeric year, or an academicYear range like "2026-27".
 */
function yy(input?: string | number): string {
  if (input === undefined || input === null) {
    return new Date().getFullYear().toString().slice(-2);
  }
  const s = String(input).trim();
  // "2026-27" → "26"; "2026" → "26"; "26" → "26"
  const head = s.split("-")[0] ?? s;
  return head.length === 4 ? head.slice(-2) : head.slice(-2);
}

const ACRONYM_STOP_WORDS = new Set(["and", "of", "in", "the", "for"]);

/**
 * Derive a stable admission prefix from the configured curriculum programme.
 * B.Tech retains the institution's RE/LE convention; other programmes use a
 * recognizable programme acronym such as MCA, MBA, BCA or PHD.
 */
export function deriveStudentAdmissionCode(
  programme: string,
  admissionType: "regular" | "lateral_entry",
): string {
  const configured = programme.trim();
  const shortPart = (configured.split(/→|->/u)[0] ?? configured).trim();
  const compact = shortPart.replace(/[^a-z0-9]/gi, "").toUpperCase();
  if (["BTECH", "BE", "BACHELOROFTECHNOLOGY", "BACHELOROFENGINEERING"].includes(compact)) {
    return admissionType === "lateral_entry" ? "LE" : "RE";
  }
  if (
    compact.length >= 2 &&
    compact.length <= 6 &&
    (/\./.test(shortPart) || !/\s/.test(shortPart))
  ) {
    return compact;
  }

  const explicitAcronym = shortPart.match(/\b[A-Z][A-Z.]{1,7}\b/)?.[0]?.replace(/\./g, "");
  if (explicitAcronym && explicitAcronym.length >= 2) return explicitAcronym.slice(0, 6);

  const words = shortPart
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/[^a-z0-9]+/i)
    .filter((word) => word && !ACRONYM_STOP_WORDS.has(word.toLowerCase()));
  const acronym = words.length > 1 ? words.map((word) => word[0]).join("") : compact;
  const code = acronym.replace(/[^A-Z0-9]/g, "").slice(0, 6);
  if (code.length < 2)
    throw new Error(`Cannot derive an admission code from programme '${programme}'`);
  return code;
}

/**
 * Generate a student registration / admission ID.
 *
 * Format: `{YY}{CODE}{NNN}` — e.g. `26RE001`, `26LE042`, `26MCA001`.
 *   - YY = last two digits of the admission year.
 *   - B.Tech uses RE (regular) or LE (lateral entry).
 *   - Other programmes use their derived programme acronym.
 *   - NNN = 3-digit sequence, atomic & per-(year, programme/type code).
 *
 * Used as both the student's login ID and their permanent registration number.
 */
export async function generateStudentRegNo(
  admissionType: "regular" | "lateral_entry",
  academicYear: string,
  programme: string,
): Promise<string> {
  const year = yy(academicYear);
  const code = deriveStudentAdmissionCode(programme, admissionType);
  const seq = await nextSeq(`student:${year}:${code}`);
  return `${year}${code}${String(seq).padStart(3, "0")}`;
}

/**
 * Generate a faculty / employee ID.
 *
 * Format: `{YY}FAC{NNN}` — e.g. `26FAC001`.
 *   - YY = year of joining.
 *   - FAC = faculty / academic staff marker.
 *   - NNN = 3-digit sequence, atomic & per-year.
 */
export async function generateFacultyEmpId(joiningYear?: string | number): Promise<string> {
  const year = yy(joiningYear);
  const seq = await nextSeq(`faculty:${year}`);
  return `${year}FAC${String(seq).padStart(3, "0")}`;
}

/**
 * @deprecated Kept temporarily for back-compat with code paths that haven't
 * been migrated to {@link generateFacultyEmpId} yet. New callers should use
 * the year-based helper above.
 */
export async function generateFacultyId(_departmentCode: string): Promise<string> {
  return generateFacultyEmpId();
}
