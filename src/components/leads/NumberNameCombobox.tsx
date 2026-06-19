import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const OPTIONS = [
  "Appliance Repair Nationwide MIS",
  "Atlanta Georgia Appliance Repair / GD",
  "Atlanta Georgia Handyman",
  "Austin Handyman N/FB",
  "Chicago Facebook",
  "Chicago Handyman",
  "Dallas Garage Door",
  "Exterior Painting Nationwide / TV Mounting",
  "Garage Door NATIONWIDE MIS",
  "Houston Facebook ND Garage Door OP1",
  "Houston Handyman",
  "Houston Handyman OP1",
  "Indianapolis Handyman",
  "JOC HOT TUB",
  "Junk Removal Nationwide MIS",
  "Los Angeles - Handyman",
  "Los Angeles Appliance OP1",
  "Los Angeles Facebook OP1",
  "LOS ANGELES GARAGE DOOR / CLEANING / PLUMBING",
  "Los Angeles Handyman FB",
  "Max Mad",
  "Miami Appliance Repair",
  "Miami FB/ND Garage Door OP1",
  "Miami Handyman",
  "Nationwide Christmas Lights",
  "Nationwide Drywall Patch Repair",
  "Nationwide Plumbing FB / Nationwide Handyman",
  "New Jersey Handyman",
  "New York Handyman",
  "Orange County Appliance Repair",
  "Orange County Handyman OP1",
  "San Diego - Appliance Repair",
  "San Diego - Handyman",
  "San Diego Garage Door OP1",
  "San Jose Appliance Repair",
  "San Jose Handyman",
  "Santa Clarita Handyman",
  "Sliding Door"
];

interface NumberNameComboboxProps {
  value?: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export default function NumberNameCombobox({
  value,
  onChange,
  disabled,
  className,
}: NumberNameComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  // Determine the display label
  const displayValue = value || "Select Number Name...";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal text-left h-10 border border-input rounded-md px-3 bg-transparent",
            !value && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">{displayValue}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0" align="start">
        <Command shouldFilter={true}>
          <CommandInput
            placeholder="Search number name..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No option found.</CommandEmpty>
            <CommandGroup>
              {OPTIONS.map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  onSelect={(currentValue) => {
                    // Match the actual option instead of the lowercase cmdk value
                    const matchedOption = OPTIONS.find(
                      (opt) => opt.toLowerCase() === currentValue.toLowerCase()
                    ) || option;
                    onChange(matchedOption);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option}
                </CommandItem>
              ))}

              {search.trim() !== "" &&
                !OPTIONS.some(
                  (option) =>
                    option.toLowerCase() === search.trim().toLowerCase()
                ) && (
                  <CommandItem
                    value={search}
                    onSelect={() => {
                      onChange(search.trim());
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4 text-primary" />
                    <span className="text-primary font-medium">
                      Use custom: "{search.trim()}"
                    </span>
                  </CommandItem>
                )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
