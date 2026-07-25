exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const { imageBase64, mediaType } = JSON.parse(event.body);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 500,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType || "image/jpeg",
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: `Extract from this Nigerian bank receipt. Return ONLY this JSON, no other text:
{"refNo":"reference number here","amount":0,"bank":"bank name here","date":"YYYY-MM-DD"}`,
            },
          ],
        }],
      }),
    });

    const data = await response.json();
    
    // Log for debugging
    console.log("Claude response:", JSON.stringify(data));

    if (!data.content || !data.content[0]) {
      console.log("No content in response:", JSON.stringify(data));
      return { statusCode: 500, body: JSON.stringify({ error: "No response from Claude" }) };
    }

    const text = data.content[0].text.trim();
    console.log("Claude text:", text);

    // Strip any markdown
    const clean = text.replace(/```json|```/g, "").trim();
    
    // Extract JSON from response
    const match = clean.match(/\{[\s\S]*\}/);
    if (!match) {
      console.log("No JSON found in:", clean);
      return { statusCode: 500, body: JSON.stringify({ error: "Could not parse response" }) };
    }

    const parsed = JSON.parse(match[0]);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    };
  } catch (err) {
    console.log("Error:", err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};