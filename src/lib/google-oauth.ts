import { prisma } from '@/lib/prisma';
import { createSession, type SessionUser } from '@/lib/auth';

export const GOOGLE_STATE_COOKIE = 'google_oauth_state';
export const GOOGLE_AUTH_PATH = '/api/auth/google/callback';

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';

type GoogleProfile = {
  sub: string;
  email?: string;
  email_verified?: boolean;
  given_name?: string;
  family_name?: string;
  name?: string;
  picture?: string;
};

const getSiteUrl = () => {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  return baseUrl.replace(/\/$/, '');
};

const splitDisplayName = (name?: string) => {
  const trimmed = name?.trim();
  if (!trimmed) {
    return { firstName: 'Google', lastName: 'User' };
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  const firstName = parts[0] || 'Google';
  const lastName = parts.slice(1).join(' ') || 'User';

  return { firstName, lastName };
};

const normalizeNameParts = (profile: GoogleProfile) => {
  const displayName = splitDisplayName(profile.name);
  const firstName = profile.given_name?.trim() || displayName.firstName;
  const lastName = profile.family_name?.trim() || displayName.lastName;

  return { firstName, lastName };
};

const sanitizeUsername = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

const buildBaseUsername = (profile: GoogleProfile) => {
  const emailPrefix = profile.email?.split('@')[0];
  const fallbackPrefix = profile.given_name || profile.name || `google_${profile.sub.slice(0, 8)}`;
  return sanitizeUsername(emailPrefix || fallbackPrefix || `google_${profile.sub.slice(0, 8)}`) || `google_${profile.sub.slice(0, 8)}`;
};

const generateUniqueUsername = async (profile: GoogleProfile) => {
  const baseUsername = buildBaseUsername(profile);
  let candidate = baseUsername;
  let counter = 0;

  while (await prisma.user.findUnique({ where: { username: candidate } })) {
    counter += 1;
    candidate = `${baseUsername}_${counter}`;
  }

  return candidate;
};

const buildAvatar = (profile: GoogleProfile) =>
  profile.picture || `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(profile.email || profile.sub)}`;

export const buildGoogleAuthUrl = (state: string) => {
  const url = new URL(GOOGLE_AUTH_ENDPOINT);
  url.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID || '');
  url.searchParams.set('redirect_uri', `${getSiteUrl()}${GOOGLE_AUTH_PATH}`);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  url.searchParams.set('prompt', 'select_account');
  return url.toString();
};

export const exchangeCodeForTokens = async (code: string) => {
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirect_uri: `${getSiteUrl()}${GOOGLE_AUTH_PATH}`,
      grant_type: 'authorization_code',
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error_description || data?.error || 'Failed to exchange Google code');
  }

  return data as { access_token: string };
};

export const fetchGoogleProfile = async (accessToken: string) => {
  const response = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const profile = await response.json();
  if (!response.ok) {
    throw new Error(profile?.error?.message || 'Failed to load Google profile');
  }

  return profile as GoogleProfile;
};

export const upsertGoogleUser = async (profile: GoogleProfile): Promise<SessionUser> => {
  const email = profile.email?.toLowerCase().trim() || null;
  const { firstName, lastName } = normalizeNameParts(profile);
  const avatar = buildAvatar(profile);

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { authProvider: 'google', authProviderId: profile.sub },
        ...(email ? [{ email }] : []),
      ],
    },
  });

  const user = existingUser
    ? await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          firstName,
          lastName,
          email: email || existingUser.email,
          avatar: existingUser.avatar || avatar,
          authProvider: 'google',
          authProviderId: profile.sub,
        },
      })
    : await prisma.user.create({
        data: {
          firstName,
          lastName,
          username: await generateUniqueUsername(profile),
          password: null,
          email,
          avatar,
          authProvider: 'google',
          authProviderId: profile.sub,
        },
      });

  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    avatar: user.avatar,
  };
};

export const createGoogleSession = async (profile: GoogleProfile) => {
  const sessionUser = await upsertGoogleUser(profile);
  await createSession(sessionUser);
  return sessionUser;
};
