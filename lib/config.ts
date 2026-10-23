export function mode(): "simulation" | "live" {
  const value = process.env.GROWTH_MODE ?? "simulation";
  if (value !== "simulation" && value !== "live") throw new Error("Invalid GROWTH_MODE");
  return value;
}
export function required(name: string) { const value = process.env[name]; if (!value) throw new Error(`Missing configuration: ${name}`); return value; }
