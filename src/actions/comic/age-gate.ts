import { cookies } from 'next/headers';
import { AGE_VERIFICATION_COOKIE } from '@/lib/age-verification';

export async function hasAgeVerification() {
  try {
    return (await cookies()).get(AGE_VERIFICATION_COOKIE)?.value === 'true';
  } catch {
    return false;
  }
}
