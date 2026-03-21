const problemRepository = require('../repositories/problem.repository');
const statsRepository = require('../repositories/stats.repository');
const { computeStreakInfo } = require('./streak.service');
const { cache } = require('./cache.service');

function toDay(dateString) {
    return new Date(dateString).toISOString().slice(0, 10);
}

function buildInsights(problems) {
    if (!problems.length) {
        return {
            weak_topics: [],
            strongest_topic: null,
            recommended_focus: 'Log your first problem to unlock personalized recommendations.',
            next_problem_suggestion: 'Start with an Easy or Medium Arrays problem to establish momentum.',
            difficulty_progression: 'No difficulty pattern yet.',
            patterns: [],
        };
    }

    const topicStats = {};
    const platformStats = {};
    const recentProblems = [...problems]
        .sort((a, b) => new Date(b.solved_at).getTime() - new Date(a.solved_at).getTime())
        .slice(0, 10);

    for (const problem of problems) {
        topicStats[problem.topic] = (topicStats[problem.topic] || 0) + 1;
        platformStats[problem.platform || 'Other'] = (platformStats[problem.platform || 'Other'] || 0) + 1;
    }

    const sortedTopics = Object.entries(topicStats).sort((a, b) => b[1] - a[1]);
    const strongestTopic = sortedTopics[0]?.[0] || null;
    const weakTopics = sortedTopics.slice(-3).map(([topic, count]) => ({ topic, count }));
    const mediumPlusCount = problems.filter((problem) => ['Medium', 'Hard'].includes(problem.difficulty)).length;
    const hardCount = problems.filter((problem) => problem.difficulty === 'Hard').length;
    const difficultyProgression = hardCount > 0
        ? 'You are already taking on Hard problems. Keep balancing them with Medium revisions.'
        : mediumPlusCount > 0
            ? 'You are building into Medium difficulty well. Introduce one Hard problem each week next.'
            : 'You are still early in the curve. Build consistency with Easy and Medium coverage first.';

    const recommendedFocus = weakTopics.length
        ? `Weakest coverage is in ${weakTopics.map((entry) => entry.topic).join(', ')}. Schedule revision or two fresh solves there next.`
        : 'Keep widening topic coverage to avoid overfitting on one pattern.';

    const patterns = [];
    const recentNames = recentProblems.map((problem) => problem.problem_name.toLowerCase());
    if (recentNames.some((name) => name.includes('sum'))) {
        patterns.push('Prefix sum / two-sum style pattern activity detected.');
    }
    if (recentNames.some((name) => name.includes('tree') || name.includes('bst'))) {
        patterns.push('Tree pattern momentum is increasing.');
    }
    if (recentNames.some((name) => name.includes('graph') || name.includes('dfs') || name.includes('bfs'))) {
        patterns.push('Graph traversal patterns are active recently.');
    }

    const topPlatform = Object.entries(platformStats).sort((a, b) => b[1] - a[1])[0]?.[0] || 'LeetCode';

    return {
        weak_topics: weakTopics,
        strongest_topic: strongestTopic,
        recommended_focus: recommendedFocus,
        next_problem_suggestion: `Try one ${hardCount > 2 ? 'Hard' : 'Medium'} ${weakTopics[0]?.topic || strongestTopic || 'Arrays'} problem on ${topPlatform}.`,
        difficulty_progression: difficultyProgression,
        patterns,
    };
}

async function getStats(client, userId) {
    const cacheKey = `stats:${userId}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
        return cached;
    }

    const { data, error } = await statsRepository.getDifficultyStats(client, userId);
    if (error && error.code !== 'PGRST116') {
        throw error;
    }

    const stats = {
        solved: data?.total_solved || 0,
        easy: data?.easy_count || 0,
        medium: data?.medium_count || 0,
        hard: data?.hard_count || 0,
    };

    await cache.set(cacheKey, stats, cache.DEFAULTS.stats);
    return stats;
}

async function getUserStats(client, userId) {
    const { data, error } = await statsRepository.getUserStats(client, userId);
    if (error && error.code !== 'PGRST116') {
        throw error;
    }

    return data || {
        current_streak: 0,
        longest_streak: 0,
        last_solve_date: null,
    };
}

async function getVelocity(client, userId) {
    const cacheKey = `velocity:${userId}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
        return cached;
    }

    const { data, error } = await statsRepository.getVelocityStats(client, userId);
    if (error && error.code !== 'PGRST116') {
        throw error;
    }

    const velocity = data || { solves_last_7_days: 0, daily_velocity: 0 };
    await cache.set(cacheKey, velocity, cache.DEFAULTS.velocity);
    return velocity;
}

