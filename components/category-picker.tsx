"use client";

import { Fragment, useState } from "react";
import { ChevronsUpDownIcon, SearchIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ExtraCategoryBadge } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import type { CategoryOption } from "@/lib/categories";

const SHOWN = 200;

// One category among the tree of a competitor, in a popover with a search field. `options`
// is null while they load.
export function CategoryPicker({
  id,
  options,
  value,
  onChange,
}: {
  id?: string;
  options: CategoryOption[] | null;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = options?.find((o) => o.value === String(value));

  const words = search.toLocaleLowerCase("fr").split(/\s+/).filter(Boolean);
  const matching = (options ?? []).filter((o) => words.every((w) => o.searchText.toLocaleLowerCase("fr").includes(w)));
  // The extra categories come after the main ones (see categoryOptions), under their own header.
  const firstExtra = matching.findIndex((o) => o.extra);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button id={id} type="button" variant="outline" role="combobox" aria-expanded={open} disabled={options === null} className="h-auto min-h-9 w-full justify-between bg-background py-1.5 font-normal">
          {options === null ? (
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <Spinner /> Loading the categories…
            </span>
          ) : selected ? (
            <span className="min-w-0 text-left">
              <span className="flex items-center gap-1.5">
                <span className="truncate">{selected.label}</span>
                {selected.extra ? <ExtraCategoryBadge compact /> : null}
              </span>
              {selected.hint ? <span className="block truncate text-xs text-muted-foreground">{selected.hint}</span> : null}
            </span>
          ) : (
            <span className="text-muted-foreground">Choose a category…</span>
          )}
          <ChevronsUpDownIcon className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-72 p-0">
        <div className="border-b p-2">
          <InputGroup className="h-8">
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search a category…" aria-label="Search a category" autoFocus />
          </InputGroup>
        </div>
        <ul className="max-h-72 overflow-y-auto p-1" role="listbox" aria-label="Categories">
          {matching.slice(0, SHOWN).map((o, i) => {
            const current = o.value === String(value);
            return (
              <Fragment key={o.value}>
                {i === firstExtra ? (
                  <li role="presentation" className="mt-1 border-t px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground">
                    Extra categories
                  </li>
                ) : null}
                <li role="option" aria-selected={current}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(Number(o.value));
                      setOpen(false);
                    }}
                    className={cn("flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted", current && "bg-primary/10")}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate">{o.label}</span>
                        {o.extra ? <ExtraCategoryBadge compact /> : null}
                      </span>
                      {o.hint ? <span className="block truncate text-xs text-muted-foreground">{o.hint}</span> : null}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">{o.count.toLocaleString("en-GB")}</span>
                  </button>
                </li>
              </Fragment>
            );
          })}
          {options && options.length === 0 ? <li className="px-2 py-6 text-center text-sm text-muted-foreground">No categories yet: run a full catalog sync first.</li> : null}
          {options && options.length > 0 && matching.length === 0 ? <li className="px-2 py-6 text-center text-sm text-muted-foreground">Nothing matches “{search}”.</li> : null}
          {matching.length > SHOWN ? (
            <li className="px-2 py-2 text-center text-xs text-muted-foreground">{(matching.length - SHOWN).toLocaleString("en-GB")} more: refine the search</li>
          ) : null}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
