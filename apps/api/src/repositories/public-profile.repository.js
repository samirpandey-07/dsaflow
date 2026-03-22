async function getProfileByUserId(client, userId) {
    return client
        .from('public_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
}

async function getPublicProfileBySlug(client, slug) {
    return client
        .from('public_profiles')
        .select('*')
        .eq('slug', slug)
        .eq('is_public', true)
        .maybeSingle();
}

async function upsertProfile(client, row) {
    return client
        .from('public_profiles')
        .upsert([row], { onConflict: 'user_id' })
        .select()
        .single();
}

module.exports = {
    getProfileByUserId,
    getPublicProfileBySlug,
    upsertProfile,
};
