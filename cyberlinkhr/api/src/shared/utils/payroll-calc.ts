/**
 * Indian Payroll Calculation Engine — FY 2025-26
 * New tax regime (Union Budget Feb 2025)
 */

// ─── Professional Tax ─────────────────────────────────────────────────────────
// Monthly PT by state (INR). Key = state code (2-letter ISO).
// month: 0-indexed (0=Jan, 1=Feb … 11=Dec)
export function professionalTax(monthlyGross: number, state: string, month: number): number {
  const g = monthlyGross;
  switch ((state || '').toUpperCase()) {
    case 'MH': // Maharashtra: ₹2500/year cap; 200/mo, Feb=300
      if (g < 7500) return 0;
      if (g <= 10000) return month === 1 ? 300 : 175; // Feb=300
      return month === 1 ? 300 : 200;

    case 'KA': // Karnataka
      if (g < 15000) return 0;
      if (g < 25000) return 150;
      return 200;

    case 'TN': // Tamil Nadu — half-yearly
      if (g < 15001) return 0;
      if (g < 25000) return 100;  // 600/half-year ÷ 6
      return 125;                  // 750/half-year ÷ 6

    case 'WB': // West Bengal
      if (g <= 10000) return 0;
      if (g <= 15000) return 110;
      if (g <= 25000) return 130;
      if (g <= 40000) return 150;
      return 200;

    case 'AP': case 'TS': // Andhra / Telangana
      if (g < 15000) return 0;
      if (g < 20000) return 150;
      return 200;

    case 'DL': case 'HR': case 'UP': case 'RJ':
      return 0; // No PT in these states

    default: // Generic slab
      if (g < 10000) return 0;
      if (g < 20000) return 150;
      return 200;
  }
}

// ─── PF (EPF) ─────────────────────────────────────────────────────────────────
const PF_BASIC_CAP = 15_000; // Statutory cap on PF-applicable basic
const PF_RATE = 0.12;

export function pfEmployee(basic: number): number {
  return Math.round(Math.min(basic, PF_BASIC_CAP) * PF_RATE);
}

export function pfEmployer(basic: number): number {
  return Math.round(Math.min(basic, PF_BASIC_CAP) * PF_RATE);
}

// ─── ESIC ─────────────────────────────────────────────────────────────────────
const ESIC_GROSS_LIMIT = 21_000;

export function esicEmployee(gross: number): number {
  return gross <= ESIC_GROSS_LIMIT ? Math.round(gross * 0.0075) : 0;
}

export function esicEmployer(gross: number): number {
  return gross <= ESIC_GROSS_LIMIT ? Math.round(gross * 0.0325) : 0;
}

// ─── TDS — New Regime FY 2025-26 ─────────────────────────────────────────────
// Slabs per Union Budget Feb 2025
const NEW_REGIME_SLABS = [
  { limit: 400_000, rate: 0 },
  { limit: 800_000, rate: 0.05 },
  { limit: 1_200_000, rate: 0.10 },
  { limit: 1_600_000, rate: 0.15 },
  { limit: 2_000_000, rate: 0.20 },
  { limit: 2_400_000, rate: 0.25 },
  { limit: Infinity, rate: 0.30 },
];

const STANDARD_DEDUCTION = 75_000;
const REBATE_87A_LIMIT = 1_200_000; // ₹12L income → full rebate (up to ₹60,000 rebate)
const REBATE_87A_MAX = 60_000;

function computeIncomeTax(annualIncome: number): number {
  const taxableIncome = Math.max(0, annualIncome - STANDARD_DEDUCTION);
  if (taxableIncome <= 0) return 0;

  let tax = 0;
  let prev = 0;
  for (const slab of NEW_REGIME_SLABS) {
    if (taxableIncome <= prev) break;
    const taxable = Math.min(taxableIncome, slab.limit) - prev;
    tax += taxable * slab.rate;
    prev = slab.limit;
  }

  // Section 87A rebate — full rebate if taxable income <= 12L
  if (taxableIncome <= REBATE_87A_LIMIT) {
    tax = Math.max(0, tax - Math.min(tax, REBATE_87A_MAX));
  }

  // Surcharge (new regime surcharge capped at 25%)
  let surcharge = 0;
  if (taxableIncome > 5_000_000 && taxableIncome <= 10_000_000) surcharge = tax * 0.10;
  else if (taxableIncome > 10_000_000 && taxableIncome <= 20_000_000) surcharge = tax * 0.15;
  else if (taxableIncome > 20_000_000) surcharge = tax * 0.25; // capped at 25% in new regime

  // Health & Education Cess 4%
  const cess = (tax + surcharge) * 0.04;
  return Math.round(tax + surcharge + cess);
}

