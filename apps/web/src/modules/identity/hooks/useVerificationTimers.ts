import { useCallback, useEffect, useMemo, useState } from "react";

const RESEND_STORAGE_KEY = "auth.resendCooldown";
const OTP_STORAGE_KEY = "auth.otpExpiry";

type StoredDeadline = {
  email: string;
  expiresAt: number;
};

type VerificationTimersOptions = {
  active: boolean;
  email: string;
};

const storage = (): Storage | null =>
  typeof window === "undefined" ? null : window.localStorage;

const parseStoredDeadline = (
  key: string,
  email: string,
): number | null => {
  const target = storage();
  if (!target || !email) return null;

  const raw = target.getItem(key);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredDeadline>;
    if (
      parsed.email !== email ||
      typeof parsed.expiresAt !== "number" ||
      !Number.isFinite(parsed.expiresAt)
    ) {
      return null;
    }
    return parsed.expiresAt;
  } catch {
    target.removeItem(key);
    return null;
  }
};

const writeDeadline = (
  key: string,
  email: string,
  expiresAt: number | null,
): void => {
  const target = storage();
  if (!target) return;

  if (!email || expiresAt === null) {
    target.removeItem(key);
    return;
  }

  target.setItem(key, JSON.stringify({ email, expiresAt } satisfies StoredDeadline));
};

export const remainingSecondsUntil = (
  deadline: number | null,
  now = Date.now(),
): number => {
  if (deadline === null) return 0;
  return Math.max(0, Math.ceil((deadline - now) / 1000));
};

export function useVerificationTimers({
  active,
  email,
}: VerificationTimersOptions) {
  const [resendDeadline, setResendDeadline] = useState<number | null>(null);
  const [otpDeadline, setOtpDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active || !email) return;

    setResendDeadline(parseStoredDeadline(RESEND_STORAGE_KEY, email));
    setOtpDeadline(parseStoredDeadline(OTP_STORAGE_KEY, email));
    setNow(Date.now());
  }, [active, email]);

  const resendCooldown = useMemo(
    () => remainingSecondsUntil(resendDeadline, now),
    [resendDeadline, now],
  );
  const otpExpiresIn = useMemo(
    () => remainingSecondsUntil(otpDeadline, now),
    [otpDeadline, now],
  );

  useEffect(() => {
    if (!active || (resendCooldown === 0 && otpExpiresIn === 0)) return;

    const timeout = window.setTimeout(() => setNow(Date.now()), 1000);
    return () => window.clearTimeout(timeout);
  }, [active, resendCooldown, otpExpiresIn]);

  const startResendCooldown = useCallback(
    (seconds: number) => {
      const safeSeconds = Math.max(0, Math.floor(seconds || 0));
      const deadline = safeSeconds > 0 ? Date.now() + safeSeconds * 1000 : null;
      setResendDeadline(deadline);
      setNow(Date.now());
      writeDeadline(RESEND_STORAGE_KEY, email, deadline);
    },
    [email],
  );

  const startOtpExpiry = useCallback(
    (seconds: number) => {
      const safeSeconds = Math.max(0, Math.floor(seconds || 0));
      const deadline = safeSeconds > 0 ? Date.now() + safeSeconds * 1000 : Date.now();
      setOtpDeadline(deadline);
      setNow(Date.now());
      writeDeadline(OTP_STORAGE_KEY, email, deadline);
    },
    [email],
  );

  const expireOtp = useCallback(() => {
    const deadline = Date.now();
    setOtpDeadline(deadline);
    setNow(deadline);
    writeDeadline(OTP_STORAGE_KEY, email, deadline);
  }, [email]);

  const resetVerificationTimers = useCallback(() => {
    setResendDeadline(null);
    setOtpDeadline(null);
    setNow(Date.now());
    writeDeadline(RESEND_STORAGE_KEY, "", null);
    writeDeadline(OTP_STORAGE_KEY, "", null);
  }, []);

  return {
    resendCooldown,
    otpExpiresIn,
    startResendCooldown,
    startOtpExpiry,
    expireOtp,
    resetVerificationTimers,
  };
}
