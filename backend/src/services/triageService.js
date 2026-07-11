const buildTriage = async ({ asset, complaint }) => {
  const text = `${asset?.name || ''} ${asset?.category || ''} ${asset?.condition || ''} ${asset?.location || ''} ${complaint || ''}`.toLowerCase();

  const fallbackTriage = {
    title: 'Maintenance issue detected',
    category: asset?.category || 'General',
    priority: 'Medium',
    possibleCauses: ['Needs inspection'],
    initialChecks: ['Inspect the asset safely', 'Verify visible damage', 'Review recent activity'],
    warning: 'This output is advisory. A qualified technician must confirm the diagnosis.',
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
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
      const promptText = `
You are an expert AI maintenance triage assistant for MaintainIQ.
Your task is to analyze a maintenance complaint for a physical asset and suggest structured issue details.

Asset Context:
- Name: ${asset?.name || 'Unknown'}
- Code: ${asset?.code || 'Unknown'}
- Category: ${asset?.category || 'General'}
- Current Condition: ${asset?.condition || 'Good'}
- Location: ${asset?.location || 'Unknown'}
- Notes: ${asset?.notes || 'None'}

User Complaint:
"${complaint}"

Return a JSON object with the following fields:
- "title": A short, professional issue title (e.g. "Water leakage and reduced cooling").
- "category": Suggested category matching the issue. Select the most relevant category strictly from this list: ["Electronics / IT", "Electrical", "HVAC / Air Conditioning", "Plumbing", "Mechanical / Furniture", "Safety & Security", "Lab Equipment"].
- "priority": Recommended priority ("Low", "Medium", "High", or "Critical"). If there are sparks, smoke, or critical safety hazards, mark as "Critical".
- "possibleCauses": An array of 2-4 possible technical causes.
- "initialChecks": An array of 2-4 safe diagnostic checks that a reporter or technician can perform before starting repairs. NEVER suggest unsafe checks.
- "warning": A safety caution warning (especially if electrical, fire, mechanical, or industrial hazards are involved. Else, "This output is advisory. A qualified technician must confirm the diagnosis.")

Do not include any markdown styling or wrapper like \`\`\`json. Return ONLY the raw JSON string.
`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (responseText) {
          const parsed = JSON.parse(responseText);
          if (parsed.title && parsed.category && parsed.priority) {
            return {
              title: parsed.title,
              category: parsed.category,
              priority: parsed.priority,
              possibleCauses: Array.isArray(parsed.possibleCauses) ? parsed.possibleCauses : fallbackTriage.possibleCauses,
              initialChecks: Array.isArray(parsed.initialChecks) ? parsed.initialChecks : fallbackTriage.initialChecks,
              warning: parsed.warning || fallbackTriage.warning,
              reviewedByUser: false,
            };
          }
        }
      }
    } catch (error) {
      console.error('Gemini API Triage error, using fallback:', error.message);
    }
  }

  return fallbackTriage;
};

const generateMaintenanceSummary = async ({ asset, issue }) => {
  const fallbackSummary = {
    summary: `Maintenance completed successfully for ${asset?.name || 'Asset'}. Findings: ${issue?.inspectionFindings || 'HDMI damaged'}. Work Performed: ${issue?.workPerformed || 'Replaced cable'}.`,
    recommendation: `Conduct regular checks of the connectors and cable routing to prevent future wear and tear.`,
  };

  if (process.env.GEMINI_API_KEY) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
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

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (responseText) {
          const parsed = JSON.parse(responseText);
          if (parsed.summary && parsed.recommendation) {
            return {
              summary: parsed.summary,
              recommendation: parsed.recommendation,
            };
          }
        }
      }
    } catch (error) {
      console.error('Gemini API Summary error, using fallback:', error.message);
    }
  }

  return fallbackSummary;
};

module.exports = { buildTriage, generateMaintenanceSummary };
