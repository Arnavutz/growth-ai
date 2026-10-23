export type Totals = {
  impressions: number;
  clicks: number;
  leads: number;
  qualifiedLeads: number;
  customers: number;
  spendCents: number;
  revenueCents: number;
  variableCostCents: number;
};
export function metrics(t: Totals) {
  const ratio = (a: number, b: number) => (b > 0 ? a / b : null);
  return {
    ...t,
    ctr: ratio(t.clicks, t.impressions),
    cpcCents: ratio(t.spendCents, t.clicks),
    cpmCents: ratio(t.spendCents * 1000, t.impressions),
    cacCents: ratio(t.spendCents, t.customers),
    roas: ratio(t.revenueCents, t.spendCents),
    contributionCents: t.revenueCents - t.variableCostCents - t.spendCents,
    clickToLead: ratio(t.leads, t.clicks),
    qualification: ratio(t.qualifiedLeads, t.leads),
    leadToCustomer: ratio(t.customers, t.qualifiedLeads),
  };
}
export const simulatedTotals: Totals = {
  impressions: 184200,
  clicks: 5526,
  leads: 642,
  qualifiedLeads: 218,
  customers: 64,
  spendCents: 384000,
  revenueCents: 1913600,
  variableCostCents: 382720,
};
