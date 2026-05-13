import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendSms, generateOtpCode, sha256Hex, randomPassword } from "./twilio.server";

const phoneSchema = z.string().regex(/^\+[1-9]\d{6,14}$/, "Invalid E.164 phone");

const sendInput = z.object({ phone: phoneSchema });

export const sendPhoneOtp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => sendInput.parse(input))
  .handler(async ({ data }) => {
    const phone = data.phone;

    // Rate limit: don't allow sending more than 1 code per 30s per phone
    const { data: existing } = await supabaseAdmin
      .from("phone_otps")
      .select("created_at")
      .eq("phone_e164", phone)
      .maybeSingle();

    if (existing) {
      const ageMs = Date.now() - new Date(existing.created_at as string).getTime();
      if (ageMs < 30_000) {
        throw new Error("Please wait a moment before requesting another code.");
      }
    }

    const code = generateOtpCode();
    const code_hash = await sha256Hex(`${phone}:${code}`);
    const expires_at = new Date(Date.now() + 10 * 60_000).toISOString();

    const { error } = await supabaseAdmin
      .from("phone_otps")
      .upsert({ phone_e164: phone, code_hash, expires_at, attempts: 0, created_at: new Date().toISOString() });
    if (error) throw new Error(error.message);

    await sendSms(phone, `Your SideQuest verification code is ${code}. It expires in 10 minutes.`);

    return { ok: true as const };
  });

const verifyInput = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{6}$/),
  mode: z.enum(["signup", "login"]),
  displayName: z.string().trim().min(2).max(50).optional(),
});

export const verifyPhoneOtp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => verifyInput.parse(input))
  .handler(async ({ data }) => {
    const { phone, code, mode, displayName } = data;

    const { data: row, error: rowErr } = await supabaseAdmin
      .from("phone_otps")
      .select("code_hash, expires_at, attempts")
      .eq("phone_e164", phone)
      .maybeSingle();
    if (rowErr) throw new Error(rowErr.message);
    if (!row) throw new Error("No code found — request a new one.");

    if (new Date(row.expires_at as string).getTime() < Date.now()) {
      await supabaseAdmin.from("phone_otps").delete().eq("phone_e164", phone);
      throw new Error("Code expired — request a new one.");
    }
    if ((row.attempts ?? 0) >= 5) {
      throw new Error("Too many attempts — request a new code.");
    }

    const expected = await sha256Hex(`${phone}:${code}`);
    if (expected !== row.code_hash) {
      await supabaseAdmin
        .from("phone_otps")
        .update({ attempts: (row.attempts ?? 0) + 1 })
        .eq("phone_e164", phone);
      throw new Error("Incorrect code.");
    }

    // Success: consume the OTP
    await supabaseAdmin.from("phone_otps").delete().eq("phone_e164", phone);

    // Find existing user by phone
    const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (listErr) throw new Error(listErr.message);
    const existingUser = list.users.find((u) => u.phone === phone.replace(/^\+/, "") || u.phone === phone);

    const password = randomPassword();

    if (existingUser) {
      const { error: upErr } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        password,
        phone_confirm: true,
      });
      if (upErr) throw new Error(upErr.message);
    } else {
      if (mode === "login") {
        throw new Error("No account found for this phone — please sign up.");
      }
      const { error: createErr } = await supabaseAdmin.auth.admin.createUser({
        phone,
        password,
        phone_confirm: true,
        user_metadata: displayName ? { display_name: displayName } : undefined,
      });
      if (createErr) throw new Error(createErr.message);
    }

    // Return the one-time password the client uses to sign in immediately.
    return { phone, password };
  });

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const verifyAttachInput = z.object({ phone: phoneSchema, code: z.string().regex(/^\d{6}$/) });

export const verifyAndAttachPhone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => verifyAttachInput.parse(input))
  .handler(async ({ data, context }) => {
    const { phone, code } = data;
    const { userId } = context;

    const { data: row } = await supabaseAdmin
      .from("phone_otps")
      .select("code_hash, expires_at, attempts")
      .eq("phone_e164", phone)
      .maybeSingle();
    if (!row) throw new Error("No code found — request a new one.");
    if (new Date(row.expires_at as string).getTime() < Date.now()) {
      await supabaseAdmin.from("phone_otps").delete().eq("phone_e164", phone);
      throw new Error("Code expired — request a new one.");
    }
    if ((row.attempts ?? 0) >= 5) throw new Error("Too many attempts — request a new code.");

    const expected = await sha256Hex(`${phone}:${code}`);
    if (expected !== row.code_hash) {
      await supabaseAdmin.from("phone_otps").update({ attempts: (row.attempts ?? 0) + 1 }).eq("phone_e164", phone);
      throw new Error("Incorrect code.");
    }

    await supabaseAdmin.from("phone_otps").delete().eq("phone_e164", phone);

    const { error: upErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      phone,
      phone_confirm: true,
    });
    if (upErr) throw new Error(upErr.message);

    return { ok: true as const };
  });
