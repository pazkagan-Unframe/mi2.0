export type Confidence = "high" | "med" | "low";

export type Submarket = {
  name: string;
  city: string;
  leases: number;
  market: number | null;
  yours: number;
  gap: number | null;
  conf: Confidence;
  comps: number;
};

export type PropertyType = {
  id: string;
  name: string;
  leases: number;
  netGap: string;
  submarketCount: number;
  above: number;
  below: number;
  insufficient: number;
  submarkets: Submarket[];
};

export const propertyTypeData: Record<string, PropertyType> = {
  office: {
    id: "office",
    name: "Office",
    leases: 130,
    netGap: "−$4.42/SF",
    submarketCount: 18,
    above: 64,
    below: 46,
    insufficient: 20,
    submarkets: [
      { name: "Midtown", city: "New York NY", leases: 8, market: 47.2, yours: 78.4, gap: 31.2, conf: "high", comps: 24 },
      { name: "Back Bay", city: "Boston MA", leases: 12, market: 37.6, yours: 62.1, gap: 24.5, conf: "high", comps: 18 },
      { name: "Boca Raton CBD", city: "Boca Raton FL", leases: 6, market: 29.3, yours: 48.2, gap: 18.9, conf: "med", comps: 6 },
      { name: "Buckhead", city: "Atlanta GA", leases: 23, market: 23.4, yours: 34.8, gap: 11.4, conf: "high", comps: 31 },
      { name: "Bergen-Meadowlands", city: "Northern NJ", leases: 9, market: 34.2, yours: 41.8, gap: 7.6, conf: "med", comps: 7 },
      { name: "Airport/South Atlanta", city: "Atlanta GA", leases: 21, market: 19.1, yours: 25.2, gap: 6.1, conf: "high", comps: 28 },
      { name: "I-85 North Corridor", city: "Atlanta GA", leases: 18, market: 22.8, yours: 28.5, gap: 5.7, conf: "high", comps: 22 },
      { name: "I-75 South / Henry County", city: "Atlanta GA", leases: 14, market: 20.1, yours: 24.3, gap: 4.2, conf: "high", comps: 19 },
      { name: "West Loop", city: "Chicago IL", leases: 11, market: 42.3, yours: 38.9, gap: -3.4, conf: "high", comps: 26 },
      { name: "CBD", city: "various", leases: 4, market: 41.2, yours: 35.6, gap: -5.6, conf: "med", comps: 8 },
      { name: "Naples", city: "Naples FL", leases: 4, market: null, yours: 52.0, gap: null, conf: "low", comps: 4 },
    ],
  },
  other: {
    id: "other",
    name: "Other",
    leases: 113,
    netGap: "+$23.24/SF",
    submarketCount: 14,
    above: 67,
    below: 46,
    insufficient: 0,
    submarkets: [
      { name: "Mixed-use locations", city: "various", leases: 38, market: 18.4, yours: 41.6, gap: 23.2, conf: "high", comps: 45 },
      { name: "Specialty retail", city: "various", leases: 22, market: 24.8, yours: 49.2, gap: 24.4, conf: "high", comps: 19 },
      { name: "Suburban flex", city: "various", leases: 17, market: 14.2, yours: 38.1, gap: 23.9, conf: "med", comps: 9 },
      { name: "Tech corridors", city: "various", leases: 14, market: 32.1, yours: 56.8, gap: 24.7, conf: "high", comps: 16 },
      { name: "Lifestyle centers", city: "various", leases: 12, market: 28.4, yours: 51.3, gap: 22.9, conf: "med", comps: 8 },
      { name: "Other specialty", city: "various", leases: 10, market: 22.8, yours: 44.2, gap: 21.4, conf: "med", comps: 7 },
    ],
  },
  warehouse: {
    id: "warehouse",
    name: "Warehouse",
    leases: 34,
    netGap: "−$7.53/SF",
    submarketCount: 9,
    above: 6,
    below: 28,
    insufficient: 0,
    submarkets: [
      { name: "Inland Empire West", city: "CA", leases: 6, market: 14.2, yours: 21.5, gap: 7.3, conf: "high", comps: 18 },
      { name: "Bergen-Meadowlands", city: "Northern NJ", leases: 5, market: 12.1, yours: 18.4, gap: 6.3, conf: "med", comps: 8 },
      { name: "I-285 NE Corridor", city: "Atlanta GA", leases: 8, market: 8.4, yours: 12.8, gap: 4.4, conf: "high", comps: 22 },
      { name: "I-65 South", city: "Indianapolis IN", leases: 4, market: 6.3, yours: 11.2, gap: 4.9, conf: "med", comps: 6 },
      { name: "PHL Airport", city: "Philadelphia PA", leases: 3, market: null, yours: 14.5, gap: null, conf: "low", comps: 3 },
      { name: "Various other markets", city: "", leases: 8, market: 9.8, yours: 14.2, gap: 4.4, conf: "med", comps: 12 },
    ],
  },
  restaurant: {
    id: "restaurant",
    name: "Restaurant",
    leases: 18,
    netGap: "+$20.37/SF",
    submarketCount: 11,
    above: 2,
    below: 16,
    insufficient: 0,
    submarkets: [
      { name: "Times Square", city: "New York NY", leases: 2, market: 220.0, yours: 168.0, gap: -52.0, conf: "high", comps: 14 },
      { name: "Back Bay", city: "Boston MA", leases: 3, market: 95.0, yours: 64.0, gap: -31.0, conf: "high", comps: 11 },
      { name: "Lincoln Park", city: "Chicago IL", leases: 2, market: 78.0, yours: 52.0, gap: -26.0, conf: "med", comps: 7 },
      { name: "South Beach", city: "Miami FL", leases: 2, market: 110.0, yours: 88.0, gap: -22.0, conf: "med", comps: 6 },
      { name: "Other", city: "various", leases: 9, market: 58.0, yours: 41.0, gap: -17.0, conf: "med", comps: 18 },
    ],
  },
  office_warehouse: {
    id: "office_warehouse",
    name: "Office/Warehouse",
    leases: 15,
    netGap: "−$5.90/SF",
    submarketCount: 8,
    above: 13,
    below: 1,
    insufficient: 1,
    submarkets: [
      { name: "Inland Empire East", city: "CA", leases: 4, market: 16.2, yours: 22.4, gap: 6.2, conf: "high", comps: 13 },
      { name: "I-285 NE Corridor", city: "Atlanta GA", leases: 3, market: 14.8, yours: 20.1, gap: 5.3, conf: "med", comps: 7 },
      { name: "I-65 North", city: "Nashville TN", leases: 3, market: 11.2, yours: 16.8, gap: 5.6, conf: "med", comps: 8 },
      { name: "Various", city: "various", leases: 5, market: 13.4, yours: 19.2, gap: 5.8, conf: "med", comps: 11 },
    ],
  },
  general_office: {
    id: "general_office",
    name: "General Office",
    leases: 14,
    netGap: "−$13.52/SF",
    submarketCount: 7,
    above: 11,
    below: 3,
    insufficient: 0,
    submarkets: [
      { name: "Midtown East", city: "New York NY", leases: 2, market: 52.0, yours: 78.4, gap: 26.4, conf: "high", comps: 16 },
      { name: "Financial District", city: "San Francisco CA", leases: 3, market: 64.2, yours: 84.1, gap: 19.9, conf: "high", comps: 14 },
      { name: "Loop", city: "Chicago IL", leases: 2, market: 38.4, yours: 51.8, gap: 13.4, conf: "high", comps: 18 },
      { name: "Other", city: "various", leases: 7, market: 31.2, yours: 41.8, gap: 10.6, conf: "med", comps: 14 },
    ],
  },
  industrial: {
    id: "industrial",
    name: "Industrial",
    leases: 10,
    netGap: "−$7.66/SF",
    submarketCount: 6,
    above: 8,
    below: 2,
    insufficient: 0,
    submarkets: [
      { name: "I-78 Corridor", city: "PA/NJ", leases: 3, market: 9.2, yours: 14.6, gap: 5.4, conf: "med", comps: 7 },
      { name: "Inland Empire West", city: "CA", leases: 2, market: 14.8, yours: 21.4, gap: 6.6, conf: "high", comps: 12 },
      { name: "I-285 NE Corridor", city: "Atlanta GA", leases: 2, market: 8.1, yours: 13.4, gap: 5.3, conf: "med", comps: 8 },
      { name: "Other", city: "various", leases: 3, market: 9.4, yours: 15.2, gap: 5.8, conf: "med", comps: 9 },
    ],
  },
  manufacturing: {
    id: "manufacturing",
    name: "Manufacturing",
    leases: 9,
    netGap: "−$10.34/SF",
    submarketCount: 6,
    above: 9,
    below: 0,
    insufficient: 0,
    submarkets: [
      { name: "I-65 South", city: "Indianapolis IN", leases: 2, market: 7.2, yours: 13.8, gap: 6.6, conf: "med", comps: 6 },
      { name: "I-94 Corridor", city: "MI", leases: 2, market: 8.4, yours: 15.2, gap: 6.8, conf: "med", comps: 7 },
      { name: "Greenville-Spartanburg", city: "SC", leases: 2, market: 6.8, yours: 14.1, gap: 7.3, conf: "high", comps: 11 },
      { name: "Other", city: "various", leases: 3, market: 8.2, yours: 16.4, gap: 8.2, conf: "med", comps: 8 },
    ],
  },
};

export type TooltipPayload = {
  title: string;
  meta?: string;
  rent?: string;
  market?: string;
  scope?: string;
  gap?: string;
  conf?: "high" | "med" | "medium" | "low";
  formula?: string;
};

export function fmtCurrency(v: number | null) {
  if (v === null || v === undefined) return "—";
  const sign = v < 0 ? "−" : "+";
  return sign + "$" + Math.abs(v).toFixed(2);
}
