export const runtime = "edge";
import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { createSession, getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const PROFILE_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  username: true,
  email: true,
  avatar: true,
  password: true,
  authProvider: true,
  authProviderId: true,
  createdAt: true,
  _count: {
    select: {
      stories: true,
      characters: true,
    },
  },
} as const;

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: PROFILE_SELECT,
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const safeUser = { ...user };
    delete (safeUser as { password?: string | null }).password;

    return NextResponse.json({
      user: {
        ...safeUser,
        hasPassword: Boolean(user.password),
      },
    });
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

    if (nextUsername) {
      const usernameConflict = await prisma.user.findFirst({
        where: {
          username: nextUsername,
          NOT: { id: session.id },
        },
        select: { id: true },
      });

      if (usernameConflict) {
        return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
      }
    }

    if (nextEmail) {
      const emailConflict = await prisma.user.findFirst({
        where: {
          email: nextEmail,
          NOT: { id: session.id },
        },
        select: { id: true },
      });

      if (emailConflict) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
      }
    }

    const passwordHash = nextPassword ? await bcrypt.hash(nextPassword, 12) : undefined;

    const updated = await prisma.user.update({
      where: { id: session.id },
      data: {
        firstName: nextFirstName || undefined,
        lastName: nextLastName || undefined,
        username: nextUsername || undefined,
        email: nextEmail || undefined,
        password: passwordHash,
      },
      select: PROFILE_SELECT,
    });

    await createSession({
      id: updated.id,
      firstName: updated.firstName,
      lastName: updated.lastName,
      username: updated.username,
      avatar: updated.avatar,
    });

    const safeUpdatedUser = { ...updated };
    delete (safeUpdatedUser as { password?: string | null }).password;

    return NextResponse.json({
      user: {
        ...safeUpdatedUser,
        hasPassword: Boolean(updated.password),
      },
    });
  } catch (error: unknown) {
    console.error('Profile PUT error:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
