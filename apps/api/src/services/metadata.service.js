const GENERIC_TOPICS = new Set([
    'problems',
    'problem',
    'solutions',
    'solution',
    'src',
    'dsa',
    'dsaflow',
    'leetcode',
    'codeforces',
    'geeksforgeeks',
    'hackerrank',
]);

let codeforcesProblemSetCache = {
    fetchedAt: 0,
    problems: [],
};

function titleize(text) {
    return text
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function cleanFileName(fileName = '') {
    return titleize(
        fileName
            .replace(/\.[^.]+$/, '')
            .replace(/^\d+[\s._-]*/, '')
            .replace(/^\[(easy|medium|hard)\][\s._-]*/i, ''),
    );
}

function extractSlugFromUrl(url) {
    try {
        const parsed = new URL(url);
        const parts = parsed.pathname.split('/').filter(Boolean);
        return parts[parts.length - 1] || '';
    } catch {
        return '';
    }
}

function inferDifficulty(value, fallback = 'Medium') {
    const normalized = String(value || '').toLowerCase();
    if (normalized.includes('easy')) return 'Easy';
    if (normalized.includes('hard')) return 'Hard';
    if (normalized.includes('medium')) return 'Medium';
    return fallback;
}

function inferTopic(topicHint, tags = []) {
    if (topicHint) {
        return titleize(topicHint);
    }

    const firstTag = tags.find(Boolean);
    return firstTag ? titleize(firstTag) : 'General';
}

function normalizeTag(tag) {
    return titleize(String(tag || '').replace(/[^\w\s-]/g, ' ').trim());
}

function uniqueTags(tags) {
    return [...new Set((tags || []).map(normalizeTag).filter(Boolean))].slice(0, 20);
}

function inferTopicFromPath(pathHint = '') {
    const segments = pathHint
        .split(/[\\/]/)
        .map((segment) => segment.trim())
        .filter(Boolean)
        .reverse();

    for (const segment of segments) {
        const normalized = segment.toLowerCase();
        if (!GENERIC_TOPICS.has(normalized) && !normalized.includes('.')) {
            return titleize(segment);
        }
    }

    return '';
}

function inferPlatform(url = '') {
    const lower = url.toLowerCase();
    if (lower.includes('leetcode.com')) return 'LeetCode';
    if (lower.includes('geeksforgeeks.org')) return 'GeeksforGeeks';
    if (lower.includes('codeforces.com')) return 'Codeforces';
    if (lower.includes('hackerrank.com')) return 'HackerRank';
    return 'Other';
}

function extractTitleFromHtml(html) {
    const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1];
    const title = html.match(/<title>([^<]+)<\/title>/i)?.[1];
    return (ogTitle || title || '').replace(/\s*[-|].*$/, '').trim();
}

function extractDifficultyFromHtml(html, fallback = 'Medium') {
    return inferDifficulty(html.match(/\b(Easy|Medium|Hard)\b/i)?.[1], fallback);
}

