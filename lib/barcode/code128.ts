/**
 * Code 128 (code set B) encoder. Pure: text in, bar and space widths out;
 * components/admin/Barcode.tsx draws them.
 *
 * Why Code 128: every handheld scanner reads it — a 2D imager reads 1D codes,
 * but a 1D laser scanner cannot read a QR — so it works whichever scanners the
 * packing team ends up with. Set B covers the characters our codes use
 * (upper-case letters, digits, dash, dot, underscore) and all printable ASCII.
 *
 * Each symbol is six alternating bar/space widths, 11 modules in all; the stop
 * symbol has a seventh (a final bar) and is 13. scripts/test-barcode.ts checks
 * the table's own invariants, and the rendered output is verified against a
 * real decoder.
 */
const PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
] as const;

export const CODE128_PATTERNS: readonly string[] = PATTERNS;

const START_B = 104;
const STOP = 106;

/** True when every character can be carried by code set B. */
export function isEncodable(text: string): boolean {
  return text.length > 0 && [...text].every((ch) => ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) <= 126);
}

/** The symbol values, checksum included, from start to stop. */
export function code128Values(text: string): number[] {
  if (!isEncodable(text)) throw new Error(`Code 128 cannot encode "${text}"`);
  const data = [...text].map((ch) => ch.charCodeAt(0) - 32);
  const checksum = data.reduce((sum, v, i) => sum + v * (i + 1), START_B) % 103;
  return [START_B, ...data, checksum, STOP];
}

/**
 * Alternating widths in modules, starting with a bar. Quiet zones (10
 * modules of white either side, which scanners need) are the renderer's job.
 */
export function code128Widths(text: string): number[] {
  return code128Values(text).flatMap((v) => [...PATTERNS[v]!].map(Number));
}
