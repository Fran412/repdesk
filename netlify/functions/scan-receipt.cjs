exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const { imageBase64, mediaType } = JSON.parse(event.body);

    // ── Step 1: Extract receipt data + image forensics via Claude ──────────
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 800,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType || "image/jpeg", data: imageBase64 },
            },
            {
              type: "text",
              text: `You are a fraud detection system analyzing a Nigerian bank payment receipt.

Perform TWO tasks:

TASK 1 - Extract these fields. Return exact values as shown:
- refNo: the transaction or reference number (full string, no spaces)
- amount: numeric amount only (e.g. 8000)
- bank: the sending bank name (e.g. OPay, GTBank, First Bank)
- date: the date shown on the receipt in YYYY-MM-DD format
- accountNumber: the destination/recipient account number (the account money was sent TO)
- recipientName: the name of the recipient/beneficiary
- senderName: the name of the sender

TASK 2 - Image forensics. Examine the image carefully for:
- Inconsistent fonts or font sizes in the same field type
- Misaligned text or elements
- Unusual compression artifacts or pixelation around specific areas
- Signs that text has been overlaid or edited
- Inconsistent color or brightness in specific regions
- Any visual anomaly that suggests digital manipulation

Return ONLY this JSON, no other text:
{
  "refNo": "full reference number",
  "amount": 0,
  "bank": "bank name",
  "date": "YYYY-MM-DD",
  "accountNumber": "destination account number",
  "recipientName": "recipient name",
  "senderName": "sender name",
  "forensics": {
    "suspicious": false,
    "reason": "null or brief description of anomaly found"
  }
}`,
            },
          ],
        }],
      }),
    });

    const claudeData = await response.json();
    console.log("Claude response:", JSON.stringify(claudeData));

    if (!claudeData.content || !claudeData.content[0]) {
      return { statusCode: 500, body: JSON.stringify({ error: "No response from Claude" }) };
    }

    const text = claudeData.content[0].text.trim();
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return { statusCode: 500, body: JSON.stringify({ error: "Could not parse response" }) };
    }

    const extracted = JSON.parse(match[0]);
    console.log("Extracted:", JSON.stringify(extracted));

    // ── Step 2: Reference number date encoding check ───────────────────────
    const flags = [];

    if (extracted.refNo && extracted.date) {
      const refDateFlag = checkRefDateEncoding(extracted.refNo, extracted.date, extracted.bank);
      if (refDateFlag) flags.push(refDateFlag);
    }

    // ── Step 3: Internal consistency checks ───────────────────────────────
    // Check if date is in the future — add 2 day buffer for timezone differences
    if (extracted.date) {
      const receiptDate = new Date(extracted.date + "T12:00:00Z");
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const twoDaysFromNow = new Date(today);
      twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
      if (receiptDate > twoDaysFromNow) {
        flags.push("Receipt date is in the future");
      }
    }

    // ── Step 4: Image forensics ────────────────────────────────────────────
    if (extracted.forensics?.suspicious) {
      flags.push(`Image anomaly detected: ${extracted.forensics.reason}`);
    }

    // ── Build result ───────────────────────────────────────────────────────
    const result = {
      refNo:         extracted.refNo        || null,
      amount:        extracted.amount       || 0,
      bank:          extracted.bank         || null,
      date:          extracted.date         || null,
      accountNumber: extracted.accountNumber|| null,
      recipientName: extracted.recipientName|| null,
      senderName:    extracted.senderName   || null,
      fraudFlags:    flags,
      flagged:       flags.length > 0,
    };

    console.log("Result:", JSON.stringify(result));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    };

  } catch (err) {
    console.log("Error:", err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

// ── Reference number date encoding patterns ───────────────────────────────────
function checkRefDateEncoding(refNo, receiptDateStr, bank) {
  if (!refNo || !receiptDateStr) return null;

  const ref = refNo.replace(/\s/g, "").toUpperCase();
  // Parse as noon UTC to avoid timezone day-shift issues
  const receiptDate = new Date(receiptDateStr + "T12:00:00Z");
  if (isNaN(receiptDate.getTime())) return null;

  const year2  = String(receiptDate.getFullYear()).slice(2);  // "26"
  const month  = String(receiptDate.getMonth() + 1).padStart(2, "0"); // "08"
  const day    = String(receiptDate.getDate()).padStart(2, "0");       // "30"

  // Pattern: YYMMDD at position 0 (OPay, many fintechs)
  // e.g. ref starts with 260726 → July 26, 2026
  const refPrefix6 = ref.slice(0, 6);
  if (/^\d{6}$/.test(refPrefix6)) {
    const encodedYear  = refPrefix6.slice(0, 2);
    const encodedMonth = refPrefix6.slice(2, 4);
    const encodedDay   = refPrefix6.slice(4, 6);

    const monthValid = parseInt(encodedMonth) >= 1 && parseInt(encodedMonth) <= 12;
    const dayValid   = parseInt(encodedDay)   >= 1 && parseInt(encodedDay)   <= 31;

    if (monthValid && dayValid) {
      // Encoded date does not match receipt date
      if (encodedYear !== year2 || encodedMonth !== month || encodedDay !== day) {
        const encodedDateStr = `20${encodedYear}-${encodedMonth}-${encodedDay}`;
        return `Reference number encodes date ${encodedDateStr} but receipt shows ${receiptDateStr}`;
      }
    }
  }

  // Pattern: YYYYMMDD embedded anywhere in ref (GTBank, Access)
  const fullDatePattern = `${receiptDate.getFullYear()}${month}${day}`;
  const altDatePattern  = `${year2}${month}${day}`;

  // Check if ref contains ANY 6-digit date-like sequence that conflicts
  const dateMatches = ref.match(/\d{6}/g);
  if (dateMatches) {
    for (const seg of dateMatches) {
      const y = seg.slice(0, 2);
      const m = seg.slice(2, 4);
      const d = seg.slice(4, 6);
      const mNum = parseInt(m);
      const dNum = parseInt(d);
      if (mNum >= 1 && mNum <= 12 && dNum >= 1 && dNum <= 31) {
        // This looks like a date — check if it conflicts
        if (y !== year2 || m !== month || d !== day) {
          // Only flag if it's a significantly different date (more than 3 days off)
          const encodedDate = new Date(`20${y}-${m}-${d}`);
          if (!isNaN(encodedDate.getTime())) {
            const diffDays = Math.abs((encodedDate - receiptDate) / (1000 * 60 * 60 * 24));
            if (diffDays > 3) {
              return `Reference number suggests date 20${y}-${m}-${d} but receipt shows ${receiptDateStr}`;
            }
          }
        }
        break; // Only check first date-like sequence
      }
    }
  }

  return null;
}
