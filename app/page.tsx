"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, Calendar, Euro, ChevronRight, Plus, Trash2, MapPin, Settings2, Menu, BarChart2, LineChart, Rocket, X, ArrowUpRight, Compass } from "lucide-react";
import { PieChart, Pie, Tooltip as RTooltip, ResponsiveContainer, Legend, Cell } from "recharts";

/* ========= Types ========= */
type CurrencyCode = string;

type IdeaItem = { when: string; title: string; price?: number };
type IdeasForCity = { city: string; tags: string[]; items: IdeaItem[] };

type StayHotel = { name: string; pricePerNight: number };
type Stay = { city: string; nights: number; pricePerNight: number; total: number; hotels: StayHotel[] };

type Leg = { from: string; to: string; price: number; date: string };

type Summary = { flights: number; accommodation: number; food: number; activities: number };

type Plan = {
  legs: Leg[];
  stays: Stay[];
  summary: Summary;
  earliestDeparture: string;
  latestReturn: string;
  days: number;
  total: number;
  underBudget: boolean;
  savings: number;
  ideas: IdeasForCity[];
  chosen: { depart: string; return: string };
  prefs: { stopovers: number; allowHostels: boolean };
  route: string[];
};

/* ========= Utils ========= */
const currency = (n: number, cur: CurrencyCode = "EUR"): string =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: cur,
    maximumFractionDigits: 0,
  }).format(n);

const rand = (min: number, max: number): number =>
  Math.round(Math.random() * (max - min) + min);

const norm = (s: string): string => s.toLowerCase();

const lev = (a: string, b: string): number => {
  a = norm(a);
  b = norm(b);
  const m = a.length,
    n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
};

const DESTS: string[] = [
  "Barcelona (BCN)",
  "Paris (CDG)",
  "Lisbon (LIS)",
  "Berlin (BER)",
  "Rome (FCO)",
  "London (LHR)",
  "Madrid (MAD)",
  "Amsterdam (AMS)",
  "Milan (MXP)",
  "Vienna (VIE)",
  "Prague (PRG)",
  "Copenhagen (CPH)",
];

// City-specific ideas (demo)
const CITY_IDEAS: Record<string, IdeaItem[]> = {
  paris: [
    { when: "Morning", title: "Louvre Museum", price: 17 },
    { when: "Afternoon", title: "Seine river walk & Île de la Cité", price: 0 },
    { when: "Golden hour", title: "Eiffel Tower • Trocadéro viewpoint", price: 0 },
    { when: "Evening", title: "Montmartre bistro crawl", price: 20 },
  ],
  barcelona: [
    { when: "Morning", title: "Sagrada Família (outside + park)", price: 0 },
    { when: "Afternoon", title: "Gothic Quarter + La Boqueria tasting", price: 12 },
    { when: "Golden hour", title: "Bunkers del Carmel viewpoint", price: 0 },
    { when: "Evening", title: "Tapas in El Born", price: 18 },
  ],
  lisbon: [
    { when: "Morning", title: "Belém monuments & pastéis", price: 5 },
    { when: "Afternoon", title: "Alfama tram + miradouros", price: 3 },
    { when: "Golden hour", title: "Miradouro da Senhora do Monte", price: 0 },
    { when: "Evening", title: "Time Out Market food tour", price: 20 },
  ],
  rome: [
    { when: "Morning", title: "Colosseum (outside) & Forum walk", price: 0 },
    { when: "Afternoon", title: "Pantheon & Trevi Fountain", price: 0 },
    { when: "Golden hour", title: "Trastevere riverside", price: 0 },
    { when: "Evening", title: "Pizza al taglio tasting", price: 10 },
  ],
  berlin: [
    { when: "Morning", title: "Museum Island stroll", price: 0 },
    { when: "Afternoon", title: "East Side Gallery walk", price: 0 },
    { when: "Golden hour", title: "Tempelhofer Feld picnic", price: 0 },
    { when: "Evening", title: "Kreuzberg street food", price: 15 },
  ],
};

