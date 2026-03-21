const statsRepository = require('../repositories/stats.repository');

function toDay(dateString) {
    return new Date(dateString).toISOString().slice(0, 10);
}

function computeStreakInfo(problems) {
    const uniqueDays = Array.from(new Set(problems.map((problem) => toDay(problem.solved_at)))).sort();
    let currentStreak = 0;
    let longestStreak = 0;
    let previousDay = null;

    for (const day of uniqueDays) {
        if (!previousDay) {
            currentStreak = 1;
            longestStreak = 1;
            previousDay = day;
            continue;
        }

        const diffInDays = Math.round((new Date(day).getTime() - new Date(previousDay).getTime()) / 86400000);
        currentStreak = diffInDays === 1 ? currentStreak + 1 : 1;
        longestStreak = Math.max(longestStreak, currentStreak);
        previousDay = day;
    }

    if (uniqueDays.length > 0) {
        const today = new Date();
        const last = new Date(uniqueDays[uniqueDays.length - 1]);
        const diffFromToday = Math.round((new Date(toDay(today.toISOString())).getTime() - last.getTime()) / 86400000);
        if (diffFromToday > 1) {
            currentStreak = 0;
        }
    }

    return {
        current_streak: currentStreak,
        longest_streak: longestStreak,
    };
}

async function refreshUserStats(client, userId, problems) {
    const streaks = computeStreakInfo(problems || []);
    const lastSolveDate = problems?.length ? toDay(problems[problems.length - 1].solved_at) : null;

    await statsRepository.upsertUserStats(client, {
        user_id: userId,
        current_streak: streaks.current_streak,
        longest_streak: streaks.longest_streak,
        last_solve_date: lastSolveDate,
    });
}

module.exports = {
    computeStreakInfo,
    refreshUserStats,
};