async function getActivity(client, userId, days) {
    const cacheKey = `activity:${userId}:${days}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
        return cached;
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (days - 1));
    const startDay = toDay(startDate.toISOString());
    const { data, error } = await client
        .from('user_daily_activity')
        .select('solved_day, solve_count')
        .eq('user_id', userId)
        .gte('solved_day', startDay)
        .order('solved_day', { ascending: true });

    let counts = new Map();
    if (error) {
        const fallback = await problemRepository.fetchAllProblems(client, userId);
        if (fallback.error) {
            throw fallback.error;
        }

        for (const problem of fallback.data || []) {
            const day = toDay(problem.solved_at);
            if (day >= startDay) {
                counts.set(day, (counts.get(day) || 0) + 1);
            }
        }
    } else {
        counts = new Map((data || []).map((entry) => [entry.solved_day, entry.solve_count]));
    }

    const activity = [];
    for (let index = 0; index < days; index += 1) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + index);
        const day = toDay(date.toISOString());
        activity.push({
            date: day,
            count: counts.get(day) || 0,
        });
    }

    await cache.set(cacheKey, activity, 30);
    return activity;
}

async function getPlatforms(client, userId) {
    const cacheKey = `platform-stats:${userId}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
        return cached;
    }

    const { data, error } = await statsRepository.getPlatformStats(client, userId);
    if (error) {
        const fallback = await problemRepository.fetchAllProblems(client, userId);
        if (fallback.error) {
            throw fallback.error;
        }

        const platformMap = {};
        for (const problem of fallback.data || []) {
            const key = problem.platform || 'Other';
            platformMap[key] = (platformMap[key] || 0) + 1;
        }

        const platforms = Object.entries(platformMap)
            .map(([platform, count]) => ({ platform, count }))
            .sort((a, b) => b.count - a.count);

        await cache.set(cacheKey, platforms, 60);
        return platforms;
    }

    const platforms = (data || []).map((entry) => ({
        platform: entry.platform || 'Other',
        count: entry.solve_count || 0,
    }));

    await cache.set(cacheKey, platforms, 60);
    return platforms;
}