function pickBestDates(earliestDeparture: string, latestReturn: string, days: number): { depart: string; return: string } {
  if (!earliestDeparture || !latestReturn || !days)
    return { depart: "", return: "" };
  const start = new Date(earliestDeparture);
  const end = new Date(latestReturn);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start)
    return { depart: earliestDeparture, return: latestReturn };
  let best: { depart: string; return: string; score: number } = { depart: earliestDeparture, return: latestReturn, score: Infinity };
  const msDay = 24 * 60 * 60 * 1000;
  for (
    let d = new Date(start);
    d <= new Date(end.getTime() - (days - 1) * msDay);
    d = new Date(d.getTime() + msDay)
  ) {
    const ret = new Date(d.getTime() + (days - 1) * msDay);
    const weekdayDepart = d.getDay();
    const weekdayReturn = ret.getDay();
    let score = 100;
    if (weekdayDepart === 2 || weekdayDepart === 3) score -= 15;
    if (weekdayDepart === 5) score += 10;
    if (weekdayReturn === 0) score += 8;
    score += Math.abs(Math.sin(d.getTime() / 4e8)) * 10;
    if (score < best.score)
      best = {
        depart: d.toISOString().slice(0, 10),
        return: ret.toISOString().slice(0, 10),
        score,
      };
  }
  return { depart: best.depart, return: best.return };
}

function estimateTrip(
  from: string,
  tos: string[],
  latestReturn: string,
  earliestDeparture: string,
  days: number,
  budget: number,
  prefs: { stopovers: number; allowHostels: boolean }
): Plan {
  const { stopovers, allowHostels } = prefs;
  const { depart, return: ret } = pickBestDates(
    earliestDeparture,
    latestReturn,
    days
  );
  const stopoverFactor =
    stopovers === 0 ? 1.15 : stopovers === 1 ? 1.0 : stopovers === 2 ? 0.93 : 0.88;

  // estimate nightly prices per city and sort by cheapest
  const estimateNightly = (cityName: string): number => {
    const base = budget < 400 ? rand(25, 60) : rand(60, 140);
    return allowHostels ? Math.max(18, Math.round(base * 0.85)) : base;
  };
  const cityInfos = tos.map((city) => ({ city, nightly: estimateNightly(city.split(" (")[0]) }));
  cityInfos.sort((a, b) => a.nightly - b.nightly);
  const sortedTos = cityInfos.map((c) => c.city);

  // allocate nights biased toward cheaper cities
  const weights = cityInfos.map((c) => 1 / Math.max(1, c.nightly));
  const sumW = weights.reduce((s, w) => s + w, 0);
  let nights = cityInfos.map(() => 1); // at least 1 night each
  const remaining = Math.max(days - nights.length, 0);
  const quotas = weights.map((w) => (w / sumW) * remaining);
  const baseAdds = quotas.map((q) => Math.floor(q));
  const fracs = quotas.map((q, i) => ({ i, frac: q - baseAdds[i] }));
  nights = nights.map((n, i) => n + baseAdds[i]);
  let leftover = remaining - baseAdds.reduce((s, v) => s + v, 0);
  fracs.sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < fracs.length && leftover > 0; k++, leftover--) {
    nights[fracs[k].i] += 1;
  }

  // flights
  const legs: Leg[] = [];
  let runningFrom = from.trim();
  sortedTos.forEach((to) => {
    const dateFactor =
      new Date(depart).getDay() === 2 || new Date(depart).getDay() === 3 ? 0.9 : 1.0;
    const price = Math.round(
      (rand(60, 220) + Math.max(0, sortedTos.length - 1) * 15) *
        dateFactor *
        stopoverFactor
    );
    legs.push({ from: runningFrom, to, price, date: depart });
    runningFrom = to;
  });
  const returnPrice = Math.round(
    rand(60, 220) * (new Date(ret).getDay() === 0 ? 1.1 : 1.0) * stopoverFactor
  );
  legs.push({ from: runningFrom, to: from, price: returnPrice, date: ret });

  // stays (inlined cityName to avoid unused var warning)
  const stays: Stay[] = cityInfos.map((info, i) => {
    const city = info.city;
    const pricePerNight = info.nightly;
    const total = pricePerNight * nights[i];
    const hotels: StayHotel[] = (allowHostels
      ? [
          { name: `${city.split(" (")[0]} City Hostel`, pricePerNight: Math.max(18, Math.round(pricePerNight * 0.9)) },
          { name: `${city.split(" (")[0]} Central Inn`, pricePerNight },
        ]
      : [
          { name: `${city.split(" (")[0]} Boutique Hotel`, pricePerNight: pricePerNight + 25 },
          { name: `${city.split(" (")[0]} Central Inn`, pricePerNight },
        ]) as StayHotel[];
    return { city, nights: nights[i], pricePerNight, total, hotels };
  });

  const flightsTotal = legs.reduce((s, l) => s + l.price, 0);
  const accomTotal = stays.reduce((s, h) => s + h.total, 0);
  const food = Math.round(days * (budget < 500 ? 18 : 28));
  const fun = Math.round(days * 15);

  let total = flightsTotal + accomTotal + food + fun;
  const scale = budget > 0 ? Math.min(1, budget / Math.max(total, 1)) : 1;
  const summary: Summary = {
    flights: Math.round(flightsTotal * scale),
    accommodation: Math.round(accomTotal * scale),
    food: Math.round(food * scale),
    activities: Math.round(fun * scale),
  };
  total = summary.flights + summary.accommodation + summary.food + summary.activities;

  const ideas: IdeasForCity[] = sortedTos.map((t) => {
    const cityKey = t.split(" (")[0].toLowerCase();
    const base: IdeaItem[] =
      CITY_IDEAS[cityKey] || [
        { when: "Morning", title: "Historic center stroll", price: 0 },
        { when: "Afternoon", title: "Local market tasting", price: 12 },
        { when: "Golden hour", title: "Best viewpoint walk", price: 0 },
        { when: "Evening", title: "Neighborhood food crawl", price: 18 },
      ];
    return { city: t, tags: ["views", "food", "culture"], items: base };
  });

  return {
    legs,
    stays,
    summary,
    earliestDeparture,
    latestReturn,
    days,
    total,
    underBudget: total <= budget,
    savings: Math.max(0, budget - total),
    ideas,
    chosen: { depart, return: ret },
    prefs,
    route: sortedTos,
  };
}

