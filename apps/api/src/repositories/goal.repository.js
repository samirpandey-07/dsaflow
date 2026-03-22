async function listGoals(client, userId) {
    return client
        .from('user_goals')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
}

async function createGoal(client, row) {
    return client
        .from('user_goals')
        .insert([row])
        .select()
        .single();
}

async function updateGoal(client, userId, id, payload) {
    return client
        .from('user_goals')
        .update(payload)
        .eq('user_id', userId)
        .eq('id', id)
        .select()
        .single();
}

async function deleteGoal(client, userId, id) {
    return client
        .from('user_goals')
        .delete()
        .eq('user_id', userId)
        .eq('id', id);
}

module.exports = {
    listGoals,
    createGoal,
    updateGoal,
    deleteGoal,
};
