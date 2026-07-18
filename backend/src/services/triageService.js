const GEMINI_TIMEOUT_MS = 8000;

// The AI provider is auto-detected from the key format so either works:
//   AIza...  -> Google Gemini (free tier at https://aistudio.google.com/apikey)
//   sk-...   -> OpenAI (as a lifeline when a Gemini key is unavailable)
const detectProvider = () => {
  const key = process.env.GEMINI_API_KEY || '';
  if (!key) return null;
  return key.startsWith('sk-') ? 'openai' : 'gemini';
};

// Calls the configured AI with a hard timeout so a hung request can never stall
// the API (also keeps us inside Vercel's serverless execution window).
// Always returns parsed JSON (or null) — both providers are asked for raw JSON.
const callGemini = async (promptText) => {
  const key = process.env.GEMINI_API_KEY;
  const provider = detectProvider();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    let responseText;

    if (provider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: promptText }],
          response_format: { type: 'json_object' },
          temperature: 0.3,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`OpenAI API responded with HTTP ${response.status}`);
      }

      const data = await response.json();
      responseText = data.choices?.[0]?.message?.content;
    } else {
      // Model fallback chain: some projects have per-model access/quota limits,
      // so each model is tried in order until one responds.
      const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-flash-latest'];
      let lastError = null;

      for (const model of GEMINI_MODELS) {
        try {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
            body: JSON.stringify({
              contents: [{ parts: [{ text: promptText }] }],
              generationConfig: {
                responseMimeType: 'application/json',
              },
            }),
            signal: controller.signal,
          });

          if (!response.ok) {
            lastError = new Error(`Gemini API responded with HTTP ${response.status} (${model})`);
            continue;
          }

          const data = await response.json();
          responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          lastError = null;
          break;
        } catch (error) {
          if (error.name === 'AbortError') throw error;
          lastError = error;
        }
      }

      if (lastError) {
        throw lastError;
      }
    }

    if (!responseText) return null;
    return JSON.parse(responseText);
  } finally {
    clearTimeout(timer);
  }
};

// Connection status is checked once at startup (and lazily on demand) so the
// health endpoint and the UI can tell whether real AI or the fallback is active.
let geminiStatus = { connected: false, reason: 'Not checked yet', checkedAt: null };

const checkGeminiConnection = async () => {
  const provider = detectProvider();
  if (!provider) {
    geminiStatus = { connected: false, provider: null, reason: 'GEMINI_API_KEY is not set', checkedAt: new Date() };
    return geminiStatus;
  }

  try {
    const parsed = await callGemini('Return exactly this JSON object and nothing else: {"ok": true}');
    geminiStatus = parsed
      ? { connected: true, provider, reason: 'OK', checkedAt: new Date() }
      : { connected: false, provider, reason: 'Empty or invalid response from the AI provider', checkedAt: new Date() };
  } catch (error) {
    geminiStatus = { connected: false, provider, reason: error.message, checkedAt: new Date() };
  }

  return geminiStatus;
};

const getGeminiStatus = () => geminiStatus;

// Cheap non-AI recurring-failure check so the warning also works in fallback mode.
const detectRecurringPattern = (recentIssues = []) => {
  const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const recent = recentIssues.filter((issue) => new Date(issue.createdAt).getTime() >= ninetyDaysAgo);
  if (recent.length < 2) return null;

  const byCategory = {};
  recent.forEach((issue) => {
    const key = issue.category || 'General';
    byCategory[key] = (byCategory[key] || 0) + 1;
  });

  const [topCategory, count] = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
  if (count >= 2) {
    return `This asset has had ${count} "${topCategory}" issues in the last 90 days. Consider a deeper inspection or replacement review.`;
  }
  return `This asset has had ${recent.length} issues in the last 90 days. Watch for a recurring fault.`;
};

const summarizeHistoryForPrompt = (recentIssues = []) =>
  recentIssues
    .slice(0, 5)
    .map((issue) => `- [${new Date(issue.createdAt).toISOString().slice(0, 10)}] ${issue.category || 'General'} / ${issue.status}: ${issue.title}`)
    .join('\n') || 'None';

