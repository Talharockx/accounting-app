"use client";

import type { Dispatch, SetStateAction } from "react";
import { useMemo } from "react";
import { MidnightField } from "@/components/ui/midnight-field";
import { PressableButton } from "@/components/ui/pressable";
import { cn } from "@/lib/utils/cn";
import { sanitizeNonNegativeDecimalInput } from "@/lib/dashboard/daily-entry";
import {
  RESTAURANT_DELIVERY_PLATFORMS,
  RESTAURANT_SPESA_COMPANIES,
  emptyCompanySaleRow,
  emptySpesaCompanyRow,
  type CompanyDropdownRowStr,
  type RestaurantDeliveryKey,
  type RestaurantSpesaCompanyKey,
  type SpesaDropdownRowStr,
} from "@/lib/dashboard/restaurant-daily-entry";
import {
  NamedLinesOnly,
  useNamedListHelpers,
  type NamedListHelpers,
  type NamedRowStr,
} from "@/components/dashboard/mobile-shop-fields";

export type { CompanyDropdownRowStr, SpesaDropdownRowStr };

export function useCompanySaleListHelpers() {
  return useMemo(
    () => ({
      add: (setter: Dispatch<SetStateAction<CompanyDropdownRowStr[]>>) =>
        setter((prev) => [...prev, emptyCompanySaleRow()]),
      remove: (setter: Dispatch<SetStateAction<CompanyDropdownRowStr[]>>, index: number) =>
        setter((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index))),
      changeCompany: (
        setter: Dispatch<SetStateAction<CompanyDropdownRowStr[]>>,
        index: number,
        companyKey: RestaurantDeliveryKey | "",
      ) => setter((prev) => prev.map((row, i) => (i === index ? { ...row, companyKey } : row))),
      changeAmount: (setter: Dispatch<SetStateAction<CompanyDropdownRowStr[]>>, index: number, amount: string) =>
        setter((prev) =>
          prev.map((row, i) => {
            if (i !== index) return row;
            const next = sanitizeNonNegativeDecimalInput(amount);
            if (next === null) return row;
            return { ...row, amount: next };
          }),
        ),
    }),
    [],
  );
}

export type CompanySaleListHelpers = ReturnType<typeof useCompanySaleListHelpers>;

export function useSpesaCompanyListHelpers() {
  return useMemo(
    () => ({
      add: (setter: Dispatch<SetStateAction<SpesaDropdownRowStr[]>>) =>
        setter((prev) => [...prev, emptySpesaCompanyRow()]),
      remove: (setter: Dispatch<SetStateAction<SpesaDropdownRowStr[]>>, index: number) =>
        setter((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index))),
      changeCompany: (
        setter: Dispatch<SetStateAction<SpesaDropdownRowStr[]>>,
        index: number,
        companyKey: RestaurantSpesaCompanyKey | "",
      ) => setter((prev) => prev.map((row, i) => (i === index ? { ...row, companyKey } : row))),
      changeAmount: (setter: Dispatch<SetStateAction<SpesaDropdownRowStr[]>>, index: number, amount: string) =>
        setter((prev) =>
          prev.map((row, i) => {
            if (i !== index) return row;
            const next = sanitizeNonNegativeDecimalInput(amount);
            if (next === null) return row;
            return { ...row, amount: next };
          }),
        ),
    }),
    [],
  );
}

export type SpesaCompanyListHelpers = ReturnType<typeof useSpesaCompanyListHelpers>;

const selectClass = cn(
  "lv-field-midnight lv-tabular-mono min-h-12 w-full rounded-xl border px-4 py-3 text-sm outline-none",
  "border-[color-mix(in_srgb,var(--lv-glass-edge)_45%,transparent)]",
  "focus:border-[color-mix(in_srgb,var(--lv-accent)_48%,transparent)]",
  "text-[var(--lv-heading)]",
);