async function resolveLeetCode(url, topicHint) {
    const slugMatch = url.match(/leetcode\.com\/problems\/([^/?#]+)/i);
    const slug = slugMatch?.[1];
    if (!slug) return null;

    const response = await fetch('https://leetcode.com/graphql/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Referer: `https://leetcode.com/problems/${slug}/`,
        },
        body: JSON.stringify({
            operationName: 'questionData',
            variables: { titleSlug: slug },
            query: 'query questionData($titleSlug: String!) { question(titleSlug: $titleSlug) { title difficulty topicTags { name } categoryTitle } }',
        }),
    });

    if (!response.ok) {
        throw new Error(`LeetCode metadata lookup failed with ${response.status}`);
    }

    const payload = await response.json();
    const question = payload?.data?.question;
    if (!question) {
        return null;
    }

    const tags = uniqueTags(question.topicTags?.map((tag) => tag.name) || []);
    return {
        problem: question.title || cleanFileName(slug),
        difficulty: inferDifficulty(question.difficulty, 'Medium'),
        topic: inferTopic(topicHint || question.categoryTitle, tags),
        platform: 'LeetCode',
        problem_url: url,
        tags,
        source: 'leetcode',
    };
}

function mapCodeforcesRatingToDifficulty(rating) {
    if (!rating || rating < 1200) return 'Easy';
    if (rating < 1900) return 'Medium';
    return 'Hard';
}

async function loadCodeforcesProblemSet() {
    if (Date.now() - codeforcesProblemSetCache.fetchedAt < 60 * 60 * 1000 && codeforcesProblemSetCache.problems.length) {
        return codeforcesProblemSetCache.problems;
    }

    const response = await fetch('https://codeforces.com/api/problemset.problems');
    if (!response.ok) {
        throw new Error(`Codeforces metadata lookup failed with ${response.status}`);
    }

    const payload = await response.json();
    if (payload?.status !== 'OK') {
        throw new Error('Codeforces metadata lookup failed');
    }

    codeforcesProblemSetCache = {
        fetchedAt: Date.now(),
        problems: payload.result?.problems || [],
    };

    return codeforcesProblemSetCache.problems;
}

async function resolveCodeforces(url, topicHint) {
    const match = url.match(/codeforces\.com\/(?:problemset\/problem|contest)\/(\d+)\/([A-Za-z0-9]+)/i);
    const contestId = Number(match?.[1]);
    const index = match?.[2];
    if (!contestId || !index) return null;

    const problems = await loadCodeforcesProblemSet();
    const problem = problems.find((entry) => entry.contestId === contestId && entry.index === index);
    if (!problem) {
        return {
            problem: `Codeforces ${contestId}${index}`,
            difficulty: 'Medium',
            topic: inferTopic(topicHint),
            platform: 'Codeforces',
            problem_url: url,
            tags: [],
            source: 'codeforces-fallback',
        };
    }

    const tags = uniqueTags(problem.tags || []);
    return {
        problem: problem.name || `Codeforces ${contestId}${index}`,
        difficulty: mapCodeforcesRatingToDifficulty(problem.rating),
        topic: inferTopic(topicHint, tags),
        platform: 'Codeforces',
        problem_url: url,
        tags,
        source: 'codeforces',
    };
}

async function resolveGenericHtml(url, platform, topicHint) {
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'DSAFlow Metadata Bot/1.0',
        },
    });

    if (!response.ok) {
        throw new Error(`${platform} metadata lookup failed with ${response.status}`);
    }

    const html = await response.text();
    const title = extractTitleFromHtml(html) || cleanFileName(extractSlugFromUrl(url));
    return {
        problem: title,
        difficulty: extractDifficultyFromHtml(html),
        topic: inferTopic(topicHint),
        platform,
        problem_url: url,
        tags: [],
        source: `${platform.toLowerCase()}-html`,
    };
}

async function resolveFromUrl(url, topicHint) {
    const platform = inferPlatform(url);
    if (platform === 'LeetCode') {
        return resolveLeetCode(url, topicHint);
    }
    if (platform === 'Codeforces') {
        return resolveCodeforces(url, topicHint);
    }
    if (platform === 'GeeksforGeeks' || platform === 'HackerRank') {
        return resolveGenericHtml(url, platform, topicHint);
    }

    return {
        problem: cleanFileName(extractSlugFromUrl(url)),
        difficulty: 'Medium',
        topic: inferTopic(topicHint),
        platform,
        problem_url: url,
        tags: [],
        source: 'generic-url',
    };
}

async function resolveProblemMetadata({ url, fileName, topicHint, pathHint, difficultyHint, tagsHint }) {
    const fallbackTopic = inferTopicFromPath(pathHint) || topicHint || 'General';
    const fallbackTags = uniqueTags([...(tagsHint || []), fallbackTopic]);
    const fallback = {
        problem: cleanFileName(fileName || extractSlugFromUrl(url) || 'Untitled Problem'),
        difficulty: inferDifficulty(difficultyHint, 'Medium'),
        topic: titleize(fallbackTopic),
        platform: inferPlatform(url),
        problem_url: url || '',
        tags: fallbackTags,
        source: 'local',
    };

    if (!url) {
        return fallback;
    }

    try {
        const resolved = await resolveFromUrl(url, fallback.topic);
        return {
            ...fallback,
            ...resolved,
            tags: uniqueTags([...(resolved?.tags || []), ...fallbackTags]),
        };
    } catch (error) {
        return {
            ...fallback,
            source: `fallback:${error.message}`,
        };
    }
}

module.exports = {
    resolveProblemMetadata,
};
