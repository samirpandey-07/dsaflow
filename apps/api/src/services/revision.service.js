const problemRepository = require('../repositories/problem.repository');
const { cache } = require('./cache.service');

const spacedRepetitionIntervals = [1, 3, 7, 14, 30];

async function reviseProblem(client, userId, problemId, action = 'complete', days = 2) {
    const { data: problem, error: getError } = await problemRepository.getProblemById(client, userId, problemId, 'id, revision_count');
    if (getError || !problem) {
        const error = new Error('Problem not found');
        error.status = 404;
        throw error;
    }

    let nextRevisionAt;
    let revisionCount = problem.revision_count || 0;

    if (action === 'snooze') {
        nextRevisionAt = new Date(Date.now() + days * 86400000).toISOString();
    } else {
        revisionCount += 1;
        const intervalDays = spacedRepetitionIntervals[Math.min(revisionCount - 1, spacedRepetitionIntervals.length - 1)];
        nextRevisionAt = new Date(Date.now() + intervalDays * 86400000).toISOString();
    }

    const { data, error } = await problemRepository.updateProblem(client, userId, problemId, {
        revision_count: revisionCount,
        next_revision_at: nextRevisionAt,
    });

    if (error) {
        throw error;
    }

    await cache.del(`revision-queue:${userId}`);
    return data;
}

async function getRevisionQueue(client, userId) {
    const cacheKey = `revision-queue:${userId}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
        return cached;
    }

    const { data: problems, error } = await problemRepository.fetchAllProblems(client, userId);
    if (error) {
        throw error;
    }

    const now = Date.now();
    const dueToday = [];
    const overdue = [];
    const upcoming = [];

    for (const problem of problems || []) {
        if (!problem.next_revision_at) {
            continue;
        }

        const revisionTime = new Date(problem.next_revision_at).getTime();
        const deltaDays = Math.floor((revisionTime - now) / 86400000);

        if (revisionTime < now && deltaDays < 0) {
            overdue.push(problem);
        } else if (Math.abs(deltaDays) <= 1) {
            dueToday.push(problem);
        } else {
            upcoming.push(problem);
        }
    }

    const queue = {
        due_today: dueToday.slice(0, 10),
        overdue: overdue.slice(0, 10),
        upcoming: upcoming.slice(0, 10),
        counts: {
            due_today: dueToday.length,
            overdue: overdue.length,
            upcoming: upcoming.length,
        },
    };

    await cache.set(cacheKey, queue, 30);
    return queue;
}

module.exports = {
    reviseProblem,
    getRevisionQueue,
};
