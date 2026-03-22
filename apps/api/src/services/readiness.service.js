const problemRepository = require('../repositories/problem.repository');
const statsRepository = require('../repositories/stats.repository');

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function round(value) {
    return Math.round(value);
}

function buildTopicCounts(problems) {
    const counts = new Map();
    for (const problem of problems) {
        counts.set(problem.topic, (counts.get(problem.topic) || 0) + 1);
    }
    return counts;
}

function buildReadinessFromProblems(problems, userStats) {
    const totalSolved = problems.length;
    const hardSolved = problems.filter((problem) => problem.difficulty === 'Hard').length;
    const mediumSolved = problems.filter((problem) => problem.difficulty === 'Medium').length;
    const uniqueTopics = buildTopicCounts(problems);
    const monthlySolved = problems.filter((problem) => {
        const solvedAt = new Date(problem.solved_at).getTime();
        return solvedAt >= Date.now() - (30 * 24 * 60 * 60 * 1000);
    }).length;
    const overdueCount = problems.filter((problem) => {
        if (!problem.next_revision_at) {
            return false;
        }
        return new Date(problem.next_revision_at).getTime() < Date.now();
    }).length;

    const solveVolume = clamp((totalSolved / 150) * 25, 0, 25);
    const difficultyBalance = clamp((((mediumSolved * 0.7) + (hardSolved * 1.4)) / 80) * 20, 0, 20);
    const topicBreadth = clamp((uniqueTopics.size / 10) * 20, 0, 20);
    const streakDiscipline = clamp((((userStats?.current_streak || 0) / 14) * 10) + ((monthlySolved / 20) * 10), 0, 20);
    const revisionHealth = clamp(15 - Math.min(15, overdueCount * 1.5), 0, 15);

    const score = round(solveVolume + difficultyBalance + topicBreadth + streakDiscipline + revisionHealth);
    const level = score >= 85
        ? 'Interview Ready'
        : score >= 70
            ? 'Strong Momentum'
            : score >= 50
                ? 'Developing'
                : 'Foundation';

    const sortedTopics = [...uniqueTopics.entries()].sort((a, b) => a[1] - b[1]);
    const weakTopics = sortedTopics.slice(0, 3).map(([topic, count]) => ({ topic, count }));

    const recommendations = [];
    if (hardSolved < Math.max(3, Math.floor(totalSolved * 0.1))) {
        recommendations.push('Add one hard problem each week to build interview confidence.');
    }
    if (uniqueTopics.size < 6) {
        recommendations.push('Widen topic coverage to avoid overfitting to one pattern family.');
    }
    if (overdueCount > 3) {
        recommendations.push('Clear overdue revisions to convert solved problems into retention.');
    }
    if (monthlySolved < 12) {
        recommendations.push('Raise monthly solve volume to strengthen consistency before interviews.');
    }
    if (!recommendations.length) {
        recommendations.push('Keep mixing new hard problems with scheduled revisions to maintain readiness.');
    }

    return {
        score,
        level,
        totals: {
            total_solved: totalSolved,
            hard_solved: hardSolved,
            medium_solved: mediumSolved,
            unique_topics: uniqueTopics.size,
            monthly_solved: monthlySolved,
            overdue_revisions: overdueCount,
            current_streak: userStats?.current_streak || 0,
        },
        breakdown: {
            solve_volume: round(solveVolume),
            difficulty_balance: round(difficultyBalance),
            topic_breadth: round(topicBreadth),
            streak_discipline: round(streakDiscipline),
            revision_health: round(revisionHealth),
        },
        weak_topics: weakTopics,
        recommendations,
    };
}

async function getInterviewReadiness(client, userId) {
    const [problemsResult, userStatsResult] = await Promise.all([
        problemRepository.fetchAllProblems(client, userId),
        statsRepository.getUserStats(client, userId),
    ]);

    if (problemsResult.error) {
        throw problemsResult.error;
    }
    if (userStatsResult.error && userStatsResult.error.code !== 'PGRST116') {
        throw userStatsResult.error;
    }

    return buildReadinessFromProblems(problemsResult.data || [], userStatsResult.data || null);
}

module.exports = {
    buildReadinessFromProblems,
    getInterviewReadiness,
};