// ---------- Lightweight tests (runtime assertions) ----------
function __runTests() {
  // Test 1
  const t = pickBestDates("2025-08-10", "2025-08-20", 5);
  console.assert(
    t.depart >= "2025-08-10" && t.return <= "2025-08-20",
    "pickBestDates must choose within the window"
  );

  // Test 2
  const e = estimateTrip(
    "Lisbon (LIS)",
    ["Paris (CDG)", "Berlin (BER)", "Rome (FCO)"],
    "2025-08-20",
    "2025-08-10",
    7,
    700,
    { stopovers: 2, allowHostels: true }
  );
  console.assert(
    e.legs.length === 4,
    `expected 4 legs (3 cities + return), got ${e.legs.length}`
  );

  // Test 3 (typed map instead of any)
  const nightlyByCity: Record<string, number> = Object.fromEntries(
    e.stays.map((s) => [s.city, s.pricePerNight])
  ) as Record<string, number>;
  const isNonDecreasing = e.route.every(
    (c, i, arr) => i === 0 || nightlyByCity[arr[i - 1]] <= nightlyByCity[c]
  );
  console.assert(isNonDecreasing, "route not sorted by cheapest nightly rate");

  // Test 4
  const nightsSum = e.stays.reduce((sum, s) => sum + s.nights, 0);
  const allAtLeastOne = e.stays.every((s) => s.nights >= 1);
  console.assert(
    nightsSum === 7 && allAtLeastOne,
    `night allocation invalid: sum=${nightsSum}, all>=1=${allAtLeastOne}`
  );
}

