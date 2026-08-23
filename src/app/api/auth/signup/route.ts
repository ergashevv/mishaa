export const runtime = "nodejs";
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createUser, usernameExists } from '@/lib/db/user-repo';
import { createSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { firstName, lastName, username, password, avatar } = await req.json();

    if (!firstName || !lastName || !username || !password) {
      return NextResponse.json({ error: 'All fields required' }, { status: 400 });
    }

    if (username.length < 3) {
      return NextResponse.json({ error: 'Username must be at least 3 characters' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    if (await usernameExists(username)) {
      return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await createUser({
      firstName,
      lastName,
      username,
      password: hashed,
      email: null,
      avatar: avatar || `https://api.dicebear.com/9.x/identicon/svg?seed=${username}`,
      authProvider: 'local',
      authProviderId: null,
    });

    await createSession({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      avatar: user.avatar,
    });

    return NextResponse.json({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      avatar: user.avatar,
    });
  } catch (err: unknown) {
    console.error('Signup error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