const buildTriage = async ({ asset, complaint, recentIssues = [] }) => {
  const text = `${asset?.name || ''} ${asset?.category || ''} ${asset?.condition || ''} ${asset?.location || ''} ${complaint || ''}`.toLowerCase();
  const recurringPattern = detectRecurringPattern(recentIssues);

  const fallbackTriage = {
    title: 'Maintenance issue detected',
    category: asset?.category || 'General',
    priority: 'Medium',
    possibleCauses: ['Needs inspection'],
    initialChecks: ['Inspect the asset safely', 'Verify visible damage', 'Review recent activity'],
    warning: 'This output is advisory. A qualified technician must confirm the diagnosis.',
    recurringPattern,
    reviewedByUser: false,
  };

  if (text.includes('water') || text.includes('leak')) {
    fallbackTriage.title = 'Leakage or fluid ingress';
    fallbackTriage.category = 'Plumbing';
    fallbackTriage.priority = 'High';
    fallbackTriage.possibleCauses = ['Blocked drainage', 'Damaged seal', 'Loose connection'];
    fallbackTriage.initialChecks = ['Switch off power if electrical parts are exposed', 'Inspect the source of leakage', 'Check drainage or seals'];
  }

  if (text.includes('flicker') || text.includes('display') || text.includes('screen')) {
    fallbackTriage.title = 'Display instability or flickering';
    fallbackTriage.category = 'Electronics / IT';
    fallbackTriage.priority = fallbackTriage.priority === 'High' ? 'High' : 'Medium';
    fallbackTriage.possibleCauses = ['Faulty cable', 'Loose connector', 'Internal panel issue'];
    fallbackTriage.initialChecks = ['Check the connection cable', 'Restart the device safely', 'Inspect display input settings'];
  }

  if (text.includes('hdmi')) {
    fallbackTriage.title = 'HDMI detection issue';
    fallbackTriage.category = 'Electronics / IT';
    fallbackTriage.priority = 'High';
    fallbackTriage.possibleCauses = ['Damaged HDMI cable', 'Loose port', 'Input source problem'];
    fallbackTriage.initialChecks = ['Inspect the HDMI cable', 'Try another input cable if available', 'Verify the source device output'];
  }

  if (text.includes('noise')) {
    fallbackTriage.possibleCauses = [...new Set([...fallbackTriage.possibleCauses, 'Loose internal component', 'Fan or motor wear'])];
  }

  if (text.includes('critical') || text.includes('smoke') || text.includes('spark')) {
    fallbackTriage.priority = 'Critical';
    fallbackTriage.initialChecks = ['Stop use immediately', 'Keep people away from the asset', 'Call a qualified technician'];
  }

  if (process.env.GEMINI_API_KEY) {
    try {
      const promptText = `
You are an expert AI maintenance triage assistant for MaintainIQ.
Your task is to analyze a maintenance complaint for a physical asset and suggest structured issue details.

The complaint may be written in English, Urdu, or Roman Urdu (Urdu written with Latin letters, e.g. "AC pani tapak raha hai").
Always understand it and produce ALL output fields in professional English.

Asset Context:
- Name: ${asset?.name || 'Unknown'}
- Code: ${asset?.code || 'Unknown'}
- Category: ${asset?.category || 'General'}
- Current Condition: ${asset?.condition || 'Good'}
- Location: ${asset?.location || 'Unknown'}
- Notes: ${asset?.notes || 'None'}

Recent issue history for this asset (newest first):
${summarizeHistoryForPrompt(recentIssues)}

User Complaint:
"${complaint}"

Return a JSON object with the following fields:
- "title": A short, professional issue title (e.g. "Water leakage and reduced cooling").
- "category": Suggested category matching the issue. Select the most relevant category strictly from this list: ["Electronics / IT", "Electrical", "HVAC / Air Conditioning", "Plumbing", "Mechanical / Furniture", "Safety & Security", "Lab Equipment"].
- "priority": Recommended priority ("Low", "Medium", "High", or "Critical"). If there are sparks, smoke, or critical safety hazards, mark as "Critical".
- "possibleCauses": An array of 2-4 possible technical causes.
- "initialChecks": An array of 2-4 safe diagnostic checks that a reporter or technician can perform before starting repairs. NEVER suggest unsafe checks.
- "warning": A safety caution warning (especially if electrical, fire, mechanical, or industrial hazards are involved. Else, "This output is advisory. A qualified technician must confirm the diagnosis.")
- "recurringPattern": If the recent issue history shows the same kind of fault repeating, a one-sentence warning describing the pattern and recommending deeper action (e.g. "3rd display-related issue in 60 days — consider replacing this projector."). Otherwise null.

Do not include any markdown styling or wrapper like \`\`\`json. Return ONLY the raw JSON string.
`;

      const parsed = await callGemini(promptText);
      if (parsed && parsed.title && parsed.category && parsed.priority) {
        return {
          title: parsed.title,
          category: parsed.category,
          priority: parsed.priority,
          possibleCauses: Array.isArray(parsed.possibleCauses) ? parsed.possibleCauses : fallbackTriage.possibleCauses,
          initialChecks: Array.isArray(parsed.initialChecks) ? parsed.initialChecks : fallbackTriage.initialChecks,
          warning: parsed.warning || fallbackTriage.warning,
          recurringPattern: typeof parsed.recurringPattern === 'string' && parsed.recurringPattern.trim() ? parsed.recurringPattern : recurringPattern,
          reviewedByUser: false,
        };
      }
    } catch (error) {
      console.error('Gemini API Triage error, using fallback:', error.message);
    }
  }

  return fallbackTriage;
};

