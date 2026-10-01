/**
 * The image type a file's own bytes declare, from its magic number. A
 * browser-supplied `File.type` is only the client's claim; uploads compare
 * the two and refuse a mismatch.
 */
export async function sniffImageType(
  file: Blob,
): Promise<"image/jpeg" | "image/png" | "image/webp" | null> {
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    head[0] === 0x89 &&
    head[1] === 0x50 &&
    head[2] === 0x4e &&
    head[3] === 0x47 &&
    head[4] === 0x0d &&
    head[5] === 0x0a &&
    head[6] === 0x1a &&
    head[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    String.fromCharCode(...head.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...head.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}
