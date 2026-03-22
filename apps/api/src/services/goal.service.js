const goalRepository = require('../repositories/goal.repository');
const problemRepository = require('../repositories/problem.repository');
const statsRepository = require('../repositories/stats.repository');

function getWindowStart(period) {
    const now = new Date();
    if (period === 'weekly') {
        now.setDate(now.getDate() - 6);
        return now;
    }
    if (period === 'monthly') {
        now.setDate(now.getDate() - 29);
        return now;
    }
    if (period === 'quarterly') {
        now.setDate(now.getDate() - 89);
        return now;
    }
    return null;
}

function normalizeGoal(goal, problems, userStats) {
    const periodStart = getWindowStart(goal.period);
    const scopedProblems = periodStart
        ? problems.filter((problem) => new Date(problem.solved_at).getTime() >= periodStart.getTime())
        : problems;

    let currentValue = 0;
    if (goal.metric === 'total_solves') {
        currentValue = scopedProblems.length;
    }
    if (goal.metric === 'weekly_solves') {
        currentValue = problems.filter((problem) => new Date(problem.solved_at).getTime() >= Date.now() - (7 * 24 * 60 * 60 * 1000)).length;
    }
    if (goal.metric === 'monthly_solves') {
        currentValue = problems.filter((problem) => new Date(problem.solved_at).getTime() >= Date.now() - (30 * 24 * 60 * 60 * 1000)).length;
    }
    if (goal.metric === 'hard_solves') {
        currentValue = scopedProblems.filter((problem) => problem.difficulty === 'Hard').length;
    }
    if (goal.metric === 'topic_solves') {
        currentValue = scopedProblems.filter((problem) => !goal.focus_topic || problem.topic === goal.focus_topic).length;
    }
    if (goal.metric === 'platform_solves') {
        currentValue = scopedProblems.filter((problem) => !goal.focus_platform || problem.platform === goal.focus_platform).length;
    }
    if (goal.metric === 'streak_days') {
        currentValue = userStats?.current_streak || 0;
    }

    const progressPct = Math.min(100, Math.round((currentValue / goal.target_count) * 100));
    const remaining = Math.max(0, goal.target_count - currentValue);
    const completed = currentValue >= goal.target_count;

    return {
        ...goal,
        current_value: currentValue,
        progress_pct: progressPct,
        remaining,
        computed_status: completed ? 'completed' : goal.status,
    };
}

async function listGoals(client, userId) {
    const [goalsResult, problemsResult, userStatsResult] = await Promise.all([
        goalRepository.listGoals(client, userId),
        problemRepository.fetchAllProblems(client, userId),
        statsRepository.getUserStats(client, userId),
    ]);

    if (goalsResult.error) {
        throw goalsResult.error;
    }
    if (problemsResult.error) {
        throw problemsResult.error;
    }
    if (userStatsResult.error && userStatsResult.error.code !== 'PGRST116') {
        throw userStatsResult.error;
    }

    const goals = (goalsResult.data || []).map((goal) => normalizeGoal(goal, problemsResult.data || [], userStatsResult.data || null));
    const activeCount = goals.filter((goal) => goal.computed_status === 'active').length;
    const completedCount = goals.filter((goal) => goal.computed_status === 'completed').length;

    return {
        goals,
        summary: {
            total: goals.length,
            active: activeCount,
            completed: completedCount,
        },
    };
}

async function createGoal(client, userId, payload) {
    const { data, error } = await goalRepository.createGoal(client, {
        user_id: userId,
        ...payload,
    });

    if (error) {
        throw error;
    }

    return data;
}

async function updateGoal(client, userId, id, payload) {
    const { data, error } = await goalRepository.updateGoal(client, userId, id, payload);
    if (error) {
        throw error;
    }
    return data;
}

async function deleteGoal(client, userId, id) {
    const { error } = await goalRepository.deleteGoal(client, userId, id);
    if (error) {
        throw error;
    }
    return { deleted: true };
}

module.exports = {
    listGoals,
    createGoal,
    updateGoal,
    deleteGoal,
};
