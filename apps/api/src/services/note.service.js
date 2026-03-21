const noteRepository = require('../repositories/note.repository');
const problemRepository = require('../repositories/problem.repository');

async function createNote(client, userId, problemId, content) {
    const { data: problem, error: problemError } = await problemRepository.getProblemById(client, userId, problemId, 'id');
    if (problemError || !problem) {
        const error = new Error('Not authorized to add notes to this problem');
        error.status = 403;
        throw error;
    }

    const { data, error } = await noteRepository.createNote(client, {
        problem_id: problemId,
        content,
    });

    if (error) {
        throw error;
    }

    return data;
}

async function listNotes(client, userId, problemId) {
    const { data: problem, error: problemError } = await problemRepository.getProblemById(client, userId, problemId, 'id');
    if (problemError || !problem) {
        const error = new Error('Not authorized');
        error.status = 403;
        throw error;
    }

    const { data, error } = await noteRepository.listNotesByProblem(client, problemId);
    if (error) {
        throw error;
    }

    return data || [];
}

module.exports = {
    createNote,
    listNotes,
};