const generateMaintenanceSummary = async ({ asset, issue }) => {
  const fallbackSummary = {
    summary: `Maintenance completed successfully for ${asset?.name || 'the asset'}. Findings: ${issue?.inspectionFindings || 'inspection completed'}. Work performed: ${issue?.workPerformed || issue?.maintenanceNotes || 'repair completed as recorded'}.`,
    recommendation: 'Schedule a routine inspection of this asset to prevent repeat faults and confirm the repair is holding up.',
  };

  if (process.env.GEMINI_API_KEY) {
    try {
      const promptText = `
You are an expert AI maintenance coordinator for MaintainIQ.
Analyze the following maintenance record for a resolved equipment issue and suggest a professional maintenance summary and a preventive recommendation.

Asset details:
- Name: ${asset?.name || 'Unknown'}
- Code: ${asset?.code || 'Unknown'}
- Category: ${asset?.category || 'General'}
- Final Condition: ${issue?.finalCondition || 'Good'}

Reported issue details:
- Title: ${issue?.title || 'Unknown'}
- Description: ${issue?.description || 'Unknown'}

Technician resolution details:
- Inspection findings: ${issue?.inspectionFindings || 'Unknown'}
- Work performed: ${issue?.workPerformed || 'Unknown'}
- Duration of repair: ${issue?.durationHours || 1} hours
- Parts used: ${JSON.stringify(issue?.partsUsed || [])}
- Maintenance Cost: $${issue?.maintenanceCost || 0}
- Notes: ${issue?.maintenanceNotes || 'None'}

Return a JSON object with the following fields:
- "summary": A concise, professional maintenance summary of what was diagnosed and corrected.
- "recommendation": A preventive recommendation or maintenance advice (e.g. "Inspect HDMI ports bi-monthly and route cables away from door hinges to prevent pinch damage.").

Do not include any markdown styling or wrapper like \`\`\`json. Return ONLY the raw JSON string.
`;

      const parsed = await callGemini(promptText);
      if (parsed && parsed.summary && parsed.recommendation) {
        return {
          summary: parsed.summary,
          recommendation: parsed.recommendation,
        };
      }
    } catch (error) {
      console.error('Gemini API Summary error, using fallback:', error.message);
    }
  }

  return fallbackSummary;
};

// AI Asset Health Report: analyzes the asset's full history + issue log and
// produces a management-ready summary. Only available when Gemini is connected —
// the caller shows a graceful "AI not connected" state otherwise.
const generateAssetHealthReport = async ({ asset, history = [], issues = [] }) => {
  if (!process.env.GEMINI_API_KEY) {
    return { available: false, message: 'AI is not connected (GEMINI_API_KEY missing). Connect Gemini to generate health reports.' };
  }

  const historyLines = history
    .slice(0, 20)
    .map((entry) => `- [${new Date(entry.createdAt).toISOString().slice(0, 10)}] ${entry.action}: ${entry.details || ''}`)
    .join('\n') || 'None';

  const issueLines = issues
    .slice(0, 15)
    .map((issue) => `- [${new Date(issue.createdAt).toISOString().slice(0, 10)}] ${issue.category || 'General'} / ${issue.status} / ${issue.priority}: ${issue.title}${issue.maintenanceCost ? ` (cost ${issue.maintenanceCost})` : ''}`)
    .join('\n') || 'None';

  const promptText = `
You are an expert maintenance analyst for MaintainIQ.
Analyze this asset's service history and issue log, then produce a concise health report for facility management.

Asset:
- Name: ${asset?.name || 'Unknown'}
- Code: ${asset?.code || 'Unknown'}
- Category: ${asset?.category || 'General'}
- Condition: ${asset?.condition || 'Unknown'}
- Status: ${asset?.status || 'Unknown'}
- Purchased: ${asset?.purchaseDate ? new Date(asset.purchaseDate).toISOString().slice(0, 10) : 'Unknown'}
- Last service: ${asset?.lastServiceDate ? new Date(asset.lastServiceDate).toISOString().slice(0, 10) : 'Never'}
- Next service due: ${asset?.nextServiceDate ? new Date(asset.nextServiceDate).toISOString().slice(0, 10) : 'Not scheduled'}

Issue log (newest first):
${issueLines}

Activity history (newest first):
${historyLines}

Return a JSON object with:
- "summary": 2-3 sentence professional health summary of this asset.
- "riskLevel": "Low", "Medium", or "High" — likelihood of failure/downtime soon.
- "recurringPatterns": one sentence describing any repeating fault pattern, or null if none.
- "recommendations": array of 2-4 short, actionable preventive recommendations.

Do not include any markdown styling or wrapper like \`\`\`json. Return ONLY the raw JSON string.
`;

  try {
    const parsed = await callGemini(promptText);
    if (parsed && parsed.summary && parsed.riskLevel) {
      return {
        available: true,
        report: {
          summary: parsed.summary,
          riskLevel: ['Low', 'Medium', 'High'].includes(parsed.riskLevel) ? parsed.riskLevel : 'Medium',
          recurringPatterns: typeof parsed.recurringPatterns === 'string' && parsed.recurringPatterns.trim() ? parsed.recurringPatterns : null,
          recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.slice(0, 4) : [],
          generatedAt: new Date(),
        },
      };
    }
    return { available: false, message: 'AI returned an invalid response. Try again in a moment.' };
  } catch (error) {
    return { available: false, message: `AI is currently unreachable (${error.message}). The rule-based fallback still covers triage.` };
  }
};

module.exports = { buildTriage, generateMaintenanceSummary, generateAssetHealthReport, checkGeminiConnection, getGeminiStatus };
