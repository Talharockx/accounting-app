"use client";

import type { Dispatch, SetStateAction } from "react";
import { useMemo } from "react";
import { MidnightField } from "@/components/ui/midnight-field";
import { PressableButton } from "@/components/ui/pressable";
import { sanitizeNonNegativeDecimalInput } from "@/lib/dashboard/daily-entry";

export type NamedRowStr = { itemName: string; amount: string };

export const emptyNamed = (): NamedRowStr => ({ itemName: "", amount: "" });

export type MerchRowStr = { itemName: string; retail: string; buy: string };

export const emptyMerch = (): MerchRowStr => ({ itemName: "", retail: "", buy: "" });

export function useNamedListHelpers() {
  return useMemo(
    () => ({
      add: (setter: Dispatch<SetStateAction<NamedRowStr[]>>) => setter((prev) => [...prev, emptyNamed()]),
      remove: (setter: Dispatch<SetStateAction<NamedRowStr[]>>, index: number) =>
        setter((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index))),
      changeName: (setter: Dispatch<SetStateAction<NamedRowStr[]>>, index: number, itemName: string) =>
        setter((prev) => prev.map((row, i) => (i === index ? { ...row, itemName } : row))),
      changeAmount: (setter: Dispatch<SetStateAction<NamedRowStr[]>>, index: number, amount: string) =>
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

export type NamedListHelpers = ReturnType<typeof useNamedListHelpers>;

export function useMerchListHelpers() {
  return useMemo(
    () => ({
      add: (setter: Dispatch<SetStateAction<MerchRowStr[]>>) => setter((prev) => [...prev, emptyMerch()]),
      remove: (setter: Dispatch<SetStateAction<MerchRowStr[]>>, index: number) =>
        setter((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index))),
      changeName: (setter: Dispatch<SetStateAction<MerchRowStr[]>>, index: number, itemName: string) =>
        setter((prev) => prev.map((row, i) => (i === index ? { ...row, itemName } : row))),
      changeRetail: (setter: Dispatch<SetStateAction<MerchRowStr[]>>, index: number, retail: string) =>
        setter((prev) =>
          prev.map((row, i) => {
            if (i !== index) return row;
            const next = sanitizeNonNegativeDecimalInput(retail);
            if (next === null) return row;
            return { ...row, retail: next };
          }),
        ),
      changeBuy: (setter: Dispatch<SetStateAction<MerchRowStr[]>>, index: number, buy: string) =>
        setter((prev) =>
          prev.map((row, i) => {
            if (i !== index) return row;
            const next = sanitizeNonNegativeDecimalInput(buy);
            if (next === null) return row;
            return { ...row, buy: next };
          }),
        ),
    }),
    [],
  );
}

export type MerchListHelpers = ReturnType<typeof useMerchListHelpers>;

export function MerchNamedBlock({
  idPrefix,
  title,
  hint,
  rows,
  setRows,
  retailLabel,
  buyLabel,
  helpers,
}: {
  idPrefix: string;
  title: string;
  hint: string;
  rows: MerchRowStr[];
  setRows: Dispatch<SetStateAction<MerchRowStr[]>>;
  retailLabel: string;
  buyLabel: string;
  helpers: MerchListHelpers;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h3 className="text-lg font-semibold text-[var(--lv-heading)]">{title}</h3>
        <p className="text-xs text-[var(--lv-muted-strong)]">{hint}</p>
      </div>
      <div className="rounded-2xl border border-[#ffffff10] bg-[color-mix(in_srgb,var(--lv-card)_45%,transparent)] p-4 backdrop-blur-md">
        {rows.map((row, index) => (
          <div
            key={`${idPrefix}-${index}`}
            className="mb-4 grid grid-cols-1 gap-3 border-b border-[#ffffff08] pb-4 last:mb-0 last:border-0 last:pb-0 md:grid-cols-[1fr_minmax(0,7rem)_minmax(0,7rem)_auto]"
          >
            <MidnightField
              id={`${idPrefix}-name-${index}`}
              label="Name"
              type="text"
              value={row.itemName}
              onChange={(e) => helpers.changeName(setRows, index, e.target.value)}
            />
            <MidnightField
              id={`${idPrefix}-retail-${index}`}
              label={retailLabel}
              type="text"
              inputMode="decimal"
              value={row.retail}
              onChange={(e) => helpers.changeRetail(setRows, index, e.target.value)}
            />
            <MidnightField
              id={`${idPrefix}-buy-${index}`}
              label={buyLabel}
              type="text"
              inputMode="decimal"
              value={row.buy}
              onChange={(e) => helpers.changeBuy(setRows, index, e.target.value)}
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
          Add line
        </PressableButton>
      </div>
    </section>
  );
}

export function NamedLinesOnly({
  idPrefix,
  title,
  hint,
  rows,
  setRows,
  helpers,
  nameFieldLabel = "Name",
}: {
  idPrefix: string;
  title: string;
  hint: string;
  rows: NamedRowStr[];
  setRows: Dispatch<SetStateAction<NamedRowStr[]>>;
  helpers: NamedListHelpers;
  /** First column label (e.g. "Detail" for expenses). */
  nameFieldLabel?: string;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="text-lg font-semibold text-[var(--lv-heading)]">{title}</h3>
        <p className="text-xs text-[var(--lv-muted-strong)]">{hint}</p>
      </div>
      {rows.map((row, index) => (
        <div
          key={`${idPrefix}-${index}`}
          className="rounded-2xl border border-[#ffffff10] bg-[color-mix(in_srgb,var(--lv-card)_45%,transparent)] p-4 backdrop-blur-md"
        >
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs uppercase tracking-wide text-[var(--lv-muted-strong)]">
              {title} {index + 1}
            </p>
            <PressableButton
              type="button"
              variant="ghost"
              className="min-h-12 w-full text-[var(--lv-traffic-critical)] sm:w-auto"
              disabled={rows.length === 1}
              onClick={() => helpers.remove(setRows, index)}
            >
              Remove
            </PressableButton>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <MidnightField
              id={`${idPrefix}-n-${index}`}
              label={nameFieldLabel}
              type="text"
              value={row.itemName}
              onChange={(e) => helpers.changeName(setRows, index, e.target.value)}
            />
            <MidnightField
              id={`${idPrefix}-a-${index}`}
              label="Amount"
              type="text"
              inputMode="decimal"
              value={row.amount}
              onChange={(e) => helpers.changeAmount(setRows, index, e.target.value)}
            />
          </div>
        </div>
      ))}
      <PressableButton type="button" variant="secondary" className="min-h-11 w-full sm:w-auto" onClick={() => helpers.add(setRows)}>
        Add {title.toLowerCase()}
      </PressableButton>
    </section>
  );
}
