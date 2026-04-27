import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'icomics-studio-secure-key-2026'
);

export interface SessionUser {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  avatar?: string | null;
}

const isSessionUser = (value: unknown): value is SessionUser => {
  if (typeof value !== 'object' || value === null) return false;

  const user = value as Record<string, unknown>;

  return (
    typeof user.id === 'string' &&
    typeof user.firstName === 'string' &&
    typeof user.lastName === 'string' &&
    typeof user.username === 'string' &&
    (typeof user.avatar === 'string' || user.avatar === null || user.avatar === undefined)
  );
};

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({ user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(SECRET);

  const cookieStore = await cookies();
  cookieStore.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  });

  return token;
}

export async function getSession(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, SECRET);
    return isSessionUser(payload.user) ? payload.user : null;
  } catch {
    return null;
  }
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete('session');
}
