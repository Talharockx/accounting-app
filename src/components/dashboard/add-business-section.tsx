"use client";

import { FormEvent } from "react";

export type BusinessType = "restaurant" | "mobile_shop";

type AddBusinessSectionProps = {
  id?: string;
  selectedType: BusinessType | null;
  onSelectType: (type: BusinessType) => void;
  businessName: string;
  onBusinessNameChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  saving: boolean;
  title?: string;
  subtitle?: string;
};

export function AddBusinessSection({
  id = "add-business",
  selectedType,
  onSelectType,
  businessName,
  onBusinessNameChange,
  onSubmit,
  saving,
  title = "Add a business",
  subtitle = "Choose a type, enter a name, and save.",
}: AddBusinessSectionProps) {
  return (
    <div id={id} className="scroll-mt-24 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <button
          type="button"
          className={`rounded-2xl border p-6 text-left transition md:p-8 ${
            selectedType === "restaurant"
              ? "border-cyan-300 bg-cyan-400/15 ring-1 ring-cyan-300/40"
              : "border-white/20 bg-white/10 hover:bg-white/15"
          }`}
          onClick={() => onSelectType("restaurant")}
        >
          <p className="text-xl font-semibold">Add restaurant</p>
          <p className="mt-2 text-sm text-slate-300">
            Dine-in, takeaway, ingredients, and daily cash flow.
          </p>
        </button>

        <button
          type="button"
          className={`rounded-2xl border p-6 text-left transition md:p-8 ${
            selectedType === "mobile_shop"
              ? "border-cyan-300 bg-cyan-400/15 ring-1 ring-cyan-300/40"
              : "border-white/20 bg-white/10 hover:bg-white/15"
          }`}
          onClick={() => onSelectType("mobile_shop")}
        >
          <p className="text-xl font-semibold">Add mobile shop</p>
          <p className="mt-2 text-sm text-slate-300">
            Device sales, SIMs, repairs, and accessories.
          </p>
        </button>
      </div>

      {selectedType ? (
        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-white/20 bg-white/10 p-6 backdrop-blur"
        >
          <p className="mb-3 text-sm text-slate-300">
            New {selectedType === "restaurant" ? "restaurant" : "mobile shop"} name
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={businessName}
              onChange={(event) => onBusinessNameChange(event.target.value)}
              placeholder="Enter business name"
              className="w-full rounded-xl border border-white/15 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/70"
              required
            />
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:from-cyan-300 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? "Saving..." : "Save business"}
            </button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-slate-500">
          Pick restaurant or mobile shop above, then enter a name.
        </p>
      )}
    </div>
  );
}
