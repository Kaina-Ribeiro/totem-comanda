import "server-only";

import { coreMediaApi } from "@/lib/core/client";
import { coreMediaApiV2 } from "@/lib/core/client-v2";

import { AdminApiError, asOwner } from "./session";

/** Largest upload the back office sends on (the Go API may set its own limit). */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * Uploads an image from a form field (uploadMedia) and returns its URL, or
 * null when the field is empty. Throws AdminApiError for a bad file.
 */
export async function uploadImage(form: FormData, field: string): Promise<string | null> {
  const file = form.get(field);
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > MAX_UPLOAD_BYTES || !file.type.startsWith("image/")) {
    throw new AdminApiError("VALIDATION_FAILED", "imagem até 5 MB");
  }
  const body = new FormData();
  body.set("file", file, file.name);
  const asset = await asOwner((headers) =>
    coreMediaApi().POST("/v1/admin/media", {
      headers,
      // The generated type says `file: string` (binary); the multipart body is built here.
      body: {} as never,
      bodySerializer: () => body,
    }),
  );
  return asset.url;
}

/**
 * Uploads an image from a form field (v2 uploadMedia) and returns the id of
 * the `IMAGE` entity it became, or null when the field is empty.
 */
export async function uploadImageV2(form: FormData, field: string): Promise<string | null> {
  const file = form.get(field);
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > MAX_UPLOAD_BYTES || !file.type.startsWith("image/")) {
    throw new AdminApiError("VALIDATION_FAILED", "imagem até 5 MB");
  }
  const body = new FormData();
  body.set("file", file, file.name);
  const asset = await asOwner((headers) =>
    coreMediaApiV2().POST("/v2/admin/media", {
      headers,
      // The generated type says `file: string` (binary); the multipart body is built here.
      body: {} as never,
      bodySerializer: () => body,
    }),
  );
  return asset.id;
}