// ---------- Page Component ----------
export default function GeniusTripApp() {
  const [menuOpen, setMenuOpen] = useState(false);

  // Planner state
  const [from, setFrom] = useState("Lisbon (LIS)");
  const [toInput, setToInput] = useState("");
  const [tos, setTos] = useState<string[]>(["Paris (CDG)"]);
  const [latestReturn, setLatestReturn] = useState("");
  const [earliestDeparture, setEarliestDeparture] = useState("");
  const [days, setDays] = useState(5);
  const [budget, setBudget] = useState(800);
  const [stopovers, setStopovers] = useState(1); // 0,1,2,3(3+)
  const [allowHostels, setAllowHostels] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Plan | null>(null);
  const [faqOpen, setFaqOpen] = useState(0);

  useEffect(() => {
    console.assert(typeof menuOpen === "boolean", "menuOpen should be boolean");
  }, [menuOpen]);

  useEffect(() => {
    __runTests();
  }, []);

  const suggestions = useMemo(() => {
    const q = toInput.trim();
    if (!q) return [] as string[];
    const lc = norm(q);
    const substr = DESTS.filter((d) => norm(d).includes(lc) && !tos.includes(d));
    if (substr.length) return substr.slice(0, 8);
    return DESTS
      .map((d) => ({ d, s: lev(q, d) }))
      .sort((a, b) => a.s - b.s)
      .map((x) => x.d)
      .filter((d) => !tos.includes(d))
      .slice(0, 6);
  }, [toInput, tos]);

  const canSearch = from && tos.length > 0 && days > 0 && budget > 0;

  const chartData = useMemo(() => {
    if (!result) return [] as { name: string; value: number; color: string }[];
    return [
      { name: "Flights", value: result.summary.flights, color: "#2563EB" },
      { name: "Accommodation", value: result.summary.accommodation, color: "#14B8A6" },
      { name: "Food", value: result.summary.food, color: "#F59E0B" },
      { name: "Activities", value: result.summary.activities, color: "#8B5CF6" },
    ];
  }, [result]);

  const handleAddTo = (t?: string) => {
    let value = t || toInput.trim();
    if (!value) return;
    if (suggestions.length) value = suggestions[0];
    if (tos.includes(value)) return;
    setTos((prev) => [...prev, value]);
    setToInput("");
  };

  const handleRemoveTo = (t: string) => setTos((prev) => prev.filter((x) => x !== t));

  const handleSearch = async () => {
    if (!canSearch) return;
    setLoading(true);
    setTimeout(() => {
      const plan = estimateTrip(
        from,
        tos,
        latestReturn,
        earliestDeparture,
        days,
        budget,
        { stopovers, allowHostels }
      );
      setResult(plan);
      setLoading(false);
      const el = document.getElementById("plan");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 700);
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-[linear-gradient(180deg,rgba(219,234,254,.7),#fff_20%)]">
        {/* ---------- Header (pill style) ---------- */}
        <header className="sticky top-0 z-40 backdrop-blur bg-transparent">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between rounded-full border bg-white/90 shadow-sm px-3 py-2">
              <a href="#" className="flex items-center gap-2 px-2 py-1 rounded-full hover:bg-slate-50">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-tr from-blue-400 to-indigo-500">
                  <Compass className="h-4 w-4 text-white" />
                </span>
                <span className="font-semibold text-slate-900">GeniusTripAI</span>
              </a>
              <nav className="hidden md:flex items-center gap-6 text-sm">
                <a href="#plan" className="text-slate-600 hover:text-slate-900">
                  Plan
                </a>
                <a href="#how" className="text-slate-600 hover:text-slate-900">
                  How it Works
                </a>
                <a href="#reviews" className="text-slate-600 hover:text-slate-900">
                  Reviews
                </a>
                <a href="#faq" className="text-slate-600 hover:text-slate-900">
                  FAQ
                </a>
              </nav>
              <div className="flex items-center gap-2">
                <a
                  href="#plan"
                  className="hidden md:inline-flex items-center gap-2 rounded-full bg-black text-white px-4 py-2 text-sm hover:bg-slate-900"
                >
                  <ArrowUpRight className="h-4 w-4" /> Get Plan
                </a>
                <button
                  className="md:hidden inline-flex items-center justify-center rounded-full border px-3 py-2"
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-label="Menu"
                  aria-expanded={menuOpen}
                >
                  <Menu className="h-5 w-5 text-slate-700" />
                </button>
              </div>
            </div>
            {menuOpen && (
              <div className="md:hidden mt-2 rounded-2xl border bg-white shadow-sm">
                <div className="px-4 py-3 grid gap-2 text-sm">
                  <a href="#plan" onClick={() => setMenuOpen(false)} className="py-1">
                    Plan
                  </a>
                  <a href="#how" onClick={() => setMenuOpen(false)} className="py-1">
                    How it Works
                  </a>
                  <a href="#reviews" onClick={() => setMenuOpen(false)} className="py-1">
                    Reviews
                  </a>
                  <a href="#faq" onClick={() => setMenuOpen(false)} className="py-1">
                    FAQ
                  </a>
                  <a
                    href="#plan"
                    onClick={() => setMenuOpen(false)}
                    className="mt-1 inline-flex items-center gap-2 rounded-full bg-black text-white px-4 py-2"
                  >
                    <ArrowUpRight className="h-4 w-4" /> Get Plan
                  </a>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* ---------- Hero ---------- */}
        <section className="bg-[linear-gradient(180deg,rgba(219,234,254,1),rgba(219,234,254,.4))] border-b">
          <div className="max-w-6xl mx-auto px-4 py-10 text-center">
            <div className="text-xs font-semibold tracking-wide text-blue-700/80">
              PLAN SMARTER. TRAVEL CHEAPER
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 mt-2">
              Plan smarter. Fly cheaper. Sleep better.
            </h1>
            <p className="text-slate-600 max-w-2xl mx-auto mt-2">
              Enter origin, destinations, a travel window and budget. We’ll pick
              dates and build a price-clear plan.
            </p>
          </div>
        </section>

        {/* ---------- Planner + Plan ---------- */}
        <main id="plan" className="max-w-6xl mx-auto px-4 py-10 grid gap-6 md:grid-cols-2">
          {/* Planner */}
          <Card className="shadow-sm rounded-2xl">
            <CardHeader>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-blue-600" /> Plan your trip
              </h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>From</Label>
                <Input
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  placeholder="e.g. Lisbon (LIS)"
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label>To (multiple)</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge className="bg-blue-50 text-blue-700 border border-blue-200">
                        Typo-safe
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      We auto-correct to the closest city/airport.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={toInput}
                    onChange={(e) => setToInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddTo();
                      }
                    }}
                    placeholder="Start typing… e.g. Barc…"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => handleAddTo()}
                    className="rounded-full"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
                {suggestions.length > 0 && (
                  <div className="bg-white border rounded-xl mt-1 shadow-sm overflow-hidden">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        className="px-3 py-2 text-left w-full hover:bg-blue-50"
                        onClick={() => handleAddTo(s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-2 mt-2">
                  {tos.map((t) => (
                    <Badge
                      key={t}
                      className="gap-1 bg-blue-600 text-white hover:bg-blue-700 rounded-full"
                    >
                      <MapPin className="h-3 w-3" /> {t}
                      <Trash2
                        onClick={() => handleRemoveTo(t)}
                        className="h-3 w-3 cursor-pointer"
                      />
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Dates */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Earliest departure</Label>
                  <Input
                    type="date"
                    value={earliestDeparture}
                    onChange={(e) => setEarliestDeparture(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Latest return</Label>
                  <Input
                    type="date"
                    value={latestReturn}
                    onChange={(e) => setLatestReturn(e.target.value)}
                  />
                </div>
              </div>

              {/* Numbers */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Trip days</Label>
                  <Input
                    type="number"
                    min={1}
                    max={45}
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label>Budget (EUR)</Label>
                  <div className="relative">
                    <Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      type="number"
                      min={100}
                      step={50}
                      className="pl-9"
                      value={budget}
                      onChange={(e) => setBudget(Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>

              {/* Stopovers segmented control */}
              <div>
                <Label>Max stopovers</Label>
                <div className="mt-1 inline-flex rounded-full border bg-white p-1 text-sm">
                  {[
                    { k: 0, l: "None" },
                    { k: 1, l: "1" },
                    { k: 2, l: "2" },
                    { k: 3, l: "3+" },
                  ].map(({ k, l }) => (
                    <button
                      key={k}
                      onClick={() => setStopovers(k)}
                      className={`px-3 py-1.5 rounded-full ${
                        stopovers === k
                          ? "bg-blue-600 text-white"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hostels toggle */}
              <div className="flex items-center gap-3">
                <input
                  id="hostels"
                  type="checkbox"
                  checked={allowHostels}
                  onChange={(e) => setAllowHostels(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <Label htmlFor="hostels" className="!m-0">
                  Accommodation can include hostels
                </Label>
              </div>

              <Button
                onClick={handleSearch}
                disabled={!canSearch || loading}
                className="w-full bg-blue-600 hover:bg-blue-700 rounded-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1" /> Finding best dates &
                    plan…
                  </>
                ) : (
                  <>
                    Generate plan <ChevronRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Plan */}
          <Card className="shadow-sm rounded-2xl">
            <CardHeader>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" /> Price plan & itinerary
              </h2>
            </CardHeader>
            <CardContent>
              {loading && (
                <div className="py-8 text-center text-slate-500">
                  <Loader2 className="animate-spin inline h-5 w-5 mr-2" /> Calculating...
                </div>
              )}
              {!loading && !result && (
                <p className="text-slate-500 text-sm">
                  Enter your details to generate a plan.
                </p>
              )}
              {!loading && result && (
                <div className="space-y-6">
                  <div className="p-4 rounded-xl border bg-blue-50/60 border-blue-100">
                    <div className="text-sm font-semibold">
                      Total: {currency(result.total)}{" "}
                      {result.underBudget
                        ? `(${currency(result.savings)} under budget)`
                        : `(over by ${currency(Math.abs(result.savings))})`}
                    </div>
                    <div className="text-xs text-slate-600 mt-1">
                      Best dates: <strong>{result.chosen.depart || "?"}</strong> → <strong>{result.chosen.return || "?"}</strong> · Days: <strong>{result.days}</strong> · Route optimized for price: <strong>{result.route?.join(" → ")}</strong> · Stops pref: <strong>{result.prefs.stopovers===0? 'non-stop' : result.prefs.stopovers===3? '3+': result.prefs.stopovers}</strong> · Hostels: <strong>{result.prefs.allowHostels? 'allowed':'no hostels'}</strong>.
                    </div>
                    <Separator className="my-2" />
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie dataKey="value" data={chartData} cx="50%" cy="50%" outerRadius={80} label>
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RTooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-semibold">Flights</div>
                    {result.legs.map((leg, i) => (
                      <div key={i} className="flex justify-between bg-white border rounded-xl px-3 py-2 text-sm">
                        <span>
                          {leg.from} → {leg.to}{" "}
                          <span className="text-xs text-slate-500">({leg.date})</span>
                        </span>
                        <span className="font-semibold">{currency(leg.price)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-semibold">Accommodation</div>
                    {result.stays.map((s, i) => (
                      <div key={i} className="bg-white border rounded-xl p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{s.city}</div>
                          <div className="font-semibold">{currency(s.total)}</div>
                        </div>
                        <div className="text-xs text-slate-500 mb-2">
                          {s.nights} night{s.nights > 1 ? "s" : ""} × {currency(s.pricePerNight)}/night
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {s.hotels.map((h, j) => (
                            <Badge key={j} className="bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
                              {h.name} • {currency(h.pricePerNight)}/night
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <div className="text-sm font-semibold">Ideas for things to do</div>
                    {result.ideas.map((c, i) => (
                      <div key={i} className="bg-white border rounded-xl p-3">
                        <div className="flex items-center justify-between mb-1">
                          <div className="font-medium">{c.city}</div>
                          <div className="flex gap-2">
                            {c.tags.map((t, k) => (
                              <Badge key={k} className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                                {t}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-2 text-sm text-slate-700">
                          {c.items.map((it, j) => (
                            <div key={j} className="flex items-center justify-between bg-slate-50 border rounded-xl px-3 py-2">
                              <span>
                                <span className="text-xs text-slate-500 mr-2">{it.when}</span>
                                {it.title}
                              </span>
                              <span className="text-xs font-medium text-slate-600">
                                {it.price ? `~${currency(it.price)}` : "Free"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </main>

        {/* ---------- HOW IT WORKS ---------- */}
        <section id="how" className="bg-[linear-gradient(180deg,#fff,rgba(219,234,254,.5))] border-y">
          <div className="max-w-6xl mx-auto px-4 py-12">
            <div className="text-xs font-semibold tracking-wide text-blue-700/80">
              PLAN SMARTER. TRAVEL CHEAPER
            </div>
            <h3 className="text-3xl font-black tracking-tight mt-2">
              How GeniusTripAI Works
            </h3>
            <p className="text-slate-600 mt-2 max-w-2xl">
              GeniusTripAI uses smart AI to turn your preferences into a complete
              travel plan — optimized for your time, budget, and vibe.
            </p>
            <div className="mt-6 rounded-2xl border bg-white shadow-sm">
              <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x">
                <div className="p-6 flex gap-3">
                  <div className="h-10 w-10 rounded-full bg-slate-900 text-white grid place-items-center">
                    <LineChart className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold">Tell Us Where You Want to Go</div>
                    <p className="text-sm text-slate-600 mt-1">
                      Pick cities, days, and your free window. We’ll take care of the
                      rest.
                    </p>
                  </div>
                </div>
                <div className="p-6 flex gap-3">
                  <div className="h-10 w-10 rounded-full bg-slate-900 text-white grid place-items-center">
                    <BarChart2 className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold">Let AI Build the Smartest Plan</div>
                    <p className="text-sm text-slate-600 mt-1">
                      We compare options — flights, stays, food & fun — to craft an
                      affordable, personalized itinerary.
                    </p>
                  </div>
                </div>
                <div className="p-6 flex gap-3">
                  <div className="h-10 w-10 rounded-full bg-slate-900 text-white grid place-items-center">
                    <Rocket className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold">Book It in One Click</div>
                    <p className="text-sm text-slate-600 mt-1">
                      Get a full plan with direct booking links*. No more 15 tabs.
                      (*coming soon)
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-2 text-xs">
              {[
                "Automatic Adjustments",
                "Real-Time Reports",
                "Secure Transactions",
                "Dedicated Support",
                "Instant Savings",
                "Flexible Payments",
                "Smart Spending",
                "Customizable Plans",
              ].map((t) => (
                <span key={t} className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 border">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Reviews ---------- */}
        <section id="reviews" className="bg-[linear-gradient(180deg,rgba(219,234,254,.35),#fff_40%)] border-y">
          <div className="max-w-6xl mx-auto px-4 py-12">
            <div className="text-xs font-semibold tracking-wide text-blue-700/80 flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[10px]">
                ★
              </span>
              REVIEWS
            </div>
            <h3 className="text-3xl font-black tracking-tight mt-2">Our Valued Clients</h3>
            <p className="text-slate-600 mt-1">
              We’re here to help you make the right decision. Explore what travellers say about GeniusTripAI.
            </p>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 md:grid-cols-3">
              {[
                { name: "Brendan", role: "owner of Goog", text: "A fantastic tool! It saved us time and money beyond expectations.", avatar: "B" },
                { name: "jacychan", role: "owner of Breit", text: "Simply exceptional! Fast, efficient, and packed with the essentials.", avatar: "J" },
                { name: "gaat", role: "owner of Pidio", text: "Great experience! The insights provided are incredibly helpful.", avatar: "G" },
                { name: "Wilson", role: "owner of Talik", text: "An absolute must-have! Intuitive features and real-time insights.", avatar: "W" },
                { name: "jamesli", role: "owner of Candto", text: "An amazing platform! It streamlined our workflow effortlessly.", avatar: "J" },
                { name: "anna", role: "owner of Hanko", text: "A true game-changer! Powerful features and seamless UX.", avatar: "A" },
                { name: "maya", role: "owner of Janio", text: "Incredible tool! Saved time and resources while improving efficiency.", avatar: "M" },
                { name: "shallot", role: "owner of Tanko", text: "A game changer! Optimized our process and delivered great value.", avatar: "S" },
                { name: "sofia", role: "frequent flyer", text: "City-aware suggestions were on point and many were free!", avatar: "S" },
              ].map((r, idx) => (
                <div key={idx} className="rounded-2xl border bg-white p-5 shadow-sm relative">
                  <div className="absolute right-3 top-3 text-slate-300">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                      <path d="M7.17 6a4.17 4.17 0 0 0-4.17 4.17V18h6.25v-7.5H5.83A1.66 1.66 0 0 1 7.5 8.83h.84V6H7.17Zm9.66 0A4.17 4.17 0 0 0 12.66 10.17V18h6.25v-7.5h-3.42a1.66 1.66 0 0 1 1.67-1.67h.83V6h-1.25Z" />
                    </svg>
                  </div>
                  <div className="flex gap-1 mb-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <svg key={i} viewBox="0 0 20 20" className="h-4 w-4 fill-yellow-500">
                        <path d="M10 15l-5.878 3.09L5.64 12.18 1 8.41l6.06-.88L10 2l2.94 5.53 6.06.88-4.64 3.77 1.518 5.91z" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-slate-800 italic">&ldquo;{r.text}&rdquo;</p>
                  <div className="mt-4 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-blue-100 grid place-items-center text-blue-700 text-sm font-semibold">
                      {r.avatar}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-900">{r.name}</div>
                      <div className="text-xs text-slate-500">{r.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- FAQ (new design) ---------- */}
        <section id="faq" className="bg-[linear-gradient(180deg,rgba(219,234,254,.35),#fff_40%)] border-y">
          <div className="max-w-6xl mx-auto px-4 py-12">
            <div className="text-xs font-semibold tracking-wide text-blue-700/80 flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[10px]">?</span>
              FAQs
            </div>
            <h3 className="text-3xl font-black tracking-tight mt-2">Got a quick question?</h3>
            <p className="text-slate-600">
              We&rsquo;re here to help you make the right decision. Explore our frequently asked questions and find answers below.
            </p>

            <div className="mt-6 rounded-2xl border bg-white shadow-sm overflow-hidden">
              {[
                { q: "How do you ensure data accuracy?", a: "We’ll use API responses directly from partners (e.g., Kiwi/Booking) and validate ranges before showing them." },
                { q: "Can I integrate this with other tools?", a: "Yes — webhooks and export endpoints are planned so you can send itineraries to calendars or CRMs." },
                { q: "How long does it take to get started?", a: "You can generate a plan in under 20 seconds. Live booking links will arrive once partner APIs are enabled." },
                { q: "What kind of support do you offer?", a: "Priority email/chat for paid users; SLA for partners." },
                { q: "Is my data secure?", a: "We’ll store only what’s needed for your plan and delete on request. HTTPS everywhere." },
              ].map((item, i) => (
                <div key={i} className={`border-b last:border-b-0 ${faqOpen === i ? "bg-slate-50/60" : ""}`}>
                  <button onClick={() => setFaqOpen(faqOpen === i ? -1 : i)} className="w-full flex items-center justify-between text-left p-5">
                    <span className="font-medium">{item.q}</span>
                    {faqOpen === i ? <X className="h-4 w-4 text-slate-400" /> : <Plus className="h-4 w-4 text-slate-400" />}
                  </button>
                  {faqOpen === i && <div className="px-5 pb-5 text-sm text-slate-600">{item.a}</div>}
                </div>
              ))}
            </div>
          </div>
        </section>

        <footer className="max-w-6xl mx-auto px-4 py-8 text-xs text-slate-500 border-t">
          © {new Date().getFullYear()} GeniusTripAI — MVP demo. Connect real APIs soon.
        </footer>
      </div>
    </TooltipProvider>
  );
}
