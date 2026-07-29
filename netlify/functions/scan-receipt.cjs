exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const { imageBase64, mediaType } = JSON.parse(event.body);

    // Call Google Vision OCR
    const visionRes = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${process.env.GOOGLE_VISION_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [{
            image: { content: imageBase64 },
            features: [{ type: "TEXT_DETECTION" }],
          }],
        }),
      }
    );

    const visionData = await visionRes.json();
    console.log("Vision response:", JSON.stringify(visionData));

    const fullText = visionData.responses?.[0]?.fullTextAnnotation?.text || "";
    console.log("Extracted text:", fullText);

    if (!fullText) {
      return { statusCode: 500, body: JSON.stringify({ error: "Could not extract text from image" }) };
    }

    // Parse the extracted text
    const result = parseReceiptText(fullText);
    console.log("Parsed result:", JSON.stringify(result));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    };
  } catch (err) {
    console.log("Error:", err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};

function parseReceiptText(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  // Amount — look for naira amounts like 2,100.00 or 5,000
  let amount = null;
  const amountMatch = text.match(/[#₦\u20a6]?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/);
  if (amountMatch) {
    amount = parseFloat(amountMatch[1].replace(/,/g, ""));
  }

  // Reference number — long alphanumeric strings
  let refNo = null;
  const refPatterns = [
    /(?:Reference\s*No[:\.]?\s*)([A-Z0-9]{10,})/i,
    /(?:Transaction\s*(?:ID|Ref)[:\.]?\s*)([A-Z0-9]{10,})/i,
    /(?:Session\s*ID[:\.]?\s*)([A-Z0-9]{10,})/i,
    /\b([A-Z]{2,4}[0-9]{10,})\b/,
    /\b([0-9]{15,})\b/,
  ];
  for (const pattern of refPatterns) {
    const match = text.match(pattern);
    if (match) { refNo = match[1]; break; }
  }

  // Bank name
  let bank = null;
  const banks = [
    "FirstBank", "First Bank", "GTBank", "Guaranty Trust",
    "Access Bank", "Zenith Bank", "UBA", "United Bank",
    "Fidelity Bank", "Sterling Bank", "Wema Bank", "Polaris Bank",
    "Stanbic IBTC", "Union Bank", "Ecobank", "Heritage Bank",
    "Keystone Bank", "Providus Bank", "Jaiz Bank",
    "Moniepoint", "Opay", "Palmpay", "Kuda", "VFD",
  ];
  for (const b of banks) {
    if (text.toLowerCase().includes(b.toLowerCase())) {
      bank = b; break;
    }
  }

  // Date — look for date patterns
  let date = null;
  const datePatterns = [
    /(\d{4}[-\/]\d{2}[-\/]\d{2})/,
    /(\d{2}[-\/]\d{2}[-\/]\d{4})/,
    /([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/,
    /(\d{1,2}\s+[A-Z][a-z]+\s+\d{4})/,
  ];
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      const d = new Date(match[1]);
      if (!isNaN(d.getTime())) {
        date = d.toISOString().slice(0, 10);
      } else {
        date = match[1];
      }
      break;
    }
  }

  return { refNo, amount, bank, date };
}