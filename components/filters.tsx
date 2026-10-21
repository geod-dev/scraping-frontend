"use client";

import { createContext, Fragment, useContext, useState, useTransition, type ReactNode, type TransitionStartFunction } from "react";
import Link from "next/link";
import { ArrowDownWideNarrowIcon, ArrowUpNarrowWideIcon, ChevronsUpDownIcon, SearchIcon, SlidersHorizontalIcon } from "lucide-react";
import { debounce, parseAsNativeArrayOf, parseAsString, useQueryStates } from "nuqs";
import { cn } from "@/lib/utils";
import { ExtraCategoryBadge } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

// Filters bound to the URL (nuqs): every change updates the query string and re-renders the
// server page, without an "Apply" button. Text and number fields wait for a pause in typing.
// Any change restarts the pagination (drops `offset`). Values removed elsewhere (filter chips,
// "Clear all", back/forward) flow back into the controls since they read the URL.

const TYPING_DELAY_MS = 350;
const ALL = "__all";

type Option = { value: string; label: ReactNode; count?: number | null };

const FiltersContext = createContext<{ startTransition?: TransitionStartFunction; pending: boolean }>({ pending: false });

// `clears`: parameters that depend on this one, dropped when it changes.
function useParam(name: string, clears: string[] = []) {
  const { startTransition } = useContext(FiltersContext);
  const [state, setState] = useQueryStates(
    { [name]: parseAsString, offset: parseAsString, ...Object.fromEntries(clears.map((c) => [c, parseAsString])) },
    { shallow: false, scroll: false, startTransition },
  );
  const set = (value: string | null, typing = false) =>
    setState(
      { [name]: value || null, offset: null, ...Object.fromEntries(clears.map((c) => [c, null])) },
      typing ? { limitUrlUpdates: debounce(TYPING_DELAY_MS) } : undefined,
    );
  return [(state[name] as string | null) ?? "", set] as const;
}

// Toolbar holding the filters of a list: inline controls, the filter sheet, the active
// filter chips, and `trailing` controls (the sort) on the right.
export function FilterBar({ children, trailing }: { children: ReactNode; trailing?: ReactNode }) {
  const [pending, startTransition] = useTransition();
  return (
    <FiltersContext.Provider value={{ startTransition, pending }}>
      <div role="search" className="flex flex-wrap items-center gap-2">
        {children}
        <Spinner className={cn("text-primary", !pending && "invisible")} aria-label={pending ? "Updating results" : undefined} />
        {trailing ? <div className="ml-auto flex flex-wrap items-center gap-2">{trailing}</div> : null}
      </div>
    </FiltersContext.Provider>
  );
}

export function FilterSearch({ name, placeholder, label, className }: { name: string; placeholder: string; label: string; className?: string }) {
  const [value, setValue] = useParam(name);
  return (
    <InputGroup className={cn("h-8 w-64 bg-background", className)}>
      <InputGroupAddon>
        <SearchIcon />
      </InputGroupAddon>
      <InputGroupInput type="search" value={value} onChange={(e) => setValue(e.target.value, true)} placeholder={placeholder} aria-label={label} />
    </InputGroup>
  );
}

export function FilterNumber({ name, placeholder, label, min, max, className }: { name: string; placeholder?: string; label: string; min?: number; max?: number; className?: string }) {
  const [value, setValue] = useParam(name);
  return (
    <Input
      type="number"
      inputMode="decimal"
      step="any"
      min={min}
      max={max}
      value={value}
      onChange={(e) => setValue(e.target.value, true)}
      placeholder={placeholder}
      aria-label={label}
      className={cn("h-8 w-24", className)}
    />
  );
}

