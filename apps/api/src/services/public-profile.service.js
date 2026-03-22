const analyticsService = require('./analytics.service');
const readinessService = require('./readiness.service');
const problemRepository = require('../repositories/problem.repository');
const publicProfileRepository = require('../repositories/public-profile.repository');
const { supabase } = require('../db/supabase');

function slugify(input) {
    return (input || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40);
}

function buildDefaultSlug(userId, user) {
    const base = slugify(
        user?.user_metadata?.user_name
        || user?.user_metadata?.full_name
        || user?.email?.split('@')[0]
        || `coder-${userId.slice(0, 8)}`,
    );
    const suffix = userId.slice(0, 6).toLowerCase();
    return base ? `${base}-${suffix}`.slice(0, 40) : `coder-${suffix}`;
}

async function buildProfileSnapshot(client, userId) {
    const [overview, topics, platforms, achievements, readiness, problemsResult] = await Promise.all([
        analyticsService.getOverview(client, userId),
        analyticsService.getTopics(client, userId),
        analyticsService.getPlatforms(client, userId),
        analyticsService.getAchievements(client, userId),
        readinessService.getInterviewReadiness(client, userId),
        problemRepository.fetchAllProblems(client, userId),
    ]);

    if (problemsResult.error) {
        throw problemsResult.error;
    }

    return {
        total_solved: overview.total_solved || 0,
        current_streak: overview.current_streak || 0,
        interview_readiness: readiness.score,
        platform_breakdown: platforms.slice(0, 6),
        top_topics: topics.slice(0, 6).map((topic) => ({
            topic: topic.topic,
            solved: topic.solved,
            mastery_score: topic.mastery_score,
        })),
        recent_solves: (problemsResult.data || []).slice(0, 8).map((problem) => ({
            problem_name: problem.problem_name,
            topic: problem.topic,
            difficulty: problem.difficulty,
            platform: problem.platform,
            solved_at: problem.solved_at,
            problem_url: problem.problem_url,
        })),
        achievements: achievements.filter((achievement) => achievement.unlocked),
    };
}

async function refreshPublicProfileSnapshot(client, userId, user = null) {
    const existing = await publicProfileRepository.getProfileByUserId(client, userId);
    if (existing.error) {
        throw existing.error;
    }

    const snapshot = await buildProfileSnapshot(client, userId);
    const payload = {
        user_id: userId,
        slug: existing.data?.slug || buildDefaultSlug(userId, user),
        display_name: existing.data?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'DSAFlow User',
        avatar_url: existing.data?.avatar_url || user?.user_metadata?.avatar_url || null,
        headline: existing.data?.headline || 'Building interview strength one problem at a time.',
        bio: existing.data?.bio || '',
        is_public: existing.data?.is_public || false,
        share_badge: existing.data?.share_badge ?? true,
        updated_at: new Date().toISOString(),
        ...snapshot,
    };

    const { data, error } = await publicProfileRepository.upsertProfile(client, payload);
    if (error) {
        throw error;
    }

    return data;
}

async function getMyProfile(client, userId, user) {
    const existing = await publicProfileRepository.getProfileByUserId(client, userId);
    if (existing.error) {
        throw existing.error;
    }

    if (existing.data) {
        return refreshPublicProfileSnapshot(client, userId, user);
    }

    const snapshot = await buildProfileSnapshot(client, userId);
    return {
        user_id: userId,
        slug: buildDefaultSlug(userId, user),
        display_name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'DSAFlow User',
        avatar_url: user?.user_metadata?.avatar_url || '',
        headline: 'Building interview strength one problem at a time.',
        bio: '',
        is_public: false,
        share_badge: true,
        ...snapshot,
    };
}

async function updateMyProfile(client, userId, user, payload) {
    const existing = await publicProfileRepository.getProfileByUserId(client, userId);
    if (existing.error) {
        throw existing.error;
    }

    const snapshot = await buildProfileSnapshot(client, userId);
    const { data, error } = await publicProfileRepository.upsertProfile(client, {
        user_id: userId,
        slug: payload.slug || existing.data?.slug || buildDefaultSlug(userId, user),
        display_name: payload.display_name || existing.data?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'DSAFlow User',
        avatar_url: payload.avatar_url === '' ? null : (payload.avatar_url || existing.data?.avatar_url || user?.user_metadata?.avatar_url || null),
        headline: payload.headline === '' ? null : (payload.headline || existing.data?.headline || null),
        bio: payload.bio === '' ? null : (payload.bio || existing.data?.bio || null),
        is_public: payload.is_public ?? existing.data?.is_public ?? false,
        share_badge: payload.share_badge ?? existing.data?.share_badge ?? true,
        updated_at: new Date().toISOString(),
        ...snapshot,
    });

    if (error) {
        if (error.code === '23505') {
            const duplicate = new Error('That public slug is already taken.');
            duplicate.status = 409;
            throw duplicate;
        }
        throw error;
    }

    return data;
}

async function getPublicProfile(slug) {
    const result = await publicProfileRepository.getPublicProfileBySlug(supabase, slug);
    if (result.error) {
        throw result.error;
    }
    if (!result.data) {
        const error = new Error('Public profile not found.');
        error.status = 404;
        throw error;
    }
    return result.data;
}

function escapeXml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function renderBadgeSvg(profile) {
    const name = escapeXml(profile.display_name || profile.slug || 'DSAFlow');
    const right = escapeXml(`${profile.total_solved || 0} solves | ${profile.current_streak || 0} streak | IR ${profile.interview_readiness || 0}`);
    const leftWidth = Math.max(110, 10 * name.length + 18);
    const rightWidth = Math.max(190, 7 * right.length + 20);
    const totalWidth = leftWidth + rightWidth;

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="36" role="img" aria-label="${name}: ${right}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b1220" />
      <stop offset="100%" stop-color="#172554" />
    </linearGradient>
  </defs>
  <rect width="${totalWidth}" height="36" rx="10" fill="#111827" />
  <rect width="${leftWidth}" height="36" rx="10" fill="#0f172a" />
  <rect x="${leftWidth}" width="${rightWidth}" height="36" rx="10" fill="url(#bg)" />
  <text x="14" y="23" fill="#e5e7eb" font-family="Verdana,Arial,sans-serif" font-size="13" font-weight="700">${name}</text>
  <text x="${leftWidth + 14}" y="23" fill="#f8fafc" font-family="Verdana,Arial,sans-serif" font-size="12" font-weight="700">${right}</text>
</svg>`;
}

module.exports = {
    buildDefaultSlug,
    refreshPublicProfileSnapshot,
    getMyProfile,
    updateMyProfile,
    getPublicProfile,
    renderBadgeSvg,
};