export function CompanySalesBlock({
  idPrefix,
  rows,
  setRows,
  helpers,
}: {
  idPrefix: string;
  rows: CompanyDropdownRowStr[];
  setRows: Dispatch<SetStateAction<CompanyDropdownRowStr[]>>;
  helpers: CompanySaleListHelpers;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h3 className="text-lg font-semibold text-[var(--lv-heading)]">Company sales</h3>
        <p className="text-xs text-[var(--lv-muted-strong)]">
          Delivery platform turnover — Glovo, Just Eat, Deliveroo.
        </p>
      </div>
      <div className="rounded-2xl border border-[#ffffff10] bg-[color-mix(in_srgb,var(--lv-card)_45%,transparent)] p-4 backdrop-blur-md">
        {rows.map((row, index) => (
          <div
            key={`${idPrefix}-${index}`}
            className="mb-4 grid grid-cols-1 gap-3 border-b border-[#ffffff08] pb-4 last:mb-0 last:border-0 last:pb-0 md:grid-cols-[1fr_minmax(0,9rem)_auto]"
          >
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${idPrefix}-co-${index}`} className="text-xs font-semibold text-[var(--lv-muted-strong)]">
                Company
              </label>
              <select
                id={`${idPrefix}-co-${index}`}
                value={row.companyKey}
                onChange={(e) =>
                  helpers.changeCompany(setRows, index, e.target.value as RestaurantDeliveryKey | "")
                }
                className={selectClass}
              >
                <option value="">Choose company…</option>
                {RESTAURANT_DELIVERY_PLATFORMS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <MidnightField
              id={`${idPrefix}-amt-${index}`}
              label="Amount"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={row.amount}
              onChange={(e) => helpers.changeAmount(setRows, index, e.target.value)}
            />
            <div className="flex items-end">
              <PressableButton
                type="button"
                variant="ghost"
                className="min-h-12 w-full text-[var(--lv-traffic-critical)] md:w-auto"
                disabled={rows.length === 1}
                onClick={() => helpers.remove(setRows, index)}
              >
                Remove
              </PressableButton>
            </div>
          </div>
        ))}
        <PressableButton type="button" variant="secondary" className="min-h-11 w-full sm:w-auto" onClick={() => helpers.add(setRows)}>
          Add company sale
        </PressableButton>
      </div>
    </section>
  );
}

export function CompanySpesaBlock({
  idPrefix,
  rows,
  setRows,
  helpers,
}: {
  idPrefix: string;
  rows: SpesaDropdownRowStr[];
  setRows: Dispatch<SetStateAction<SpesaDropdownRowStr[]>>;
  helpers: SpesaCompanyListHelpers;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h3 className="text-lg font-semibold text-[var(--lv-heading)]">Company spesa</h3>
        <p className="text-xs text-[var(--lv-muted-strong)]">
          Supplier purchases for this day — Kebab and C &amp; C.
        </p>
      </div>
      <div className="rounded-2xl border border-[#ffffff10] bg-[color-mix(in_srgb,var(--lv-card)_45%,transparent)] p-4 backdrop-blur-md">
        {rows.map((row, index) => (
          <div
            key={`${idPrefix}-${index}`}
            className="mb-4 grid grid-cols-1 gap-3 border-b border-[#ffffff08] pb-4 last:mb-0 last:border-0 last:pb-0 md:grid-cols-[1fr_minmax(0,9rem)_auto]"
          >
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${idPrefix}-sp-${index}`} className="text-xs font-semibold text-[var(--lv-muted-strong)]">
                Company
              </label>
              <select
                id={`${idPrefix}-sp-${index}`}
                value={row.companyKey}
                onChange={(e) =>
                  helpers.changeCompany(setRows, index, e.target.value as RestaurantSpesaCompanyKey | "")
                }
                className={selectClass}
              >
                <option value="">Choose company…</option>
                {RESTAURANT_SPESA_COMPANIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <MidnightField
              id={`${idPrefix}-sp-amt-${index}`}
              label="Amount"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={row.amount}
              onChange={(e) => helpers.changeAmount(setRows, index, e.target.value)}
            />
            <div className="flex items-end">
              <PressableButton
                type="button"
                variant="ghost"
                className="min-h-12 w-full text-[var(--lv-traffic-critical)] md:w-auto"
                disabled={rows.length === 1}
                onClick={() => helpers.remove(setRows, index)}
              >
                Remove
              </PressableButton>
            </div>
          </div>
        ))}
        <PressableButton type="button" variant="secondary" className="min-h-11 w-full sm:w-auto" onClick={() => helpers.add(setRows)}>
          Add company spesa
        </PressableButton>
      </div>
    </section>
  );
}

export function RestaurantDailyEntryFields({
  idPrefix,
  bank,
  onBankChange,
  cash,
  onCashChange,
  companySales,
  setCompanySales,
  companySaleHelpers,
  companySpesa,
  setCompanySpesa,
  spesaCompanyHelpers,
  otherSpesa,
  setOtherSpesa,
  namedHelpers,
  notes,
  onNotesChange,
  saving,
}: {
  idPrefix: string;
  bank: string;
  onBankChange: (v: string) => void;
  cash: string;
  onCashChange: (v: string) => void;
  companySales: CompanyDropdownRowStr[];
  setCompanySales: Dispatch<SetStateAction<CompanyDropdownRowStr[]>>;
  companySaleHelpers: CompanySaleListHelpers;
  companySpesa: SpesaDropdownRowStr[];
  setCompanySpesa: Dispatch<SetStateAction<SpesaDropdownRowStr[]>>;
  spesaCompanyHelpers: SpesaCompanyListHelpers;
  otherSpesa: NamedRowStr[];
  setOtherSpesa: Dispatch<SetStateAction<NamedRowStr[]>>;
  namedHelpers: NamedListHelpers;
  notes: string;
  onNotesChange: (v: string) => void;
  saving?: boolean;
}) {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold text-[var(--lv-heading)]">Sales</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <MidnightField
            id={`${idPrefix}-bank`}
            label="Bank sale"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={bank}
            onChange={(e) => {
              const next = sanitizeNonNegativeDecimalInput(e.target.value);
              if (next !== null) onBankChange(next);
            }}
          />
          <MidnightField
            id={`${idPrefix}-cash`}
            label="Cash sale"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={cash}
            onChange={(e) => {
              const next = sanitizeNonNegativeDecimalInput(e.target.value);
              if (next !== null) onCashChange(next);
            }}
          />
        </div>
      </section>

      <CompanySalesBlock
        idPrefix={`${idPrefix}-co-sale`}
        rows={companySales}
        setRows={setCompanySales}
        helpers={companySaleHelpers}
      />

      <section className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold text-[var(--lv-heading)]">Purchases &amp; spesa</h3>
        <p className="text-xs text-[var(--lv-muted-strong)]">
          Company spesa and other supplier costs roll into Total Spesa.
        </p>
      </section>

      <CompanySpesaBlock
        idPrefix={`${idPrefix}-co-spesa`}
        rows={companySpesa}
        setRows={setCompanySpesa}
        helpers={spesaCompanyHelpers}
      />

      <NamedLinesOnly
        idPrefix={`${idPrefix}-other-spesa`}
        title="Other spesa"
        hint="Free-text company or supplier name with amount — add multiple lines."
        nameFieldLabel="Company / detail"
        rows={otherSpesa}
        setRows={setOtherSpesa}
        helpers={namedHelpers}
      />

      <MidnightField
        id={`${idPrefix}-notes`}
        label="Day notes"
        rows={5}
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        disabled={saving}
      />
    </div>
  );
}
