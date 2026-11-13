import { ABIGAIL_MEDIA } from "./v2/seed-abigail.ts";

// Multipart upload parsing and image size sniffing for POST /v2/admin/media.

export type UploadedFile = { filename: string; type: string; bytes: Buffer };

/** The first file part of a multipart/form-data body, or null. */
export function firstFile(raw: Buffer, contentType: string | undefined): UploadedFile | null {
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/.exec(contentType ?? "");
  if (!boundary) return null;
  const marker = Buffer.from(`--${boundary[1] ?? boundary[2]}`);
  let start = raw.indexOf(marker);
  while (start !== -1) {
    const next = raw.indexOf(marker, start + marker.length);
    if (next === -1) break;
    const part = raw.subarray(start + marker.length + 2, next - 2); // skip CRLFs
    const split = part.indexOf("\r\n\r\n");
    if (split !== -1) {
      const head = part.subarray(0, split).toString("utf8");
      const filename = /filename="([^"]*)"/i.exec(head)?.[1];
      if (filename) {
        const type =
          /content-type:\s*([^\r\n]+)/i.exec(head)?.[1]?.trim() ?? "application/octet-stream";
        return { filename, type, bytes: part.subarray(split + 4) };
      }
    }
    start = next;
  }
  return null;
}

/** Width and height of a PNG or JPEG; 0 × 0 for anything else. */
export function imageSize(bytes: Buffer): { width: number; height: number } {
  if (bytes.length > 24 && bytes.readUInt32BE(0) === 0x89504e47) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) break;
      const marker = bytes[i + 1];
      const length = bytes.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xc3) {
        return { width: bytes.readUInt16BE(i + 7), height: bytes.readUInt16BE(i + 5) };
      }
      i += 2 + length;
    }
  }
  return { width: 0, height: 0 };
}

const PROTOTYPE = new URL("../../../docs/prototype/assets/", import.meta.url);
const ABIGAIL = new URL("./media/abigail/", import.meta.url);

/**
 * Media files the mock serves under /media: the prototype's photos
 * (docs/prototype/assets) and Abigail Coffee's (mock/media/abigail). The Core
 * API will serve uploads the same way.
 */
export const SEED_MEDIA: Record<string, URL> = {
  ...Object.fromEntries(
    Object.entries({
      "fermentacao-natural.jpg": "sourdough.jpg",
      "baguete.jpg": "baguette.jpg",
      "brioche.jpg": "brioche.jpg",
      "centeio.jpg": "rye.jpg",
      "pao-de-forma.jpg": "forma.jpg",
      "croissant.jpg": "croissant.jpg",
      "pain-au-chocolat.jpg": "choco.jpg",
      "cookie.jpg": "cookie.jpg",
      "cupcake.jpg": "cupcake.jpg",
      "donut.jpg": "donut.jpg",
      "croque-monsieur.jpg": "sandwich.jpg",
      "misto-quente.jpg": "bread.jpg",
      "cappuccino.jpg": "cappuccino.jpg",
      "latte.jpg": "latte.jpg",
    }).map(([name, file]) => [name, new URL(file, PROTOTYPE)]),
  ),
  ...Object.fromEntries(ABIGAIL_MEDIA.map((name) => [name, new URL(name, ABIGAIL)])),
};

/** Content type of a seed media file, by extension. */
export function mediaType(name: string): string {
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".png")) return "image/png";
  return "image/jpeg";
}
