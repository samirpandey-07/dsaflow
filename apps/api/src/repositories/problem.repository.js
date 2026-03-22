function buildProblemListQuery(client, userId, options) {
    const {
        limit,
        cursor,
        search,
        topic,
        difficulty,
        platform,
        revisionStatus,
        sortBy,
        ascending,
    } = options;

    let query = client
        .from('problems')
        .select('id, problem_name, topic, difficulty, language, platform, problem_url, code_snippet, tags, solved_at, revision_count, next_revision_at')
        .eq('user_id', userId)
        .order(sortBy, { ascending })
        .limit(limit + 1);

    if (cursor && sortBy === 'solved_at') {
        query = ascending ? query.gt('solved_at', cursor) : query.lt('solved_at', cursor);
    }
    if (search) {
        query = query.ilike('problem_name', `%${search}%`);
    }
    if (topic && topic !== 'All') {
        query = query.eq('topic', topic);
    }
    if (difficulty && difficulty !== 'All') {
        query = query.eq('difficulty', difficulty);
    }
    if (platform && platform !== 'All') {
        query = query.eq('platform', platform);
    }
    if (revisionStatus === 'due') {
        query = query.lte('next_revision_at', new Date().toISOString());
    }
    if (revisionStatus === 'upcoming') {
        query = query.gt('next_revision_at', new Date().toISOString());
    }

    return query;
}

async function createProblem(client, row) {
    return client.from('problems').insert([row]).select().single();
}

async function bulkCreateProblems(client, rows) {
    return client.from('problems').insert(rows).select();
}

async function findProblemByIdentity(client, userId, problemName, platform) {
    return client
        .from('problems')
        .select('id, problem_name, topic, difficulty, language, platform, problem_url, code_snippet, tags, solved_at, revision_count, next_revision_at')
        .eq('user_id', userId)
        .eq('problem_name', problemName)
        .eq('platform', platform)
        .order('solved_at', { ascending: false })
        .limit(1)
        .maybeSingle();
}

async function listProblems(client, userId, options) {
    return buildProblemListQuery(client, userId, options);
}

async function fetchAllProblems(client, userId) {
    return client
        .from('problems')
        .select('id, problem_name, topic, difficulty, language, platform, problem_url, code_snippet, tags, solved_at, revision_count, next_revision_at')
        .eq('user_id', userId)
        .order('solved_at', { ascending: false });
}

async function getProblemById(client, userId, id, select = '*') {
    return client
        .from('problems')
        .select(select)
        .eq('id', id)
        .eq('user_id', userId)
        .single();
}

async function updateProblem(client, userId, id, payload) {
    return client
        .from('problems')
        .update(payload)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();
}

async function deleteProblem(client, userId, id) {
    return client
        .from('problems')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
}

async function countProblems(client, userId, filters = {}) {
    let query = client
        .from('problems')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);

    if (filters.gteSolvedAt) {
        query = query.gte('solved_at', filters.gteSolvedAt);
    }
    if (filters.ltSolvedAt) {
        query = query.lt('solved_at', filters.ltSolvedAt);
    }
    if (filters.lteNextRevisionAt) {
        query = query.lte('next_revision_at', filters.lteNextRevisionAt);
    }

    return query;
}

module.exports = {
    createProblem,
    bulkCreateProblems,
    findProblemByIdentity,
    listProblems,
    fetchAllProblems,
    getProblemById,
    updateProblem,
    deleteProblem,
    countProblems,
};
