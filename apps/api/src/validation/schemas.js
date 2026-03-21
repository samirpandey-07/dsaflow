const { z } = require('zod');

const platformEnum = ['LeetCode', 'GeeksforGeeks', 'Codeforces', 'HackerRank', 'Other'];
const difficultyEnum = ['Easy', 'Medium', 'Hard'];

const problemSchema = z.object({
    topic: z.string().min(1, 'Topic is required'),
    problem: z.string().min(1, 'Problem name is required'),
    difficulty: z.enum(difficultyEnum).optional().default('Medium'),
    language: z.string().min(1).optional().default('Unknown'),
    platform: z.enum(platformEnum).optional().default('Other'),
    problem_url: z.string().url().optional().or(z.literal('')).default(''),
    code_snippet: z.string().optional().default(''),
});

const bulkImportSchema = z.object({
    problems: z.array(problemSchema).min(1).max(100),
});

const problemUpdateSchema = z.object({
    topic: z.string().min(1).optional(),
    problem_name: z.string().min(1).optional(),
    difficulty: z.enum(difficultyEnum).optional(),
    language: z.string().min(1).optional(),
    platform: z.enum(platformEnum).optional(),
    problem_url: z.string().url().optional().or(z.literal('')),
    code_snippet: z.string().optional(),
});

const noteSchema = z.object({
    problem_id: z.string().uuid('Invalid problem ID'),
    note: z.string().min(1, 'Note content cannot be empty'),
});

module.exports = {
    problemSchema,
    bulkImportSchema,
    problemUpdateSchema,
    noteSchema,
    platformEnum,
    difficultyEnum,
};
