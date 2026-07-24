const Anthropic = require("@anthropic-ai/sdk");

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const { imageBase64, mediaType } = JSON.parse(event.body);

    const client = new Anthropic.default({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: `Look at this Nigerian bank payment receipt image carefully. Extract every number and text you can see.

Return ONLY a valid JSON object, nothing else:
{
  "refNo": "transaction or session ID or reference number you can find",
  "amount": the total amount as a plain number only (e.g. 2100),
  "bank": "name of the bank",
  "date": "date in YYYY-MM-DD format"
}

If a field is truly not visible, use null. Do not add any explanation or markdown.`,
            },
          ],
        },
      ],
    });

    const text = response.content[0].text.trim();
    const parsed = JSON.parse(text);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};