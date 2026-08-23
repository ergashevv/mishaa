export const runtime = "nodejs";
import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { createSession, getSession } from '@/lib/auth';
import {
  emailTakenByOther,
  findUserById,
  updateUser,
  usernameTakenByOther,
  type UserRow,
} from '@/lib/db/user-repo';
import { countProgress } from '@/lib/db/reading-progress-repo';

/** The hash never leaves the server; the client only needs to know whether one exists. */
function toPublicUser(user: UserRow, counts: { reading: number; completed: number }) {
  const safeUser = { ...user };
  delete (safeUser as { password?: string | null }).password;

  return {
    ...safeUser,
    hasPassword: Boolean(user.password),
    _count: {
      reading: counts.reading,
      completed: counts.completed,
    },
  };
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [user, counts] = await Promise.all([
      findUserById(session.id),
      countProgress(session.id),
    ]);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user: toPublicUser(user, counts) });
  } catch (error: unknown) {
    console.error('Profile GET error:', error);
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const nextFirstName = typeof body.firstName === 'string' ? body.firstName.trim() : undefined;
    const nextLastName = typeof body.lastName === 'string' ? body.lastName.trim() : undefined;
    const nextUsername = typeof body.username === 'string' ? body.username.trim().toLowerCase() : undefined;
    const nextEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : undefined;
    const nextPassword = typeof body.password === 'string' ? body.password : undefined;

    if (nextUsername && nextUsername.length < 3) {
      return NextResponse.json({ error: 'Username must be at least 3 characters' }, { status: 400 });
    }

    if (nextPassword && nextPassword.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    if (nextUsername && (await usernameTakenByOther(nextUsername, session.id))) {
      return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
    }

    if (nextEmail && (await emailTakenByOther(nextEmail, session.id))) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
    }

    const passwordHash = nextPassword ? await bcrypt.hash(nextPassword, 12) : undefined;

    // `undefined` leaves a column untouched, so an empty field in the form is a no-op
    // rather than a blanked-out name.
    const [updated, counts] = await Promise.all([
      updateUser(session.id, {
        firstName: nextFirstName || undefined,
        lastName: nextLastName || undefined,
        username: nextUsername || undefined,
        email: nextEmail || undefined,
        password: passwordHash,
      }),
      countProgress(session.id),
    ]);

    if (!updated) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await createSession({
      id: updated.id,
      firstName: updated.firstName,
      lastName: updated.lastName,
      username: updated.username,
      avatar: updated.avatar,
    });

    return NextResponse.json({ user: toPublicUser(updated, counts) });
  } catch (error: unknown) {
    console.error('Profile PUT error:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
