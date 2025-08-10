import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

// -------- OpenAI client --------
function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
  return new OpenAI({ apiKey });
}

// -------- Helpers --------
function getText(res: any): string {
  return (
    res?.output_text ??
    res?.output?.[0]?.content?.[0]?.text ??
    res?.choices?.[0]?.message?.content ??
    "{}"
  );
}

// -------- Single JSON Schema (only declare once!) --------
const ITINERARY_SCHEMA = {
  type: "object",
  properties: {
    days: {
      type: "array",
      items: {
        type: "object",
        properties: {
          date: { type: "string" },          // YYYY-MM-DD
          city: { type: "string" },
          area: { type: "string" },
          morning: { type: "string" },
          afternoon: { type: "string" },
          evening: { type: "string" },
          transit: { type: "string" },
          food: {
            type: "object",
            properties: {
              breakfast: { type: "string" },
              lunch: { type: "string" },
              dinner: { type: "string" },
            },
            required: ["breakfast", "lunch", "dinner"],
            additionalProperties: false,
          },
        },
        required: ["date", "city", "morning", "afternoon", "evening"],
        additionalProperties: false,
      },
    },
  },
  required: ["days"],
  additionalProperties: false,
} as const;

// -------- GET: quick browser test (/api/itinerary?city=Paris) --------
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const city = url.searchParams.get("city");
    if (!city) return NextResponse.json({ error: "Missing ?city=" }, { status: 400 });

    const client = getClient();
    const r = await client.responses.create({
        model: "gpt-4o-mini",
        input: prompt,
        text: {
            format: {
            type: "json_schema",
            name: "TripItinerary",        // required
            schema: ITINERARY_SCHEMA,     // ✅ schema goes here (not nested)
            strict: true,                 // enforce exact shape
            },
        },
    });


    const json = JSON.parse(getText(r));
    return NextResponse.json(json, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

// -------- POST: main app flow (schema-validated JSON) --------
export async function POST(req: Request) {
  try {
    const { plan } = await req.json();

    const route =
      Array.isArray(plan?.route) && plan.route.length ? plan.route.join(" → ") : "";
    const nights =
      Array.isArray(plan?.stays) && plan.stays.length
        ? plan.stays.map((s: any) => `${s.city}:${s.nights}`).join(", ")
        : "";

    const sys = `
You are a concise travel planner. Return ONLY valid JSON matching:
{
  "days": [
    {
      "date": "YYYY-MM-DD",
      "city": "string",
      "area": "string",
      "morning": "5–18 words",
      "afternoon": "5–18 words",
      "evening": "5–18 words",
      "transit": "simple tip",
      "food": {
        "breakfast": "local spot",
        "lunch": "local spot",
        "dinner": "local spot"
      }
    }
  ]
}
No extra keys. Keep phrasing practical and affordable.
    `.trim();

    const usr = `
Window: ${plan?.chosen?.depart} → ${plan?.chosen?.return}
Route: ${route}
Nights per city: ${nights}
    `.trim();

    // Use Chat Completions with JSON mode (stable)
    const client = new (require("openai")).default({ apiKey: process.env.OPENAI_API_KEY });
    const r = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: sys },
        { role: "user", content: usr },
      ],
      temperature: 0.7,
    });

    const txt = r.choices?.[0]?.message?.content || "{}";
    const json = JSON.parse(txt);
    if (!Array.isArray(json?.days)) throw new Error("Bad AI JSON (no days)");
    return NextResponse.json(json, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

