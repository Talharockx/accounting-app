"use client";

import type { Dispatch, SetStateAction } from "react";
import { useMemo } from "react";
import { MidnightField } from "@/components/ui/midnight-field";
import { PressableButton } from "@/components/ui/pressable";
import { parseNonNegative } from "@/lib/dashboard/daily-entry";
import {
  GROCERY_FIXED_EXPENSE_CATEGORIES,
  type GroceryFixedExpenseCategory,
} from "@/lib/dashboard/grocery-daily-entry";
import { NamedLinesOnly, useNamedListHelpers, type NamedListHelpers, type NamedRowStr } from "@/components/dashboard/mobile-shop-fields";

export type PersonSaleRowStr = { itemName: string; bank: string; cash: string };

export const emptyPersonSale = (): PersonSaleRowStr => ({ itemName: "", bank: "0", cash: "0" });

export type ChequeRowStr = { itemName: string; amount: string; dueDate: string; paid: boolean };

export const emptyCheque = (): ChequeRowStr => ({ itemName: "", amount: "0", dueDate: "", paid: false });

export function usePersonSaleListHelpers() {
  return useMemo(
    () => ({
      add: (setter: Dispatch<SetStateAction<PersonSaleRowStr[]>>) => setter((prev) => [...prev, emptyPersonSale()]),
      remove: (setter: Dispatch<SetStateAction<PersonSaleRowStr[]>>, index: number) =>
        setter((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index))),
      changeName: (setter: Dispatch<SetStateAction<PersonSaleRowStr[]>>, index: number, itemName: string) =>
        setter((prev) => prev.map((row, i) => (i === index ? { ...row, itemName } : row))),
      changeBank: (setter: Dispatch<SetStateAction<PersonSaleRowStr[]>>, index: number, bank: string) =>
        setter((prev) =>
          prev.map((row, i) =>
            i === index ? { ...row, bank: String(Math.max(0, parseNonNegative(bank))) } : row,
          ),
        ),
      changeCash: (setter: Dispatch<SetStateAction<PersonSaleRowStr[]>>, index: number, cash: string) =>
        setter((prev) =>
          prev.map((row, i) =>
            i === index ? { ...row, cash: String(Math.max(0, parseNonNegative(cash))) } : row,
          ),
        ),
    }),
    [],
  );
}

export type PersonSaleListHelpers = ReturnType<typeof usePersonSaleListHelpers>;

export function useChequeListHelpers() {
  return useMemo(
    () => ({
      add: (setter: Dispatch<SetStateAction<ChequeRowStr[]>>) => setter((prev) => [...prev, emptyCheque()]),
      remove: (setter: Dispatch<SetStateAction<ChequeRowStr[]>>, index: number) =>
        setter((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index))),
      changeName: (setter: Dispatch<SetStateAction<ChequeRowStr[]>>, index: number, itemName: string) =>
        setter((prev) => prev.map((row, i) => (i === index ? { ...row, itemName } : row))),
      changeAmount: (setter: Dispatch<SetStateAction<ChequeRowStr[]>>, index: number, amount: string) =>
        setter((prev) =>
          prev.map((row, i) =>
            i === index ? { ...row, amount: String(Math.max(0, parseNonNegative(amount))) } : row,
          ),
        ),
      changeDueDate: (setter: Dispatch<SetStateAction<ChequeRowStr[]>>, index: number, dueDate: string) =>
        setter((prev) => prev.map((row, i) => (i === index ? { ...row, dueDate } : row))),
      changePaid: (setter: Dispatch<SetStateAction<ChequeRowStr[]>>, index: number, paid: boolean) =>
        setter((prev) => prev.map((row, i) => (i === index ? { ...row, paid } : row))),
    }),
    [],
  );
}

export type ChequeListHelpers = ReturnType<typeof useChequeListHelpers>;

export function CompanyExpensesBlock({
  idPrefix,
  rows,
  setRows,
}: {
  idPrefix: string;
  rows: NamedRowStr[];
  setRows: Dispatch<SetStateAction<NamedRowStr[]>>;
}) {
  const changeAmount = (index: number, amount: string) => {
    setRows((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, amount: String(Math.max(0, parseNonNegative(amount))) } : row,
      ),
    );
  };

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h3 className="text-lg font-semibold text-[var(--lv-heading)]">Expenses by company</h3>
        <p className="text-xs text-[var(--lv-muted-strong)]">
          Enter the amount paid to each supplier for this day.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {rows.map((row, index) => (
          <MidnightField
            key={`${idPrefix}-${row.itemName}`}
            id={`${idPrefix}-amt-${index}`}
            label={row.itemName}
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={row.amount}
            onChange={(e) => changeAmount(index, e.target.value)}
          />
        ))}
      </div>
    </section>
  );
}

