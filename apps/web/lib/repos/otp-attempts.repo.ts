import { prisma } from "@workspace/db";
import type { OtpAttempt } from "@workspace/db";

/** Record a single OTP attempt (success or failure). */
export async function recordAttempt(
  phone: string,
  ip: string,
  success: boolean,
): Promise<OtpAttempt> {
  return prisma.otpAttempt.create({
    data: { phone, ip, success },
  });
}

/** Count OTP attempts for a phone within the last `sinceMinutes` minutes. */
export async function countAttemptsForPhone(
  phone: string,
  sinceMinutes: number,
): Promise<number> {
  const cutoff = new Date(Date.now() - sinceMinutes * 60_000);
  return prisma.otpAttempt.count({
    where: {
      phone,
      createdAt: { gte: cutoff },
    },
  });
}

/** Count OTP attempts for an IP within the last `sinceMinutes` minutes. */
export async function countAttemptsForIp(
  ip: string,
  sinceMinutes: number,
): Promise<number> {
  const cutoff = new Date(Date.now() - sinceMinutes * 60_000);
  return prisma.otpAttempt.count({
    where: {
      ip,
      createdAt: { gte: cutoff },
    },
  });
}
