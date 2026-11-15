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
              text: `You are a fraud detection system analyzing a Nigerian bank payment receipt. Today's date is ${new Date().toISOString().slice(0,10)}.

Perform TWO tasks:

TASK 1 - Extract these fields. Return exact values as shown:
- refNo: the transaction reference, transaction number or transaction ID exactly as printed (keep letters, digits and symbols, no spaces). Do NOT put the Session ID here. If the receipt only shows a Session ID, use null.
- sessionId: the Session ID exactly as printed (digits only), or null if the receipt has no field labelled Session ID
- amount: numeric amount only (e.g. 8000)
- bank: the sending bank name (e.g. OPay, GTBank, First Bank)
- date: the date shown on the receipt in YYYY-MM-DD format
- accountNumber: the destination/recipient account number (the account money was sent TO). If it is partly hidden, copy it with the hidden digits as * (for example 903****981)
- recipientName: the name of the recipient/beneficiary
- senderName: the name of the sender
Copy long numbers digit by digit. If you cannot read every digit clearly, use null for that field instead of guessing.

TASK 2 - Image forensics. Receipts from different banking apps look very different. Different fonts, dotted separators, watermark patterns, rounded or scalloped edges and large amount text are all NORMAL. Screenshots of screenshots and photos of a screen are also normal. Only report suspicious if you see clear signs of editing, such as:
- A value in a different font, size, colour or sharpness from the matching values around it
- A visibly different or patchy background around one value
- Overlapping, duplicated or misaligned text inside one field
- Text that looks pasted over the original

IMPORTANT: Do NOT flag a date as suspicious just because it seems recent or you are uncertain about the current date. Today is ${new Date().toISOString().slice(0,10)} — only flag a date if there is a visual anomaly in the date field itself.

Return ONLY this JSON, no other text:
{
  "refNo": "transaction reference as printed, or null",
  "sessionId": "session ID digits, or null",
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

    // ── Step 2: Check the identifiers against the receipt date ─────────────
    // Only formats seen on real receipts are checked. Anything else is left alone.
    const flags = [];

    const sessionId = (extracted.sessionId || "").replace(/\s/g, "");
    const refNo     = (extracted.refNo     || "").replace(/\s/g, "");

    const idDateFlag = checkIdentifierDate([sessionId, refNo], extracted.date);
    if (idDateFlag) flags.push(idDateFlag);

    // ── Step 3: A receipt cannot be dated in the future ───────────────────
    const latestAllowed = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(extracted.date || "") && extracted.date > latestAllowed) {
      flags.push(`Receipt is dated in the future (${extracted.date})`);
    }

    // ── Step 4: Image forensics ────────────────────────────────────────────
    if (extracted.forensics?.suspicious) {
      flags.push(`Image anomaly detected: ${extracted.forensics.reason}`);
    }

    // ── Build result ───────────────────────────────────────────────────────
    const result = {
      // The 30-digit session ID is the same on every bank's receipt for one transfer, so it is the
      // best identifier for spotting a reused receipt. Fall back to the printed reference.
      refNo:         (/^\d{30}$/.test(sessionId) ? sessionId : (refNo || sessionId)) || null,
      sessionId:     sessionId || null,
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

// ── Identifier date check ─────────────────────────────────────────────────────
// Checked against real receipts (Moniepoint, GTBank, Access, First Bank):
//   NIP session ID  30 digits = 6-digit institution code + yymmddhhmmss + 12-digit sequence
//   First Bank      "UPF" + 3 digits + yymmddhhmmss + ...
//   Access          "NXG" + 6-digit institution code + yymmddhhmmss + ...
// OPay and PalmPay numbers do NOT carry the transaction date, so they are never date checked.
// An unfamiliar format is not suspicious; it is simply not checked.
const ID_RULES = [
  { name: "Session ID",               test: s => /^\d{30}$/.test(s),       from: 6 },
  { name: "First Bank reference",     test: s => /^UPF\d{3}\d{12}/.test(s), from: 6 },
  { name: "Access reference",         test: s => /^NXG\d{6}\d{12}/.test(s), from: 9 },
];

function stampToDate(stamp) {
  const yy = +stamp.slice(0, 2), mm = +stamp.slice(2, 4), dd = +stamp.slice(4, 6);
  const hh = +stamp.slice(6, 8), mi = +stamp.slice(8, 10), ss = +stamp.slice(10, 12);
  if (yy < 20 || yy > 45) return null;
  if (mm < 1 || mm > 12 || dd < 1 || hh > 23 || mi > 59 || ss > 59) return null;
  if (dd > new Date(Date.UTC(2000 + yy, mm, 0)).getUTCDate()) return null;
  return `20${stamp.slice(0, 2)}-${stamp.slice(2, 4)}-${stamp.slice(4, 6)}`;
}

function checkIdentifierDate(candidates, receiptDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(receiptDate || "")) return null;
  for (const raw of candidates) {
    const id = String(raw || "").replace(/\s/g, "").toUpperCase();
    const rule = ID_RULES.find(r => r.test(id));
    if (!rule) continue;

    const encoded = stampToDate(id.slice(rule.from, rule.from + 12));
    if (!encoded) {
      return `${rule.name} does not contain a valid date. It may have been misread or altered`;
    }
    const gapDays = Math.abs(Date.parse(encoded + "T12:00:00Z") - Date.parse(receiptDate + "T12:00:00Z")) / 86400000;
    if (gapDays > 1) {
      return `${rule.name} was issued on ${encoded} but the receipt shows ${receiptDate}`;
    }
    return null;   // matched a known format and the dates agree
  }
  return null;
}

module.exports.checkIdentifierDate = checkIdentifierDate;
