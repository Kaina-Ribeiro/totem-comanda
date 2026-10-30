"use server";

import { redirect } from "next/navigation";

import { coreApi } from "@/lib/core/client";
import { saveDeviceCredentials } from "@/lib/device/credentials";
import { authenticateDevice, DeviceAuthError } from "@/lib/device/session";

export type SetupState = { error?: string; deviceId?: string };

const ERRORS: Record<DeviceAuthError["code"], string> = {
  NOT_PROVISIONED: "Informe o ID e o código secreto do aparelho.",
  INVALID_CREDENTIALS: "ID ou código secreto incorretos.",
  DEVICE_DISABLED: "Este aparelho está desativado no back office.",
  CORE_UNAVAILABLE: "Não foi possível falar com o servidor. Tente de novo.",
};

/** Validates the typed credentials against the Core API, stores them and opens the device's area. */
export async function provisionDevice(_: SetupState, form: FormData): Promise<SetupState> {
  const deviceId = String(form.get("deviceId") ?? "").trim();
  const deviceSecret = String(form.get("deviceSecret") ?? "");
  if (!deviceId || !deviceSecret) return { error: ERRORS.NOT_PROVISIONED, deviceId };

  let kind;
  try {
    const { accessToken } = await authenticateDevice({ deviceId, deviceSecret });
    const config = await coreApi().GET("/v1/devices/me/config", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!config.data) throw new DeviceAuthError("CORE_UNAVAILABLE");
    kind = config.data.kind;
  } catch (error) {
    if (error instanceof DeviceAuthError) return { error: ERRORS[error.code], deviceId };
    return { error: ERRORS.CORE_UNAVAILABLE, deviceId };
  }

  await saveDeviceCredentials({ deviceId, deviceSecret });
  redirect(kind === "KITCHEN" ? "/kitchen" : "/kiosk");
}
