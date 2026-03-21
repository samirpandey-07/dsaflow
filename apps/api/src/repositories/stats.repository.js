async function getDifficultyStats(client, userId) {
    return client
        .from('user_difficulty_stats')
        .select('*')
        .eq('user_id', userId)
        .single();
}

async function getVelocityStats(client, userId) {
    return client
        .from('user_velocity')
        .select('*')
        .eq('user_id', userId)
        .single();
}

async function getTopicStats(client, userId) {
    return client
        .from('user_topic_stats')
        .select('*')
        .eq('user_id', userId)
        .order('solved', { ascending: false });
}

async function getPlatformStats(client, userId) {
    return client
        .from('user_platform_stats')
        .select('*')
        .eq('user_id', userId)
        .order('solve_count', { ascending: false });
}

async function getUserStats(client, userId) {
    return client
        .from('user_stats')
        .select('*')
        .eq('user_id', userId)
        .single();
}

async function upsertUserStats(client, row) {
    return client.from('user_stats').upsert([row], { onConflict: 'user_id' });
}

module.exports = {
    getDifficultyStats,
    getVelocityStats,
    getTopicStats,
    getPlatformStats,
    getUserStats,
    upsertUserStats,
};
