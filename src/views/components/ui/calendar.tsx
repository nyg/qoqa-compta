import {
  useEffect,
  useMemo,
  useRef,
  type ChangeEvent,
  type ComponentProps,
} from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import {
  DayPicker,
  getDefaultClassNames,
  type ChevronProps,
  type CustomComponents,
  type DayButtonProps,
  type DropdownProps,
  type RootProps,
} from "react-day-picker";
import { Select } from "@base-ui/react/select";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";

type CalendarProps = ComponentProps<typeof DayPicker> & {
  buttonVariant?: ComponentProps<typeof Button>["variant"];
};

function CalendarRoot({ className, rootRef, ...props }: RootProps) {
  return <div data-slot="calendar" ref={rootRef} className={className} {...props} />;
}

function CalendarChevron({ className, orientation, ...props }: ChevronProps) {
  const Icon =
    orientation === "left"
      ? ChevronLeft
      : orientation === "right"
        ? ChevronRight
        : ChevronDown;
  return <Icon className={cn("size-4", className)} {...props} />;
}

function CalendarDropdown({
  options,
  value,
  onChange,
  disabled,
  className,
  "aria-label": ariaLabel,
}: DropdownProps) {
  const selected = options?.find((option) => option.value === Number(value));

  return (
    <Select.Root
      value={Number(value)}
      disabled={disabled}
      modal={false}
      onValueChange={(next) => {
        onChange?.({
          target: { value: String(next) },
        } as ChangeEvent<HTMLSelectElement>);
      }}
    >
      <Select.Trigger
        aria-label={ariaLabel}
        className={cn(
          "relative flex cursor-pointer select-none items-center gap-1 rounded-(--cell-radius) border border-transparent px-1.5",
          "hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
          "data-disabled:pointer-events-none data-disabled:opacity-50",
          className
        )}
      >
        {selected?.label}
        <Select.Icon>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Positioner
        positionMethod="fixed"
        sideOffset={4}
        alignItemWithTrigger={false}
        className="z-50 outline-none"
      >
        <Select.Popup className="min-w-(--anchor-width) rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          <Select.List className="max-h-(--available-height) overflow-y-auto">
            {options?.map((option) => (
              <Select.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className="grid cursor-pointer select-none grid-cols-[1rem_1fr] items-center gap-1.5 rounded-sm py-1 pl-1.5 pr-3 outline-none data-highlighted:bg-muted data-disabled:pointer-events-none data-disabled:opacity-50"
              >
                <Select.ItemIndicator className="col-start-1">
                  <Check className="size-3" />
                </Select.ItemIndicator>
                <Select.ItemText className="col-start-2">{option.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.List>
        </Select.Popup>
      </Select.Positioner>
    </Select.Root>
  );
}

const CALENDAR_COMPONENTS = {
  Root: CalendarRoot,
  Chevron: CalendarChevron,
  Dropdown: CalendarDropdown,
  DayButton: CalendarDayButton,
} satisfies Partial<CustomComponents>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  components,
  ...props
}: CalendarProps) {
  const defaultClassNames = getDefaultClassNames();

  const mergedComponents = useMemo(
    () => (components ? { ...CALENDAR_COMPONENTS, ...components } : CALENDAR_COMPONENTS),
    [components]
  );

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      captionLayout={captionLayout}
      className={cn(
        "group/calendar bg-popover p-3 font-sans [--cell-radius:var(--radius-md)] [--cell-size:--spacing(8)]",
        className
      )}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn("relative flex flex-col gap-4", defaultClassNames.months),
        month: cn("flex w-full flex-col gap-4", defaultClassNames.month),
        nav: cn(
          "absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1",
          defaultClassNames.nav
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          "size-(--cell-size) p-0 select-none aria-disabled:opacity-50",
          defaultClassNames.button_previous
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          "size-(--cell-size) p-0 select-none aria-disabled:opacity-50",
          defaultClassNames.button_next
        ),
        month_caption: cn(
          "flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)",
          defaultClassNames.month_caption
        ),
        dropdowns: cn(
          "flex h-(--cell-size) w-full items-center justify-center gap-1.5 text-xs font-medium",
          defaultClassNames.dropdowns
        ),
        caption_label: cn(
          "select-none text-xs font-medium",
          defaultClassNames.caption_label
        ),
        month_grid: cn("w-full border-collapse", defaultClassNames.month_grid),
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "flex-1 select-none rounded-(--cell-radius) text-[0.7rem] font-normal text-muted-foreground",
          defaultClassNames.weekday
        ),
        week: cn("mt-1.5 flex w-full", defaultClassNames.week),
        day: cn(
          "group/day relative aspect-square h-full w-full select-none rounded-(--cell-radius) p-0 text-center [&:first-child[data-selected=true]_button]:rounded-l-(--cell-radius) [&:last-child[data-selected=true]_button]:rounded-r-(--cell-radius)",
          defaultClassNames.day
        ),
        range_start: cn(
          "rounded-l-(--cell-radius) bg-muted",
          defaultClassNames.range_start
        ),
        range_middle: cn("rounded-none bg-muted", defaultClassNames.range_middle),
        range_end: cn(
          "rounded-r-(--cell-radius) bg-muted",
          defaultClassNames.range_end
        ),
        today: cn(
          "rounded-(--cell-radius) font-medium text-primary data-[selected=true]:text-inherit",
          defaultClassNames.today
        ),
        outside: cn(
          "text-muted-foreground aria-selected:text-muted-foreground",
          defaultClassNames.outside
        ),
        disabled: cn("text-muted-foreground opacity-50", defaultClassNames.disabled),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={mergedComponents}
      {...props}
    />
  );
}

function CalendarDayButton({ className, day, modifiers, ...props }: DayButtonProps) {
  const defaultClassNames = getDefaultClassNames();
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString()}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        "relative flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-1 rounded-(--cell-radius) border-0 text-xs font-normal leading-none group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-2 group-data-[focused=true]/day:ring-ring/30 data-[range-middle=true]:bg-transparent data-[range-middle=true]:text-foreground data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground",
        defaultClassNames.day,
        className
      )}
      {...props}
    />
  );
}

export { Calendar, CalendarDayButton };
