const problemRepository = require('../repositories/problem.repository');
const topicRepository = require('../repositories/topic.repository');
const { refreshUserStats } = require('./streak.service');
const { invalidateUserCache, cache } = require('./cache.service');

async function rebuildUserStats(client, userId) {
    const { data: problems, error } = await problemRepository.fetchAllProblems(client, userId);
    if (error) {
        throw error;
    }

    await refreshUserStats(client, userId, [...(problems || [])].reverse());
}

async function createProblem(client, userId, payload) {
    const existing = await problemRepository.findProblemByIdentity(client, userId, payload.problem, payload.platform);
    if (existing.data) {
        return { created: false, problem: existing.data };
    }

    const { data, error } = await problemRepository.createProblem(client, {
        user_id: userId,
        problem_name: payload.problem,
        topic: payload.topic,
        difficulty: payload.difficulty,
        language: payload.language,
        platform: payload.platform,
        problem_url: payload.problem_url || null,
        code_snippet: payload.code_snippet || null,
        revision_count: 0,
        next_revision_at: new Date(Date.now() + 86400000).toISOString(),
    });

    if (error) {
        throw error;
    }

    await topicRepository.upsertTopics(client, [payload.topic]);
    await rebuildUserStats(client, userId);
    await invalidateUserCache(userId);

    return { created: true, problem: data };
}

async function bulkImportProblems(client, userId, payloads) {
    const rows = [];
    const topics = new Set();

    for (const payload of payloads) {
        const existing = await problemRepository.findProblemByIdentity(client, userId, payload.problem, payload.platform);
        if (existing.data) {
            continue;
        }

        topics.add(payload.topic);
        rows.push({
            user_id: userId,
            problem_name: payload.problem,
            topic: payload.topic,
            difficulty: payload.difficulty,
            language: payload.language,
            platform: payload.platform,
            problem_url: payload.problem_url || null,
            code_snippet: payload.code_snippet || null,
            revision_count: 0,
            next_revision_at: new Date(Date.now() + 86400000).toISOString(),
        });
    }

    const result = rows.length
        ? await problemRepository.bulkCreateProblems(client, rows)
        : { data: [], error: null };

    if (result.error) {
        throw result.error;
    }

    await topicRepository.upsertTopics(client, [...topics]);
    await rebuildUserStats(client, userId);
    await invalidateUserCache(userId);

    return {
        imported: result.data.length,
        problems: result.data,
    };
}

async function listProblems(client, userId, options) {
    const cacheKey = [
        'problems',
        userId,
        options.limit,
        options.cursor || 'start',
        options.search || 'all',
        options.topic || 'all',
        options.difficulty || 'all',
        options.platform || 'all',
        options.revisionStatus || 'all',
        options.sortBy,
        options.ascending ? 'asc' : 'desc',
    ].join(':');

    const cached = await cache.get(cacheKey);
    if (cached) {
        return cached;
    }

    const { data, error } = await problemRepository.listProblems(client, userId, options);
    if (error) {
        throw error;
    }

    const hasNextPage = data.length > options.limit;
    const items = hasNextPage ? data.slice(0, options.limit) : data;
    const nextCursor = hasNextPage && options.sortBy === 'solved_at'
        ? items[items.length - 1].solved_at
        : null;

    const result = {
        items,
        next_cursor: nextCursor,
        has_next_page: hasNextPage,
    };

    await cache.set(cacheKey, result, cache.DEFAULTS.problems);
    return result;
}

async function updateProblem(client, userId, id, payload) {
    const { data, error } = await problemRepository.updateProblem(client, userId, id, {
        ...payload,
        problem_url: payload.problem_url === '' ? null : payload.problem_url,
    });

    if (error) {
        throw error;
    }

    await invalidateUserCache(userId);
    return data;
}

async function deleteProblem(client, userId, id) {
    const { error } = await problemRepository.deleteProblem(client, userId, id);
    if (error) {
        throw error;
    }

    await rebuildUserStats(client, userId);
    await invalidateUserCache(userId);
    return { deleted: true };
}

async function getOwnedProblem(client, userId, id, select) {
    const result = await problemRepository.getProblemById(client, userId, id, select);
    if (result.error) {
        throw result.error;
    }
    return result.data;
}

module.exports = {
    createProblem,
    bulkImportProblems,
    listProblems,
    updateProblem,
    deleteProblem,
    getOwnedProblem,
};
