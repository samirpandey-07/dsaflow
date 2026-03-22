const problemService = require('./problem.service');
const platformProfileRepository = require('../repositories/platform-profile.repository');
const { problemSchema } = require('../validation/schemas');

const LEETCODE_GRAPHQL_URL = 'https://leetcode.com/graphql';
const CODEFORCES_API_URL = 'https://codeforces.com/api';

function titleCase(input) {
    return (input || '')
        .split(/[\s_-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function normalizeDifficulty(value) {
    const normalized = String(value || '').toLowerCase();
    if (normalized.includes('hard')) {
        return 'Hard';
    }
    if (normalized.includes('medium')) {
        return 'Medium';
    }
    return 'Easy';
}

function normalizePlatform(value) {
    const normalized = String(value || '').toLowerCase();
    if (normalized.includes('leet')) return 'LeetCode';
    if (normalized.includes('geeks')) return 'GeeksforGeeks';
    if (normalized.includes('codeforces')) return 'Codeforces';
    if (normalized.includes('hacker')) return 'HackerRank';
    return 'Other';
}

function inferTopic(tags, fallback = 'General') {
    if (Array.isArray(tags) && tags.length) {
        return titleCase(tags[0]);
    }
    return fallback;
}

function pickTags(tags) {
    return (tags || []).map((tag) => titleCase(tag)).slice(0, 12);
}

function parseCsvLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        const next = line[index + 1];

        if (char === '"' && inQuotes && next === '"') {
            current += '"';
            index += 1;
            continue;
        }
        if (char === '"') {
            inQuotes = !inQuotes;
            continue;
        }
        if (char === ',' && !inQuotes) {
            values.push(current);
            current = '';
            continue;
        }

        current += char;
    }

    values.push(current);
    return values.map((value) => value.trim());
}

function parseCsvProblems(csvText) {
    const lines = csvText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    if (lines.length < 2) {
        return [];
    }

    const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
    const rows = [];

    for (const line of lines.slice(1)) {
        const values = parseCsvLine(line);
        const row = {};
        headers.forEach((header, index) => {
            row[header] = values[index] || '';
        });

        rows.push({
            topic: row.topic || row.category || 'Imported',
            problem: row.problem || row.problem_name || row.name || 'Untitled Problem',
            difficulty: normalizeDifficulty(row.difficulty || 'Medium'),
            language: row.language || 'Unknown',
            platform: normalizePlatform(row.platform || 'Other'),
            problem_url: row.problem_url || row.url || '',
            code_snippet: row.code_snippet || row.code || '',
            tags: (row.tags || '')
                .split(/[|;]+|,(?=\s*[A-Za-z])/)
                .map((tag) => tag.trim())
                .filter(Boolean)
                .slice(0, 20),
            solved_at: row.solved_at || row.date || undefined,
        });
    }

    return rows;
}

function dedupeByIdentity(problems) {
    const seen = new Set();
    return problems.filter((problem) => {
        const key = `${problem.platform}::${problem.problem}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

function ensureValidProblems(problems) {
    return problems
        .map((problem) => {
            const parsed = problemSchema.safeParse(problem);
            return parsed.success ? parsed.data : null;
        })
        .filter(Boolean);
}

async function fetchJson(url, init) {
    const response = await fetch(url, init);
    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Upstream request failed (${response.status}): ${body.slice(0, 200)}`);
    }
    return response.json();
}

async function fetchText(url, init) {
    const response = await fetch(url, init);
    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Upstream request failed (${response.status}): ${body.slice(0, 200)}`);
    }
    return response.text();
}

async function runGraphql(query, variables) {
    const payload = await fetchJson(LEETCODE_GRAPHQL_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, variables }),
    });

    if (payload.errors?.length) {
        throw new Error(payload.errors[0].message || 'LeetCode GraphQL request failed.');
    }

    return payload.data;
}

function extractJsonObject(source, startIndex) {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = startIndex; index < source.length; index += 1) {
        const char = source[index];
        if (inString) {
            if (escaped) {
                escaped = false;
                continue;
            }
            if (char === '\\') {
                escaped = true;
                continue;
            }
            if (char === '"') {
                inString = false;
            }
            continue;
        }

        if (char === '"') {
            inString = true;
            continue;
        }
        if (char === '{') {
            depth += 1;
        }
        if (char === '}') {
            depth -= 1;
            if (depth === 0) {
                return source.slice(startIndex, index + 1);
            }
        }
    }

    return null;
}

async function importCsv(client, userId, payload) {
    const parsed = payload.problems?.length ? payload.problems : parseCsvProblems(payload.csv_text || '');
    const validProblems = ensureValidProblems(parsed);
    const result = await problemService.bulkImportProblems(client, userId, dedupeByIdentity(validProblems));
    return {
        platform: 'CSV',
        imported: result.imported,
        connected_profile: null,
        warnings: validProblems.length ? [] : ['No valid rows were found in the CSV payload.'],
    };
}

function codeforcesDifficulty(problem) {
    const rating = Number(problem.rating || problem.points || 0);
    if (rating >= 1800) return 'Hard';
    if (rating >= 1200) return 'Medium';
    return 'Easy';
}

async function importCodeforces(client, userId, payload) {
    const [statusPayload, userInfoPayload] = await Promise.all([
        fetchJson(`${CODEFORCES_API_URL}/user.status?handle=${encodeURIComponent(payload.handle)}&from=1&count=${payload.limit}`),
        fetchJson(`${CODEFORCES_API_URL}/user.info?handles=${encodeURIComponent(payload.handle)}`),
    ]);

    const accepted = (statusPayload.result || []).filter((submission) => submission.verdict === 'OK');
    const unique = [];
    const seen = new Set();

    for (const submission of accepted) {
        const problem = submission.problem || {};
        const key = `${problem.contestId || 'gym'}-${problem.index || ''}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        unique.push({
            topic: inferTopic(problem.tags, 'Competitive Programming'),
            problem: problem.name,
            difficulty: codeforcesDifficulty(problem),
            language: submission.programmingLanguage || 'Unknown',
            platform: 'Codeforces',
            problem_url: problem.contestId
                ? `https://codeforces.com/problemset/problem/${problem.contestId}/${problem.index}`
                : '',
            tags: pickTags(problem.tags),
            solved_at: new Date((submission.creationTimeSeconds || 0) * 1000).toISOString(),
        });
    }

    const validProblems = ensureValidProblems(unique);
    const result = await problemService.bulkImportProblems(client, userId, validProblems);
    const userInfo = userInfoPayload.result?.[0] || {};
    const topTags = Object.entries(unique.reduce((acc, entry) => {
        for (const tag of entry.tags || []) {
            acc[tag] = (acc[tag] || 0) + 1;
        }
        return acc;
    }, {}))
        .map(([tagName, problemsSolved]) => ({ tagName, problemsSolved }))
        .sort((a, b) => b.problemsSolved - a.problemsSolved)
        .slice(0, 10);

    const platformProfile = await platformProfileRepository.upsertPlatformProfile(client, {
        user_id: userId,
        platform: 'Codeforces',
        handle: payload.handle,
        solved_count: unique.length,
        imported_problem_count: result.imported,
        contest_rating: userInfo.rating || null,
        rank_label: userInfo.rank || null,
        language_stats: [],
        top_tags: topTags,
        badges: [],
        metadata: {
            maxRating: userInfo.maxRating || null,
            maxRank: userInfo.maxRank || null,
        },
        last_synced_at: new Date().toISOString(),
    });

    if (platformProfile.error) {
        throw platformProfile.error;
    }

    return {
        platform: 'Codeforces',
        imported: result.imported,
        connected_profile: platformProfile.data,
        warnings: [],
    };
}

