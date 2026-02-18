import crypto from "crypto";

export function getEmailDomain(email: string) {
  const e = (email || "").trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at === -1) return "";
  return e.slice(at + 1);
}

export function isAllowedDomain(email: string) {
  const domain = getEmailDomain(email);
  if (!domain) return false;

  const raw = process.env.ALLOWED_EMAIL_DOMAINS || "";
  const list = raw
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

  if (list.length === 0) return true;
  return list.includes(domain);
}

// ✅ MUST match how HR_INVITE_HASH is generated: sha256(salt + ":" + code)
export function hashInvite(code: string) {
  const salt = process.env.INVITE_CODE_SALT;
  if (!salt) throw new Error("INVITE_CODE_SALT is missing.");

  return crypto
    .createHash("sha256")
    .update(salt + ":" + String(code || "").trim())
    .digest("hex");
}