// Select. With `allLabel` an empty value means "all"; otherwise `defaultValue` is the value
// the page uses when the parameter is absent (e.g. the default sort).
export function FilterSelect({
  name,
  options,
  label,
  allLabel,
  defaultValue,
  clears,
  className,
}: {
  name: string;
  options: Option[];
  label: string;
  allLabel?: string;
  defaultValue?: string;
  clears?: string[];
  className?: string;
}) {
  const [value, setValue] = useParam(name, clears);
  const fallback = allLabel ? ALL : (defaultValue ?? options[0]?.value ?? ALL);
  return (
    <Select value={value || fallback} onValueChange={(v) => setValue(v === ALL || v === defaultValue ? null : v)}>
      <SelectTrigger size="sm" aria-label={label} className={cn("min-w-36 bg-background", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {allLabel ? <SelectItem value={ALL}>{allLabel}</SelectItem> : null}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
            {o.count != null ? <span className="ml-auto pl-3 text-xs text-muted-foreground tabular-nums">{o.count.toLocaleString("en-GB")}</span> : null}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// One choice among a few, as a segmented control. The first option ("Any") clears the filter.
export function FilterToggle({ name, options, label, anyLabel = "Any" }: { name: string; options: Option[]; label: string; anyLabel?: ReactNode | null }) {
  const [value, setValue] = useParam(name);
  const items = anyLabel ? [{ value: ALL, label: anyLabel }, ...options] : options;
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      aria-label={label}
      value={value || (anyLabel ? ALL : "")}
      onValueChange={(v) => {
        if (v) setValue(v === ALL ? null : v);
        else if (!anyLabel) setValue(null);
      }}
      className="flex-wrap bg-background"
    >
      {items.map((o) => (
        <ToggleGroupItem key={o.value} value={o.value} className="px-2.5 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
          {o.label}
          {"count" in o && o.count != null ? <span className="text-xs tabular-nums opacity-70">{o.count.toLocaleString("en-GB")}</span> : null}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

// Several choices of a repeated parameter (?status=a&status=b), as toggle chips.
export function FilterMulti({ name, options, label }: { name: string; options: Option[]; label: string }) {
  const { startTransition } = useContext(FiltersContext);
  const [state, setState] = useQueryStates(
    { [name]: parseAsNativeArrayOf(parseAsString), offset: parseAsString },
    { shallow: false, scroll: false, startTransition },
  );
  return (
    <ToggleGroup
      type="multiple"
      variant="outline"
      size="sm"
      spacing={1}
      aria-label={label}
      value={state[name] as string[]}
      onValueChange={(values) => setState({ [name]: values.length > 0 ? values : null, offset: null })}
      className="flex-wrap"
    >
      {options.map((o) => (
        <ToggleGroupItem key={o.value} value={o.value} className="rounded-full! px-3 data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-primary">
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

const COMBOBOX_SHOWN = 200;

// Several choices of a repeated parameter among many, in a popover with a search field:
// for long lists (categories). `hint` is shown under the label and searched too.
export function FilterCombobox({
  name,
  options,
  label,
  anyLabel = "Any",
  searchPlaceholder = "Search…",
  extraGroupLabel = "Extra",
}: {
  name: string;
  // `extra`: grouped after the others under `extraGroupLabel`, with a badge (extra categories).
  options: (Option & { hint?: string; searchText?: string; extra?: boolean })[];
  label: string;
  anyLabel?: string;
  searchPlaceholder?: string;
  extraGroupLabel?: string;
}) {
  const { startTransition } = useContext(FiltersContext);
  const [state, setState] = useQueryStates(
    { [name]: parseAsNativeArrayOf(parseAsString), offset: parseAsString },
    { shallow: false, scroll: false, startTransition },
  );
  const [search, setSearch] = useState("");
  const selected = state[name] as string[];
  const set = (values: string[]) => setState({ [name]: values.length > 0 ? values : null, offset: null });
  const toggle = (value: string, on: boolean) => set(on ? [...selected, value] : selected.filter((v) => v !== value));

  const words = search.toLocaleLowerCase("fr").split(/\s+/).filter(Boolean);
  const matching = options.filter((o) => {
    const haystack = (o.searchText ?? `${typeof o.label === "string" ? o.label : o.value} ${o.hint ?? ""}`).toLocaleLowerCase("fr");
    return words.every((w) => haystack.includes(w));
  });
  // Selected options first, so they stay in reach while searching.
  const ordered = [...matching.filter((o) => selected.includes(o.value)), ...matching.filter((o) => !selected.includes(o.value))];
  const first = options.find((o) => o.value === selected[0]);
  const firstExtra = ordered.findIndex((o) => o.extra && !selected.includes(o.value));

  return (
    <Popover onOpenChange={(open) => !open && setSearch("")}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-label={label} className="w-full justify-between bg-background font-normal">
          <span className={cn("truncate", selected.length === 0 && "text-muted-foreground")}>
            {selected.length === 0 ? anyLabel : selected.length === 1 ? (first?.label ?? `#${selected[0]}`) : `${selected.length} selected`}
          </span>
          <ChevronsUpDownIcon className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-72 p-0">
        <div className="border-b p-2">
          <InputGroup className="h-8">
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={searchPlaceholder} aria-label={`Search ${label.toLowerCase()}`} autoFocus />
          </InputGroup>
        </div>
        <ul className="max-h-72 overflow-y-auto p-1" role="listbox" aria-multiselectable aria-label={label}>
          {ordered.slice(0, COMBOBOX_SHOWN).map((o, i) => {
            const checked = selected.includes(o.value);
            return (
              <Fragment key={o.value}>
                {i === firstExtra ? (
                  <li role="presentation" className="mt-1 border-t px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground">
                    {extraGroupLabel}
                  </li>
                ) : null}
                <li role="option" aria-selected={checked}>
                  <label className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                    <Checkbox checked={checked} onCheckedChange={(on) => toggle(o.value, on === true)} className="mt-0.5" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate">{o.label}</span>
                        {o.extra ? <ExtraCategoryBadge compact /> : null}
                      </span>
                      {o.hint ? <span className="block truncate text-xs text-muted-foreground">{o.hint}</span> : null}
                    </span>
                    {o.count != null ? <span className="text-xs text-muted-foreground tabular-nums">{o.count.toLocaleString("en-GB")}</span> : null}
                  </label>
                </li>
              </Fragment>
            );
          })}
          {ordered.length === 0 ? <li className="px-2 py-6 text-center text-sm text-muted-foreground">Nothing matches “{search}”.</li> : null}
          {ordered.length > COMBOBOX_SHOWN ? (
            <li className="px-2 py-2 text-center text-xs text-muted-foreground">
              {(ordered.length - COMBOBOX_SHOWN).toLocaleString("en-GB")} more: refine the search
            </li>
          ) : null}
        </ul>
        {selected.length > 0 ? (
          <div className="flex items-center justify-between border-t px-3 py-2 text-xs">
            <span className="text-muted-foreground">{selected.length} selected</span>
            <button type="button" onClick={() => set([])} className="font-medium text-muted-foreground hover:text-foreground">
              Clear
            </button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

// Ascending / descending switch for the sort.
export function FilterOrder({ name = "order", defaultValue = "desc" }: { name?: string; defaultValue?: "asc" | "desc" }) {
  const [value, setValue] = useParam(name);
  const order = value === "asc" || value === "desc" ? value : defaultValue;
  const next = order === "desc" ? "asc" : "desc";
  return (
    <Button
      variant="outline"
      size="icon"
      className="bg-background"
      onClick={() => setValue(next === defaultValue ? null : next)}
      aria-label={order === "desc" ? "Descending order, switch to ascending" : "Ascending order, switch to descending"}
      title={order === "desc" ? "Descending" : "Ascending"}
    >
      {order === "desc" ? <ArrowDownWideNarrowIcon /> : <ArrowUpNarrowWideIcon />}
    </Button>
  );
}

// Labelled filter inside the sheet.
export function FilterField({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

// Titled group of filters inside the sheet.
export function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h3 className="text-[11px] font-semibold tracking-wider text-muted-foreground/80 uppercase">{title}</h3>
      {children}
    </section>
  );
}

// "Filters" button opening a side sheet with the secondary filters. Results update behind it.
export function FilterSheet({ children, count, clearHref }: { children: ReactNode; count: number; clearHref: string }) {
  const { pending } = useContext(FiltersContext);
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className={cn("bg-background", count > 0 && "border-primary/40 text-primary")}>
          <SlidersHorizontalIcon />
          Filters
          {count > 0 ? <Badge className="h-4 min-w-4 px-1 text-[10px] tabular-nums">{count}</Badge> : null}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>Results update as you change them.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-7 overflow-y-auto p-4">{children}</div>
        <SheetFooter className="flex-row items-center justify-between border-t">
          {count > 0 ? (
            <Link href={clearHref} scroll={false} className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Clear all
            </Link>
          ) : (
            <span />
          )}
          <SheetClose asChild>
            <Button>
              {pending ? <Spinner /> : null}
              Show results
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
