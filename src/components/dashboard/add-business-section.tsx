"use client";

import { FormEvent } from "react";
import { motion } from "framer-motion";
import { GlassFormCard } from "@/components/ui/glass-form-card";
import { MidnightField } from "@/components/ui/midnight-field";
import { PressableButton } from "@/components/ui/pressable";
import { cn } from "@/lib/utils/cn";

export type BusinessType = "restaurant" | "mobile_shop";

type AddBusinessSectionProps = {
  id?: string;
  /** Unique prefix for field ids when two forms exist on one page. */
  formInstanceId?: string;
  selectedType: BusinessType | null;
  onSelectType: (type: BusinessType) => void;
  businessName: string;
  onBusinessNameChange: (value: string) => void;
  phoneNumber: string;
  onPhoneNumberChange: (value: string) => void;
  vatNumber: string;
  onVatNumberChange: (value: string) => void;
  address: string;
  onAddressChange: (value: string) => void;
  contactEmail: string;
  onContactEmailChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  saving: boolean;
  title?: string;
  subtitle?: string;
};

export function AddBusinessSection({
  id = "add-business",
  formInstanceId = "primary",
  selectedType,
  onSelectType,
  businessName,
  onBusinessNameChange,
  phoneNumber,
  onPhoneNumberChange,
  vatNumber,
  onVatNumberChange,
  address,
  onAddressChange,
  contactEmail,
  onContactEmailChange,
  onSubmit,
  saving,
  title = "Add a business",
  subtitle = "Choose a type, enter a name, and save.",
}: AddBusinessSectionProps) {
  const fid = formInstanceId;
  const typeCard = (type: BusinessType, selected: boolean) =>
    cn(
      "group/ptype min-h-[3rem] cursor-pointer touch-manipulation rounded-[1.625rem] border p-7 text-left transition-[transform,box-shadow,border-color,background-color] duration-200 active:scale-[0.99] md:p-8",
      selected
        ? "border-[color-mix(in_srgb,var(--lv-accent)_45%,#ffffff10)] bg-[color-mix(in_srgb,var(--lv-accent)_12%,#151921)] shadow-[var(--lv-bento-shadow-hover)] ring-1 ring-[color-mix(in_srgb,var(--lv-accent)_28%,transparent)] backdrop-blur-md"
        : "border-[#ffffff10] bg-[color-mix(in_srgb,var(--lv-card)_75%,transparent)] backdrop-blur-md hover:border-[#ffffff24] hover:shadow-[var(--lv-bento-shadow-hover)]",
    );

  return (
    <motion.div
      id={id}
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ type: "spring", stiffness: 360, damping: 32 }}
      className="scroll-mt-28 space-y-8"
    >
      <div>
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.22em] text-[var(--lv-muted-strong)]">
          Provision
        </p>
        <h2 className="mt-3 text-xl font-bold tracking-tight text-[var(--lv-heading)] sm:text-2xl">{title}</h2>
        <p className="mt-2 max-w-xl text-sm text-[var(--lv-muted-strong)]">{subtitle}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <button type="button" className={typeCard("restaurant", selectedType === "restaurant")} onClick={() => onSelectType("restaurant")}>
          <p className="text-lg font-semibold text-[var(--lv-heading)] sm:text-xl">Restaurant</p>
          <p className="mt-2 text-sm text-[var(--lv-muted-strong)]">
            Structured daily totals for dine-in & takeaway throughput.
          </p>
          <p className="pointer-events-none mt-4 max-h-0 overflow-hidden text-xs leading-relaxed text-[var(--lv-muted-strong)] opacity-0 transition-[max-height,opacity] duration-300 ease-out group-hover/ptype:max-h-28 group-hover/ptype:opacity-100">
            Kitchen purchasing, discretionary expenses, and split tender channels stay isolated from mobile retail rules.
          </p>
        </button>

        <button type="button" className={typeCard("mobile_shop", selectedType === "mobile_shop")} onClick={() => onSelectType("mobile_shop")}>
          <p className="text-lg font-semibold text-[var(--lv-heading)] sm:text-xl">Mobile shop</p>
          <p className="mt-2 text-sm text-[var(--lv-muted-strong)]">
            Phones, prepaid SIM ladders, repairs, and inventory deltas.
          </p>
          <p className="pointer-events-none mt-4 max-h-0 overflow-hidden text-xs leading-relaxed text-[var(--lv-muted-strong)] opacity-0 transition-[max-height,opacity] duration-300 ease-out group-hover/ptype:max-h-28 group-hover/ptype:opacity-100">
            Margin-aware handset rows, carrier splits, and repair tickets render into the same LedgerView KPI grid.
          </p>
        </button>
      </div>

      {selectedType ? (
        <GlassFormCard>
          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            <p className="text-sm font-medium text-[var(--lv-heading)]">
              Name your new {selectedType === "restaurant" ? "restaurant" : "mobile shop"}
            </p>
            <MidnightField
              id={`${fid}-business-name`}
              label="Business name"
              type="text"
              value={businessName}
              onChange={(e) => onBusinessNameChange(e.target.value)}
              required
              autoComplete="organization"
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <MidnightField
                id={`${fid}-phone`}
                label="Phone number"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phoneNumber}
                onChange={(e) => onPhoneNumberChange(e.target.value)}
                required
              />
              <MidnightField
                id={`${fid}-vat`}
                label="VAT number"
                type="text"
                value={vatNumber}
                onChange={(e) => onVatNumberChange(e.target.value)}
                required
              />
            </div>
            <MidnightField
              id={`${fid}-address`}
              label="Address"
              rows={3}
              value={address}
              onChange={(e) => onAddressChange(e.target.value)}
              required
            />
            <MidnightField
              id={`${fid}-email`}
              label="Email"
              type="email"
              autoComplete="email"
              value={contactEmail}
              onChange={(e) => onContactEmailChange(e.target.value)}
              required
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <PressableButton type="submit" className="min-h-12 w-full sm:min-w-[200px] sm:w-auto" disabled={saving}>
                {saving ? "Provisioning…" : "Save workspace"}
              </PressableButton>
            </div>
          </form>
        </GlassFormCard>
      ) : (
        <p className="text-sm text-[var(--lv-muted-strong)] opacity-75">
          Tap a modality above—the form appears only once a lane is picked to keep surfaces calm.
        </p>
      )}
    </motion.div>
  );
}