async function importLeetCode(client, userId, payload) {
    const data = await runGraphql(
        `query importer($username: String!, $limit: Int!) {
            matchedUser(username: $username) {
                username
                profile {
                    ranking
                    userAvatar
                    realName
                    reputation
                    starRating
                }
                submitStats {
                    acSubmissionNum {
                        difficulty
                        count
                        submissions
                    }
                }
                languageProblemCount {
                    languageName
                    problemsSolved
                }
                tagProblemCounts {
                    advanced { tagName problemsSolved }
                    intermediate { tagName problemsSolved }
                    fundamental { tagName problemsSolved }
                }
            }
            recentAcSubmissionList(username: $username, limit: $limit) {
                title
                titleSlug
                timestamp
            }
        }`,
        { username: payload.handle, limit: Math.min(payload.limit, 50) },
    );

    if (!data.matchedUser) {
        throw new Error('LeetCode profile not found.');
    }

    const recent = data.recentAcSubmissionList || [];
    const questionDetails = [];

    for (const submission of recent) {
        const detail = await runGraphql(
            `query question($titleSlug: String!) {
                question(titleSlug: $titleSlug) {
                    difficulty
                    topicTags { name }
                }
            }`,
            { titleSlug: submission.titleSlug },
        );

        questionDetails.push({
            ...submission,
            detail: detail.question,
        });
    }

    const normalized = ensureValidProblems(dedupeByIdentity(questionDetails.map((submission) => ({
        topic: inferTopic(submission.detail?.topicTags?.map((tag) => tag.name), 'Practice'),
        problem: submission.title,
        difficulty: normalizeDifficulty(submission.detail?.difficulty || 'Medium'),
        language: 'Unknown',
        platform: 'LeetCode',
        problem_url: `https://leetcode.com/problems/${submission.titleSlug}/`,
        tags: pickTags(submission.detail?.topicTags?.map((tag) => tag.name)),
        solved_at: submission.timestamp
            ? new Date(Number(submission.timestamp) * 1000).toISOString()
            : new Date().toISOString(),
    }))));

    const result = await problemService.bulkImportProblems(client, userId, normalized);
    const matchedUser = data.matchedUser;
    const tagGroups = matchedUser.tagProblemCounts || {};
    const topTags = [...(tagGroups.fundamental || []), ...(tagGroups.intermediate || []), ...(tagGroups.advanced || [])]
        .sort((a, b) => (b.problemsSolved || 0) - (a.problemsSolved || 0))
        .slice(0, 12);

    const solvedCount = matchedUser.submitStats?.acSubmissionNum?.find((item) => item.difficulty === 'All')?.count || normalized.length;
    const platformProfile = await platformProfileRepository.upsertPlatformProfile(client, {
        user_id: userId,
        platform: 'LeetCode',
        handle: payload.handle,
        solved_count: solvedCount,
        imported_problem_count: result.imported,
        contest_rating: matchedUser.profile?.ranking || null,
        rank_label: matchedUser.profile?.ranking ? `Global Rank ${matchedUser.profile.ranking}` : null,
        language_stats: matchedUser.languageProblemCount || [],
        top_tags: topTags,
        badges: [],
        metadata: {
            avatar_url: matchedUser.profile?.userAvatar || null,
            real_name: matchedUser.profile?.realName || null,
            reputation: matchedUser.profile?.reputation || 0,
            star_rating: matchedUser.profile?.starRating || 0,
            import_mode: 'recent_public_accepts',
        },
        last_synced_at: new Date().toISOString(),
    });

    if (platformProfile.error) {
        throw platformProfile.error;
    }

    return {
        platform: 'LeetCode',
        imported: result.imported,
        connected_profile: platformProfile.data,
        warnings: [
            'LeetCode public import currently syncs recent accepted submissions plus a full profile snapshot. Use CSV for a complete historical backfill.',
        ],
    };
}

