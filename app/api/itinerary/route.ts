import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

// ---------- Types ----------
type Food = { breakfast: string; lunch: string; dinner: string };
type Day = {
  date: string;
  city: string;
  area?: string;
  morning: string;
  afternoon: string;
  evening: string;
  transit?: string;
  food: Food;
};
type AiItinerary = { days: Day[] };

type ChoiceMsg = { message?: { content?: string } };
type OutputChunk = { content?: Array<{ text?: string }> };
type ResponseLike = {
  output_text?: string;
  choices?: ChoiceMsg[];
  output?: OutputChunk[];
};

// ---------- OpenAI client ----------
function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
  return new OpenAI({ apiKey });
}

function getText(res: unknown): string {
  const r = res as ResponseLike | undefined;
  return (
    r?.output_text ??
    r?.output?.[0]?.content?.[0]?.text ??
    r?.choices?.[0]?.message?.content ??
    "{}"
  );
}

// ---------- GET: quick sanity (/api/itinerary?city=Paris) ----------
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const city = url.searchParams.get("city");
    if (!city) return NextResponse.json({ error: "Missing ?city=" }, { status: 400 });

    const client = getClient();
    const r = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'Return ONLY JSON: {"days":[{"date":"YYYY-MM-DD","city":"string","area":"string","morning":"...","afternoon":"...","evening":"...","transit":"...","food":{"breakfast":"...","lunch":"...","dinner":"..."}}]}',
        },
        {
          role: "user",
          content: `Make 1–3 short days for ${city}. Keep it practical & affordable.`,
        },
      ],
      temperature: 0.7,
    });

    const json = JSON.parse(getText(r)) as AiItinerary;
    return NextResponse.json(json, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ---------- POST: main app flow ----------
type StaySumm = { city: string; nights: number };
type PlanInput = {
  chosen?: { depart?: string; return?: string };
  route?: string[];
  stays?: StaySumm[];
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { plan?: PlanInput };
    const plan = body?.plan ?? {};

    const route = Array.isArray(plan.route) && plan.route.length ? plan.route.join(" → ") : "";
    const nights = Array.isArray(plan.stays)
      ? plan.stays.map((s) => `${s.city}:${s.nights}`).join(", ")
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
Window: ${plan.chosen?.depart ?? "?"} → ${plan.chosen?.return ?? "?"}
Route: ${route}
Nights per city: ${nights}
`.trim();

    const client = getClient();
    const r = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: sys },
        { role: "user", content: usr },
      ],
      temperature: 0.7,
    });

    const txt = getText(r);
    const json = JSON.parse(txt) as AiItinerary;
    if (!Array.isArray(json?.days)) throw new Error("Bad AI JSON (no days)");
    return NextResponse.json(json, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
