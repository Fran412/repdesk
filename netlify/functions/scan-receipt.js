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
              text: `You are reading a Nigerian bank payment receipt or transfer screenshot. Extract these details and return ONLY a JSON object with no explanation, no markdown, no backticks:
{
  "refNo": "the transaction or reference number",
  "amount": the numeric amount in naira with no commas or symbols,
  "bank": "the bank name",
  "date": "the date in YYYY-MM-DD format"
}
If you cannot find a value, use null for that field.`,
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