/** Monthly TDS = (Projected Annual Tax) / 12, computed on annualised monthly gross */
export function monthlyTds(monthlyGross: number): number {
  const annual = monthlyGross * 12;
  const annualTax = computeIncomeTax(annual);
  return Math.round(annualTax / 12);
}

// ─── LOP (Loss of Pay) ───────────────────────────────────────────────────────
export interface LopInput {
  grossSalary: number;
  presentDays: number;    // present + approved leave days
  workingDays: number;    // calendar working days in month (excl. weekends + holidays)
}

export function lopDeduction(input: LopInput): { earned: number; lop: number; lopDays: number } {
  const { grossSalary, presentDays, workingDays } = input;
  if (workingDays === 0) return { earned: grossSalary, lop: 0, lopDays: 0 };
  const lopDays = Math.max(0, workingDays - presentDays);
  const perDay = grossSalary / workingDays;
  const lop = Math.round(lopDays * perDay);
  const earned = grossSalary - lop;
  return { earned, lop, lopDays };
}

// ─── Full Payslip Calculator ──────────────────────────────────────────────────
export interface PayslipInput {
  grossSalary: number;
  basicPct: number;     // e.g. 50
  hraPct: number;       // e.g. 20
  specialPct: number;   // e.g. 30
  presentDays: number;
  workingDays: number;
  state: string;        // 2-letter state code
  month: number;        // 0-indexed
  otherEarnings?: { name: string; amount: number }[];
  otherDeductions?: { name: string; amount: number }[];
}

export interface PayslipResult {
  grossSalary: number;
  lopDays: number;
  earnedGross: number;
  basic: number;
  hra: number;
  specialAllowance: number;
  otherEarnings: { name: string; amount: number }[];
  lopAmount: number;
  pfEmployee: number;
  pfEmployer: number;
  esicEmployee: number;
  esicEmployer: number;
  professionalTax: number;
  tds: number;
  otherDeductions: { name: string; amount: number }[];
  totalDeductions: number;
  netSalary: number;
}

export function calculatePayslip(input: PayslipInput): PayslipResult {
  const { grossSalary, basicPct, hraPct, specialPct, presentDays, workingDays, state, month } = input;

  // LOP
  const { earned, lop, lopDays } = lopDeduction({ grossSalary, presentDays, workingDays });
  const earnedGross = earned;

  // Salary components (proportional to earned)
  const earnedRatio = workingDays > 0 ? earned / grossSalary : 1;
  const basic = Math.round(grossSalary * (basicPct / 100) * earnedRatio);
  const hra = Math.round(grossSalary * (hraPct / 100) * earnedRatio);
  const special = Math.round(grossSalary * (specialPct / 100) * earnedRatio);

  // Deductions on earned gross
  const pf = pfEmployee(basic);
  const pfEr = pfEmployer(basic);
  const esicEe = esicEmployee(earnedGross);
  const esicEr = esicEmployer(earnedGross);
  const pt = professionalTax(earnedGross, state, month);
  const tds = monthlyTds(earnedGross);

  const otherEarningsTotal = (input.otherEarnings || []).reduce((s, e) => s + e.amount, 0);
  const otherDeductionsTotal = (input.otherDeductions || []).reduce((s, d) => s + d.amount, 0);

  const totalDeductions = pf + esicEe + pt + tds + lop + otherDeductionsTotal;
  const netSalary = earnedGross + otherEarningsTotal - pf - esicEe - pt - tds - otherDeductionsTotal;

  return {
    grossSalary,
    lopDays,
    earnedGross,
    basic,
    hra,
    specialAllowance: special,
    otherEarnings: input.otherEarnings || [],
    lopAmount: lop,
    pfEmployee: pf,
    pfEmployer: pfEr,
    esicEmployee: esicEe,
    esicEmployer: esicEr,
    professionalTax: pt,
    tds,
    otherDeductions: input.otherDeductions || [],
    totalDeductions,
    netSalary: Math.max(0, netSalary),
  };
}
