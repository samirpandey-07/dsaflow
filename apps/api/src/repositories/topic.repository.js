async function upsertTopics(client, names) {
    if (!names.length) {
        return { data: [], error: null };
    }

    return client
        .from('topics')
        .upsert(names.map((name) => ({ name })), { onConflict: 'name' });
}

async function listTopics(client) {
    return client.from('topics').select('*');
}

module.exports = {
    upsertTopics,
    listTopics,
};
