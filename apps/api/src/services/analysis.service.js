const { GoogleGenerativeAI } = require('@google/generative-ai');
const problemRepository = require('../repositories/problem.repository');

const analysisAI = process.env.GEMINI_API_KEY
    ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    : null;

async function analyzeProblem(client, userId, problemId, code) {
    const { data: problem, error: fetchError } = await problemRepository.getProblemById(
        client,
        userId,
        problemId,
        'problem_name, topic, difficulty, language',
    );

    if (fetchError || !problem) {
        const error = new Error('Problem not found');
        error.status = 404;
        throw error;
    }

    if (!analysisAI) {
        return {
            time_complexity: 'O(N log N)',
            space_complexity: 'O(N)',
            bottlenecks: `The typical bottleneck for ${problem.topic} problems is repeated traversal or extra memory churn.`,
            recommendations: `For ${problem.difficulty} ${problem.topic} problems, see if a hash map, greedy invariant, or two-pointer pass can simplify the solution.`,
            alternative_approach: 'Try deriving a lower-complexity variant using preprocessing plus a single scan.',
            pattern_detected: problem.topic,
            edge_cases: ['Empty input', 'Single element', 'All identical elements'],
        };
    }

    const model = analysisAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const codeSection = code
        ? `\n\nCode Solution:\n\`\`\`${problem.language.toLowerCase()}\n${code}\n\`\`\``
        : '';

    const prompt = `You are an expert DSA coach. Analyze the following problem and provide a concise technical review.\n\nProblem: ${problem.problem_name}\nTopic: ${problem.topic}\nDifficulty: ${problem.difficulty}\nLanguage: ${problem.language}${codeSection}\n\nProvide a JSON response with exactly these fields:\n- time_complexity (string)\n- space_complexity (string)\n- bottlenecks (string, one sentence)\n- recommendations (string, one actionable tip)\n- alternative_approach (string, one sentence)\n- pattern_detected (string)\n- edge_cases (array of 3 strings)\n\nRespond ONLY with valid JSON.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/\`\`\`json|\`\`\`/g, '').trim();
    return JSON.parse(text);
}

module.exports = {
    analyzeProblem,
};