async function getTopics(client, userId) {
    const cacheKey = `topic-stats:${userId}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
        return cached;
    }

    const { data, error } = await statsRepository.getTopicStats(client, userId);
    if (error) {
        const fallback = await problemRepository.fetchAllProblems(client, userId);
        if (fallback.error) {
            throw fallback.error;
        }

        const topicMap = {};
        for (const problem of fallback.data || []) {
            if (!topicMap[problem.topic]) {
                topicMap[problem.topic] = {
                    topic: problem.topic,
                    solved: 0,
                    easy: 0,
                    medium: 0,
                    hard: 0,
                    last_solved_at: problem.solved_at,
                    mastery_score: 0,
                };
            }

            topicMap[problem.topic].solved += 1;
            topicMap[problem.topic].last_solved_at = problem.solved_at;
            if (problem.difficulty === 'Easy') topicMap[problem.topic].easy += 1;
            if (problem.difficulty === 'Medium') topicMap[problem.topic].medium += 1;
            if (problem.difficulty === 'Hard') topicMap[problem.topic].hard += 1;
        }

        const topics = Object.values(topicMap)
            .sort((a, b) => b.solved - a.solved)
            .map((entry) => ({
                ...entry,
                mastery_score: Math.min(100, entry.easy * 10 + entry.medium * 14 + entry.hard * 18),
            }));

        await cache.set(cacheKey, topics, 60);
        return topics;
    }

    const topics = (data || []).map((entry) => ({
        topic: entry.topic,
        solved: entry.solved,
        easy: entry.easy,
        medium: entry.medium,
        hard: entry.hard,
        last_solved_at: entry.last_solved_at,
        mastery_score: entry.mastery_score,
    }));

    await cache.set(cacheKey, topics, 60);
    return topics;
}

async function getOverview(client, userId) {
    const cacheKey = `overview:${userId}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
        return cached;
    }

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const last7Threshold = new Date(now);
    last7Threshold.setDate(now.getDate() - 6);
    const monthThreshold = new Date(now);
    monthThreshold.setDate(now.getDate() - 29);

    const [
        difficultyStats,
        userStats,
        platforms,
        topics,
        solvedTodayResult,
        weeklyCountResult,
        monthlyCountResult,
        revisionDueResult,
    ] = await Promise.all([
        getStats(client, userId),
        getUserStats(client, userId),
        getPlatforms(client, userId),
        getTopics(client, userId),
        problemRepository.countProblems(client, userId, { gteSolvedAt: todayStart.toISOString() }),
        problemRepository.countProblems(client, userId, { gteSolvedAt: last7Threshold.toISOString() }),
        problemRepository.countProblems(client, userId, { gteSolvedAt: monthThreshold.toISOString() }),
        problemRepository.countProblems(client, userId, { lteNextRevisionAt: now.toISOString() }),
    ]);

    if (solvedTodayResult.error) throw solvedTodayResult.error;
    if (weeklyCountResult.error) throw weeklyCountResult.error;
    if (monthlyCountResult.error) throw monthlyCountResult.error;
    if (revisionDueResult.error) throw revisionDueResult.error;

    const overview = {
        total_solved: difficultyStats.solved,
        solved_today: solvedTodayResult.count || 0,
        weekly_progress: weeklyCountResult.count || 0,
        monthly_progress: monthlyCountResult.count || 0,
        easy: difficultyStats.easy,
        medium: difficultyStats.medium,
        hard: difficultyStats.hard,
        revision_due: revisionDueResult.count || 0,
        platform_breakdown: platforms,
        topic_breakdown: topics.slice(0, 8).map((entry) => ({ topic: entry.topic, count: entry.solved })),
        current_streak: userStats.current_streak || 0,
        longest_streak: userStats.longest_streak || 0,
    };

    await cache.set(cacheKey, overview, 30);
    return overview;
}

async function getInsights(client, userId) {
    const cacheKey = `insights:${userId}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
        return cached;
    }

    const { data, error } = await problemRepository.fetchAllProblems(client, userId);
    if (error) {
        throw error;
    }

    const insights = buildInsights(data || []);
    await cache.set(cacheKey, insights, 60);
    return insights;
}

async function getAchievements(client, userId) {
    const cacheKey = `achievements:${userId}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
        return cached;
    }

    const { data, error } = await problemRepository.fetchAllProblems(client, userId);
    if (error) {
        throw error;
    }

    const problems = data || [];
    const streaks = computeStreakInfo([...problems].reverse());
    const hardCount = problems.filter((problem) => problem.difficulty === 'Hard').length;
    const achievements = [
        { id: 'first-solve', title: 'First Solve', unlocked: problems.length >= 1, description: 'Logged your first DSA problem.' },
        { id: 'ten-solves', title: 'Ten Problems', unlocked: problems.length >= 10, description: 'Crossed 10 logged problems.' },
        { id: 'fifty-solves', title: 'Half Century', unlocked: problems.length >= 50, description: 'Crossed 50 logged problems.' },
        { id: 'first-hard', title: 'First Hard', unlocked: hardCount >= 1, description: 'Solved your first Hard problem.' },
        { id: 'streak-7', title: '7 Day Streak', unlocked: streaks.longest_streak >= 7, description: 'Maintained a 7-day streak.' },
        { id: 'streak-30', title: '30 Day Streak', unlocked: streaks.longest_streak >= 30, description: 'Maintained a 30-day streak.' },
    ];

    await cache.set(cacheKey, achievements, 60);
    return achievements;
}

module.exports = {
    getStats,
    getUserStats,
    getVelocity,
    getActivity,
    getPlatforms,
    getTopics,
    getOverview,
    getInsights,
    getAchievements,
};