async function importGeeksforGeeks(client, userId, payload) {
    const html = await fetchText(`https://www.geeksforgeeks.org/profile/${encodeURIComponent(payload.handle)}`);
    const decoded = html.replace(/\\"/g, '"');
    const marker = '"userData":{"message":"data retrieved successfully","data":';
    const markerIndex = decoded.indexOf(marker);
    if (markerIndex === -1) {
        throw new Error('Could not find a public GeeksforGeeks profile payload for that handle.');
    }

    const jsonStart = markerIndex + marker.length;
    const objectString = extractJsonObject(decoded, jsonStart);
    if (!objectString) {
        throw new Error('Failed to parse the GeeksforGeeks profile payload.');
    }

    const profileData = JSON.parse(objectString);
    const platformProfile = await platformProfileRepository.upsertPlatformProfile(client, {
        user_id: userId,
        platform: 'GeeksforGeeks',
        handle: payload.handle,
        solved_count: profileData.total_problems_solved || 0,
        imported_problem_count: 0,
        contest_rating: null,
        rank_label: profileData.institute_rank ? `Institute Rank ${profileData.institute_rank}` : null,
        language_stats: [],
        top_tags: [],
        badges: [],
        metadata: {
            name: profileData.name || payload.handle,
            avatar_url: profileData.profile_image_url || null,
            score: profileData.score || 0,
            monthly_score: profileData.monthly_score || 0,
            current_streak: profileData.pod_solved_current_streak || 0,
            import_mode: 'profile_snapshot_only',
        },
        last_synced_at: new Date().toISOString(),
    });

    if (platformProfile.error) {
        throw platformProfile.error;
    }

    return {
        platform: 'GeeksforGeeks',
        imported: 0,
        connected_profile: platformProfile.data,
        warnings: [
            'GeeksforGeeks public sync currently stores a profile snapshot. Import actual solved problems via CSV for a full historical backfill.',
        ],
    };
}

async function listConnectedProfiles(client, userId) {
    const result = await platformProfileRepository.listPlatformProfiles(client, userId);
    if (result.error) {
        throw result.error;
    }
    return result.data || [];
}

module.exports = {
    importCsv,
    importCodeforces,
    importLeetCode,
    importGeeksforGeeks,
    listConnectedProfiles,
};
