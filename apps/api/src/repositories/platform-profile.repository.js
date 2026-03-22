async function listPlatformProfiles(client, userId) {
    return client
        .from('platform_profiles')
        .select('*')
        .eq('user_id', userId)
        .order('last_synced_at', { ascending: false });
}

async function upsertPlatformProfile(client, row) {
    return client
        .from('platform_profiles')
        .upsert([row], { onConflict: 'user_id,platform,handle' })
        .select()
        .single();
}

module.exports = {
    listPlatformProfiles,
    upsertPlatformProfile,
};
