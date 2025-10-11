// This file goes in: api/generate-mcq.js

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { content, topic, numQuestions } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'Content is required' });
  }

  const prompt = `You are a medical educator creating high-quality multiple choice questions for medical students.

Topic: ${topic || 'Medical Study Material'}
Number of questions to create: ${numQuestions || 10}

Study Material:
${content}

Create ${numQuestions || 10} multiple choice questions based on the provided material. Each question should:
1. Test important concepts, not trivial details
2. Have 4 options (A, B, C, D)
3. Have exactly ONE correct answer
4. Include a brief explanation of why the answer is correct

CRITICAL: You must respond ONLY with valid JSON. Do not include any text before or after the JSON. Do not use markdown code blocks.

Format your response as a JSON array with this EXACT structure:
[
  {
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct": 0,
    "explanation": "Brief explanation here"
  }
]

The "correct" field should be the index (0-3) of the correct answer in the options array.

Generate the questions now:`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Cheaper and faster
        messages: [
          {
            role: 'system',
            content: 'You are a medical education expert who creates high-quality MCQs. Always respond with valid JSON only, no markdown.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 3000
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('OpenAI API Error:', error);
      return res.status(response.status).json({ error: 'Failed to generate questions' });
    }

    const data = await response.json();
    let mcqText = data.choices[0].message.content;

    // Clean up response - remove markdown code blocks if present
    mcqText = mcqText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    const mcqs = JSON.parse(mcqText);

    return res.status(200).json({ questions: mcqs });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
