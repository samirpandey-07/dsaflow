const { z } = require('zod');

const platformEnum = ['LeetCode', 'GeeksforGeeks', 'Codeforces', 'HackerRank', 'Other'];
const difficultyEnum = ['Easy', 'Medium', 'Hard'];
const goalMetricEnum = ['total_solves', 'weekly_solves', 'monthly_solves', 'hard_solves', 'topic_solves', 'platform_solves', 'streak_days'];
const goalPeriodEnum = ['weekly', 'monthly', 'quarterly', 'all_time', 'custom'];
const goalStatusEnum = ['active', 'completed', 'paused', 'archived'];

const problemSchema = z.object({
    topic: z.string().min(1, 'Topic is required'),
    problem: z.string().min(1, 'Problem name is required'),
    difficulty: z.enum(difficultyEnum).optional().default('Medium'),
    language: z.string().min(1).optional().default('Unknown'),
    platform: z.enum(platformEnum).optional().default('Other'),
    problem_url: z.string().url().optional().or(z.literal('')).default(''),
    code_snippet: z.string().optional().default(''),
    tags: z.array(z.string().min(1)).max(20).optional().default([]),
    solved_at: z.string().datetime().optional(),
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
    tags: z.array(z.string().min(1)).max(20).optional(),
    solved_at: z.string().datetime().optional(),
});

const noteSchema = z.object({
    problem_id: z.string().uuid('Invalid problem ID'),
    note: z.string().min(1, 'Note content cannot be empty'),
});

const goalSchema = z.object({
    title: z.string().min(1).max(120),
    metric: z.enum(goalMetricEnum),
    period: z.enum(goalPeriodEnum).optional().default('all_time'),
    target_count: z.coerce.number().int().positive(),
    focus_topic: z.string().min(1).max(80).optional().nullable(),
    focus_platform: z.enum(platformEnum).optional().nullable(),
    due_date: z.string().date().optional().nullable(),
    status: z.enum(goalStatusEnum).optional().default('active'),
});

const goalUpdateSchema = goalSchema.partial();

const publicProfileSchema = z.object({
    slug: z.string().min(3).max(40).regex(/^[a-z0-9-]+$/, 'Slug must use lowercase letters, numbers, and hyphens').optional(),
    display_name: z.string().min(1).max(80).optional(),
    avatar_url: z.string().url().optional().or(z.literal('')),
    headline: z.string().max(160).optional().or(z.literal('')),
    bio: z.string().max(500).optional().or(z.literal('')),
    is_public: z.boolean().optional(),
    share_badge: z.boolean().optional(),
});

const platformImportSchema = z.object({
    handle: z.string().min(1).max(80),
    limit: z.coerce.number().int().min(1).max(1000).optional().default(200),
});

const csvImportSchema = z.object({
    csv_text: z.string().min(1).optional(),
    problems: z.array(problemSchema).min(1).max(500).optional(),
}).refine((payload) => payload.csv_text || (payload.problems && payload.problems.length > 0), {
    message: 'Provide csv_text or problems',
    path: ['csv_text'],
});

module.exports = {
    problemSchema,
    bulkImportSchema,
    problemUpdateSchema,
    noteSchema,
    goalSchema,
    goalUpdateSchema,
    publicProfileSchema,
    platformImportSchema,
    csvImportSchema,
    platformEnum,
    difficultyEnum,
    goalMetricEnum,
    goalPeriodEnum,
    goalStatusEnum,
};
