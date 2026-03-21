async function createNote(client, row) {
    return client.from('notes').insert([row]).select();
}

async function listNotesByProblem(client, problemId) {
    return client
        .from('notes')
        .select('id, content, created_at')
        .eq('problem_id', problemId)
        .order('created_at', { ascending: false });
}

module.exports = {
    createNote,
    listNotesByProblem,
};
