/**
 * apps/api/src/emails/weeklyDigest.js
 *
 * Builds a beautiful inline-CSS HTML email for the weekly DSA summary.
 * Uses inline styles for maximum email client compatibility.
 */

/**
 * @param {Object} data
 * @param {string} data.userName - display name or email prefix
 * @param {number} data.currentStreak - days streak
 * @param {number} data.solvedThisWeek - problems solved last 7 days
 * @param {number} data.solvedLastWeek - problems solved 8–14 days ago (for comparison)
 * @param {number} data.easyCount
 * @param {number} data.mediumCount
 * @param {number} data.hardCount
 * @param {Array<{name: string, count: number}>} data.topTopics - top 3 topics
 * @param {Array<{problem_name: string, topic: string, difficulty: string, problem_url?: string}>} data.recentProblems - last 5 problems
 * @param {number} data.overdueRevisions - count of problems overdue for revision
 */
function buildDigestEmail(data) {
    const {
        userName = 'Coder',
        currentStreak = 0,
        solvedThisWeek = 0,
        solvedLastWeek = 0,
        easyCount = 0,
        mediumCount = 0,
        hardCount = 0,
        topTopics = [],
        recentProblems = [],
        overdueRevisions = 0,
    } = data;

    const trend = solvedThisWeek >= solvedLastWeek ? '📈' : '📉';
    const trendLabel = solvedThisWeek >= solvedLastWeek
        ? `Up ${solvedThisWeek - solvedLastWeek} from last week`
        : `Down ${solvedLastWeek - solvedThisWeek} from last week`;

    const motivationalTip = getMotivationalTip(solvedThisWeek, currentStreak);

    const difficultyBar = buildDifficultyBar(easyCount, mediumCount, hardCount);
    const topicsHtml = buildTopicsHtml(topTopics);
    const recentProblemsHtml = buildRecentProblemsHtml(recentProblems);
    const overdueHtml = overdueRevisions > 0 ? `
        <tr><td style="padding: 0 0 24px;">
            <div style="background: #2a1a0a; border: 1px solid #78350f; border-radius: 12px; padding: 16px 20px;">
                <p style="margin: 0; color: #fb923c; font-size: 14px;">
                    ⚠️ You have <strong>${overdueRevisions} problem(s)</strong> overdue for revision. Open your DSAFlow dashboard to review them!
                </p>
            </div>
        </td></tr>` : '';

    const subject = solvedThisWeek === 0
        ? `🌱 DSAFlow Weekly — Let's get back on track, ${userName}!`
        : `🔥 DSAFlow Weekly — ${solvedThisWeek} problems solved this week, ${userName}!`;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- HEADER -->
        <tr><td style="padding-bottom:24px;text-align:center;">
          <div style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#3b82f6);border-radius:16px;padding:14px 26px;">
            <span style="color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">DSAFlow 🚀</span>
          </div>
          <p style="color:#71717a;font-size:13px;margin:10px 0 0;">Weekly Progress Report · ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </td></tr>

        <!-- GREETING -->
        <tr><td style="background:#18181b;border:1px solid #27272a;border-radius:20px;padding:32px;margin-bottom:16px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding-bottom:24px;">
              <h1 style="margin:0;color:#fff;font-size:26px;font-weight:800;line-height:1.2;">
                Hey ${userName}! ${currentStreak > 0 ? '🔥' : '👋'}
              </h1>
              <p style="margin:8px 0 0;color:#a1a1aa;font-size:15px;">
                Here's your weekly coding summary. ${currentStreak > 0 ? `You're on a <strong style="color:#fb923c;">${currentStreak}-day streak</strong> — keep it going!` : `Start a streak this week!`}
              </p>
            </td></tr>

            <!-- KEY STATS ROW -->
            <tr><td style="padding-bottom:24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="31%" style="background:#0f172a;border:1px solid #1e293b;border-radius:14px;padding:18px;text-align:center;">
                    <div style="color:#7c3aed;font-size:28px;font-weight:900;line-height:1;">${solvedThisWeek}</div>
                    <div style="color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">This Week</div>
                    <div style="color:#71717a;font-size:11px;margin-top:4px;">${trend} ${trendLabel}</div>
                  </td>
                  <td width="4%"></td>
                  <td width="31%" style="background:#0f172a;border:1px solid #1e293b;border-radius:14px;padding:18px;text-align:center;">
                    <div style="color:#fb923c;font-size:28px;font-weight:900;line-height:1;">${currentStreak}</div>
                    <div style="color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Day Streak</div>
                    <div style="color:#71717a;font-size:11px;margin-top:4px;">${currentStreak > 0 ? 'Keep it alive!' : 'Start today!'}</div>
                  </td>
                  <td width="4%"></td>
                  <td width="31%" style="background:#0f172a;border:1px solid #1e293b;border-radius:14px;padding:18px;text-align:center;">
                    <div style="color:#22c55e;font-size:28px;font-weight:900;line-height:1;">${easyCount + mediumCount + hardCount}</div>
                    <div style="color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Total Solved</div>
                    <div style="color:#71717a;font-size:11px;margin-top:4px;">All time</div>
                  </td>
                </tr>
              </table>
            </td></tr>

            <!-- DIFFICULTY BREAKDOWN -->
            <tr><td style="padding-bottom:24px;">
              <h2 style="margin:0 0 14px;color:#fff;font-size:16px;font-weight:700;">📊 Difficulty Breakdown</h2>
              ${difficultyBar}
            </td></tr>

            <!-- TOP TOPICS -->
            ${topicsHtml ? `<tr><td style="padding-bottom:24px;">
              <h2 style="margin:0 0 14px;color:#fff;font-size:16px;font-weight:700;">📚 Top Topics This Week</h2>
              ${topicsHtml}
            </td></tr>` : ''}

            <!-- RECENT PROBLEMS -->
            ${recentProblemsHtml ? `<tr><td style="padding-bottom:24px;">
              <h2 style="margin:0 0 14px;color:#fff;font-size:16px;font-weight:700;">📝 Last 5 Problems Solved</h2>
              ${recentProblemsHtml}
            </td></tr>` : ''}

            <!-- OVERDUE REVISIONS WARNING -->
            ${overdueHtml}

            <!-- MOTIVATIONAL TIP -->
            <tr><td>
              <div style="background:#0d1117;border:1px solid #21262d;border-radius:14px;padding:18px 20px;">
                <p style="margin:0;color:#7c3aed;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">💡 Tip of the Week</p>
                <p style="margin:8px 0 0;color:#d4d4d8;font-size:14px;line-height:1.6;">${motivationalTip}</p>
              </div>
            </td></tr>

          </table>
        </td></tr>

        <!-- CTA -->
        <tr><td style="padding:24px 0;text-align:center;">
          <a href="http://localhost:3000" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#3b82f6);color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:12px;">
            Open Dashboard →
          </a>
        </td></tr>

        <!-- FOOTER -->
        <tr><td style="text-align:center;padding-bottom:32px;">
          <p style="color:#52525b;font-size:12px;margin:0;">You're receiving this because you use DSAFlow.</p>
          <p style="color:#52525b;font-size:12px;margin:4px 0 0;">Built with ❤️ for competitive programmers.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    return { subject, html };
}

function buildDifficultyBar(easy, medium, hard) {
    const total = easy + medium + hard || 1;
    const easyPct = Math.round((easy / total) * 100);
    const medPct = Math.round((medium / total) * 100);
    const hardPct = Math.round((hard / total) * 100);

    return `
    <div style="background:#0f172a;border:1px solid #1e293b;border-radius:12px;padding:16px 20px;">
      <div style="display:flex;gap:4px;margin-bottom:12px;">
        ${easyPct > 0 ? `<div style="height:8px;width:${easyPct}%;background:#22c55e;border-radius:4px;"></div>` : ''}
        ${medPct > 0 ? `<div style="height:8px;width:${medPct}%;background:#f97316;border-radius:4px;"></div>` : ''}
        ${hardPct > 0 ? `<div style="height:8px;width:${hardPct}%;background:#ef4444;border-radius:4px;"></div>` : ''}
      </div>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:#22c55e;font-size:13px;">✅ Easy <strong>${easy}</strong></td>
          <td style="color:#f97316;font-size:13px;text-align:center;">🟡 Medium <strong>${medium}</strong></td>
          <td style="color:#ef4444;font-size:13px;text-align:right;">🔥 Hard <strong>${hard}</strong></td>
        </tr>
      </table>
    </div>`;
}

function buildTopicsHtml(topics) {
    if (!topics.length) return '';
    return topics.map((t, i) => `
    <div style="display:flex;align-items:center;justify-content:space-between;background:#0f172a;border:1px solid #1e293b;border-radius:10px;padding:12px 16px;margin-bottom:8px;">
      <span style="color:#d4d4d8;font-size:14px;font-weight:500;">${['🥇', '🥈', '🥉'][i] || '📌'} ${t.name}</span>
      <span style="color:#7c3aed;font-size:14px;font-weight:700;">${t.count} problem${t.count > 1 ? 's' : ''}</span>
    </div>`).join('');
}

function buildRecentProblemsHtml(problems) {
    if (!problems.length) return '';
    return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">` +
        problems.map(p => {
            const diffColor = p.difficulty === 'Easy' ? '#22c55e' : p.difficulty === 'Hard' ? '#ef4444' : '#f97316';
            const nameHtml = p.problem_url
                ? `<a href="${p.problem_url}" style="color:#93c5fd;text-decoration:none;font-weight:500;">${p.problem_name}</a>`
                : `<span style="color:#d4d4d8;font-weight:500;">${p.problem_name}</span>`;
            return `<tr>
              <td style="padding:9px 0;border-bottom:1px solid #1e293b;">
                <table width="100%" cellpadding="0" cellspacing="0"><tr>
                  <td style="font-size:13px;">${nameHtml} <span style="color:#52525b;font-size:12px;">(${p.topic})</span></td>
                  <td style="text-align:right;"><span style="color:${diffColor};font-size:12px;font-weight:600;">${p.difficulty}</span></td>
                </tr></table>
              </td>
            </tr>`;
        }).join('') + `</table>`;
}

function getMotivationalTip(solvedThisWeek, streak) {
    if (solvedThisWeek === 0) return "Consistency beats intensity. Even one problem a day builds neural pathways that compound over time. Open your editor and solve just one today!";
    if (solvedThisWeek >= 14) return "You're crushing it! Consider attempting problems one level above your comfort zone — that's where real growth happens.";
    if (solvedThisWeek >= 7) return "Great week! Focus on understanding the pattern behind each solution, not just getting it right. Spaced repetition is your best friend.";
    if (streak > 7) return `A ${streak}-day streak is not a coincidence — it's a habit. The best engineers aren't the smartest, they're the most consistent.`;
    return "Try the 'rubber duck' technique: explain your approach out loud before coding. It forces you to clarify your thinking and find bugs faster.";
}

module.exports = { buildDigestEmail };
