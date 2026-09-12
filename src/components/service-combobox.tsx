import * as PopoverPrimitive from "@radix-ui/react-popover";
import { useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Check, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor } from "@/components/ui/popover";
import {
  filterServiceCategories,
  isExistingService,
  normalizeServiceSearch,
  type FilteredServiceCategory,
} from "@/data/service-options";
import { cn } from "@/lib/utils";

type ServiceComboboxProps = {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  name?: string;
  placeholder?: string;
  maxLength?: number;
  error?: string;
  className?: string;
};

/**
 * The catalogue runs to a couple of thousand services, so the list only renders this many at a
 * time. Searching still looks at every service - typing narrows the matches down into view.
 */
const MAX_RENDERED_SERVICES = 150;

type ServiceListItem =
  | {
      type: "service";
      category: string;
      service: string;
    }
  | {
      type: "custom";
      value: string;
    };

export function ServiceCombobox({
  value,
  onChange,
  required,
  disabled,
  id,
  name,
  placeholder = "Search or enter a service",
  maxLength,
  error,
  className,
}: ServiceComboboxProps) {
  const generatedId = useId();
  const inputId = id ?? `service-${generatedId}`;
  const listboxId = `${inputId}-listbox`;
  const errorId = error ? `${inputId}-error` : undefined;
  const inputWrapperRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [contentWidth, setContentWidth] = useState<number | undefined>();

  const filteredCategories = useMemo(() => filterServiceCategories(value), [value]);
  const { visibleCategories, totalMatches } = useMemo(() => {
    const total = filteredCategories.reduce((count, group) => count + group.services.length, 0);
    if (total <= MAX_RENDERED_SERVICES) return { visibleCategories: filteredCategories, totalMatches: total };

    const groups: FilteredServiceCategory[] = [];
    let remaining = MAX_RENDERED_SERVICES;
    for (const group of filteredCategories) {
      if (remaining <= 0) break;
      groups.push({ category: group.category, services: group.services.slice(0, remaining) });
      remaining -= Math.min(group.services.length, remaining);
    }
    return { visibleCategories: groups, totalMatches: total };
  }, [filteredCategories]);
  const hiddenMatches = totalMatches - visibleCategories.reduce((count, group) => count + group.services.length, 0);
  const customValue = value.trim();
  const showCustomAction = customValue.length > 0 && !isExistingService(customValue);
  const items = useMemo<ServiceListItem[]>(() => {
    const serviceItems = visibleCategories.flatMap((group) =>
      group.services.map((service) => ({
        type: "service" as const,
        category: group.category,
        service,
      })),
    );
    return showCustomAction
      ? [{ type: "custom", value: customValue }, ...serviceItems]
      : serviceItems;
  }, [customValue, showCustomAction, visibleCategories]);

  const activeItemId =
    open && items[highlightedIndex] ? `${listboxId}-item-${highlightedIndex}` : undefined;

  function openList() {
    if (disabled) return;
    setContentWidth(inputWrapperRef.current?.getBoundingClientRect().width);
    setOpen(true);
    setHighlightedIndex(0);
  }

  function selectService(service: string) {
    onChange(service);
    setOpen(false);
    setHighlightedIndex(0);
  }

  function confirmCustom() {
    onChange(customValue);
    setOpen(false);
    setHighlightedIndex(0);
  }

  function selectItem(item: ServiceListItem) {
    if (item.type === "custom") {
      confirmCustom();
      return;
    }
    selectService(item.service);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        openList();
        return;
      }
      setHighlightedIndex((current) => Math.min(current + 1, Math.max(items.length - 1, 0)));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openList();
        return;
      }
      setHighlightedIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === "Enter" && open) {
      const highlightedItem = items[highlightedIndex];
      if (highlightedItem) {
        event.preventDefault();
        selectItem(highlightedItem);
      } else if (customValue) {
        event.preventDefault();
        confirmCustom();
      }
      return;
    }

    if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div ref={inputWrapperRef} className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={inputId}
            name={name}
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
              if (!open) setOpen(true);
              setHighlightedIndex(0);
            }}
            onClick={openList}
            onFocus={openList}
            onKeyDown={handleKeyDown}
            required={required}
            disabled={disabled}
            maxLength={maxLength}
            placeholder={placeholder}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-activedescendant={activeItemId}
            aria-invalid={error ? true : undefined}
            aria-describedby={errorId}
            className={cn("pl-9 pr-3", className)}
          />
          {error ? (
            <p id={errorId} className="mt-1 text-xs text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      </PopoverAnchor>
      <PopoverPrimitive.Content
  side="bottom"
  align="start"
  sideOffset={6}
  collisionPadding={16}
  onOpenAutoFocus={(event) => event.preventDefault()}
  className="z-[70] overflow-hidden rounded-md border bg-popover p-0 text-popover-foreground shadow-md outline-none"
  style={{ width: contentWidth }}
>
  <div
    className="max-h-[300px] overflow-y-auto overscroll-contain"
    onWheel={(event) => event.stopPropagation()}
  >
          <div id={listboxId} role="listbox" className="p-1">
            {showCustomAction ? (
              <ServiceOptionButton
                id={`${listboxId}-item-0`}
                selected={highlightedIndex === 0}
                checked={normalizeServiceSearch(value) === normalizeServiceSearch(customValue)}
                onMouseEnter={() => setHighlightedIndex(0)}
                onSelect={confirmCustom}
              >
                Use &quot;{customValue}&quot;
              </ServiceOptionButton>
            ) : null}
            {visibleCategories.length > 0 ? (
              visibleCategories.map((group) => {
                const serviceStartIndex =
                  (showCustomAction ? 1 : 0) +
                  visibleCategories
                    .slice(0, visibleCategories.indexOf(group))
                    .reduce((count, category) => count + category.services.length, 0);

                return (
                  <div key={group.category} role="group" aria-label={group.category}>
                    <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {group.category}
                    </div>
                    {group.services.map((service, serviceIndex) => {
                      const itemIndex = serviceStartIndex + serviceIndex;
                      return (
                        <ServiceOptionButton
                          key={`${group.category}-${service}`}
                          id={`${listboxId}-item-${itemIndex}`}
                          selected={highlightedIndex === itemIndex}
                          checked={value === service}
                          onMouseEnter={() => setHighlightedIndex(itemIndex)}
                          onSelect={() => selectService(service)}
                        >
                          {service}
                        </ServiceOptionButton>
                      );
                    })}
                  </div>
                );
              })
            ) : (
              <div className="px-3 py-5 text-center text-sm text-muted-foreground">
                No matching services
              </div>
            )}
            {hiddenMatches > 0 ? (
              <div className="px-2 py-2 text-center text-[11px] text-muted-foreground">
                {hiddenMatches} more services - keep typing to narrow the list
              </div>
            ) : null}
          </div>
         </div>
</PopoverPrimitive.Content>
    </Popover>
  );
}

function ServiceOptionButton({
  id,
  selected,
  checked,
  children,
  onMouseEnter,
  onSelect,
}: {
  id: string;
  selected: boolean;
  checked: boolean;
  children: ReactNode;
  onMouseEnter: () => void;
  onSelect: () => void;
}) {
  return (
    <button
      id={id}
      type="button"
      role="option"
      aria-selected={selected}
      onMouseEnter={onMouseEnter}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none transition-colors",
        selected
          ? "bg-accent text-accent-foreground"
          : "hover:bg-accent hover:text-accent-foreground",
      )}
    >
      <span className="min-w-0 truncate">{children}</span>
      {checked ? <Check className="h-4 w-4 shrink-0" /> : null}
    </button>
  );
}