export function PersonSalesBlock({
  idPrefix,
  rows,
  setRows,
  helpers,
}: {
  idPrefix: string;
  rows: PersonSaleRowStr[];
  setRows: Dispatch<SetStateAction<PersonSaleRowStr[]>>;
  helpers: PersonSaleListHelpers;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h3 className="text-lg font-semibold text-[var(--lv-heading)]">Person sales</h3>
        <p className="text-xs text-[var(--lv-muted-strong)]">
          Each person working that day: name, bank sale, and cash sale (add multiple rows as needed).
        </p>
      </div>
      {rows.map((row, index) => (
        <div
          key={`${idPrefix}-${index}`}
          className="rounded-2xl border border-[#ffffff10] bg-[color-mix(in_srgb,var(--lv-card)_45%,transparent)] p-4 backdrop-blur-md"
        >
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs uppercase tracking-wide text-[var(--lv-muted-strong)]">Person {index + 1}</p>
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <MidnightField
              id={`${idPrefix}-name-${index}`}
              label="Person name"
              type="text"
              value={row.itemName}
              onChange={(e) => helpers.changeName(setRows, index, e.target.value)}
            />
            <MidnightField
              id={`${idPrefix}-bank-${index}`}
              label="Bank sale"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={row.bank}
              onChange={(e) => helpers.changeBank(setRows, index, e.target.value)}
            />
            <MidnightField
              id={`${idPrefix}-cash-${index}`}
              label="Cash sale"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={row.cash}
              onChange={(e) => helpers.changeCash(setRows, index, e.target.value)}
            />
          </div>
        </div>
      ))}
      <PressableButton type="button" variant="secondary" className="min-h-11 w-full sm:w-auto" onClick={() => helpers.add(setRows)}>
        Add person sale
      </PressableButton>
    </section>
  );
}

export function ChequesBlock({
  idPrefix,
  rows,
  setRows,
  helpers,
}: {
  idPrefix: string;
  rows: ChequeRowStr[];
  setRows: Dispatch<SetStateAction<ChequeRowStr[]>>;
  helpers: ChequeListHelpers;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h3 className="text-lg font-semibold text-[var(--lv-heading)]">Cheques</h3>
        <p className="text-xs text-[var(--lv-muted-strong)]">
          Cheque name, value, due date, and paid status (matches your Excel colour cue).
        </p>
      </div>
      {rows.map((row, index) => (
        <div
          key={`${idPrefix}-${index}`}
          className="rounded-2xl border border-[#ffffff10] bg-[color-mix(in_srgb,var(--lv-card)_45%,transparent)] p-4 backdrop-blur-md"
        >
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs uppercase tracking-wide text-[var(--lv-muted-strong)]">Cheque {index + 1}</p>
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MidnightField
              id={`${idPrefix}-name-${index}`}
              label="Name"
              type="text"
              value={row.itemName}
              onChange={(e) => helpers.changeName(setRows, index, e.target.value)}
            />
            <MidnightField
              id={`${idPrefix}-amt-${index}`}
              label="Cheque value"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={row.amount}
              onChange={(e) => helpers.changeAmount(setRows, index, e.target.value)}
            />
            <MidnightField
              id={`${idPrefix}-due-${index}`}
              label="Due date"
              type="date"
              value={row.dueDate}
              onChange={(e) => helpers.changeDueDate(setRows, index, e.target.value)}
            />
            <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-[color-mix(in_srgb,var(--lv-glass-edge)_45%,transparent)] px-4">
              <input
                type="checkbox"
                checked={row.paid}
                onChange={(e) => helpers.changePaid(setRows, index, e.target.checked)}
                className="size-4 accent-[var(--lv-accent)]"
              />
              <span className="text-sm font-medium text-[var(--lv-heading)]">Paid</span>
            </label>
          </div>
        </div>
      ))}
      <PressableButton type="button" variant="secondary" className="min-h-11 w-full sm:w-auto" onClick={() => helpers.add(setRows)}>
        Add cheque
      </PressableButton>
    </section>
  );
}

export function GroceryFixedExpensesBlock({
  sections,
  setSections,
  helpers,
}: {
  sections: Record<GroceryFixedExpenseCategory, NamedRowStr[]>;
  setSections: Dispatch<SetStateAction<Record<GroceryFixedExpenseCategory, NamedRowStr[]>>>;
  helpers: NamedListHelpers;
}) {
  return (
    <section className="flex flex-col gap-8">
      <div>
        <h3 className="text-lg font-semibold text-[var(--lv-heading)]">Operating expenses</h3>
        <p className="text-xs text-[var(--lv-muted-strong)]">
          Rent, bills, salaries, POS, extras, and Vodafone — each category supports multiple lines per day.
        </p>
      </div>
      {GROCERY_FIXED_EXPENSE_CATEGORIES.map(({ key, label, hint }) => (
        <NamedLinesOnly
          key={key}
          idPrefix={`g-fixed-${key}`}
          title={label}
          hint={hint}
          nameFieldLabel="Detail (optional)"
          rows={sections[key]}
          setRows={(updater) => {
            setSections((prev) => {
              const nextRows = typeof updater === "function" ? updater(prev[key]) : updater;
              return { ...prev, [key]: nextRows };
            });
          }}
          helpers={helpers}
        />
      ))}
    </section>
  );
}

