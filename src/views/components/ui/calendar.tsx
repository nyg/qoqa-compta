import { useEffect, useRef, type ComponentProps } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import {
  DayPicker,
  getDefaultClassNames,
  type DayButtonProps,
} from "react-day-picker";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";

type CalendarProps = ComponentProps<typeof DayPicker> & {
  buttonVariant?: ComponentProps<typeof Button>["variant"];
};

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

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      captionLayout={captionLayout}
      className={cn(
        // font-sans is stated rather than inherited: the month grid is a <table>,
        // and a table is the one element WebKit hands its serif standard font when
        // the document is not in standards mode.
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
        dropdown_root: cn(
          "relative rounded-(--cell-radius) border border-transparent hover:border-border",
          defaultClassNames.dropdown_root
        ),
        dropdown: cn(
          "absolute inset-0 bg-popover opacity-0",
          defaultClassNames.dropdown
        ),
        caption_label: cn(
          "select-none font-medium",
          captionLayout === "label"
            ? "text-xs"
            : "flex items-center gap-1 rounded-(--cell-radius) px-1.5 text-xs [&>svg]:size-3.5 [&>svg]:text-muted-foreground",
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
      components={{
        Root: ({ className, rootRef, ...rootProps }) => (
          <div data-slot="calendar" ref={rootRef} className={cn(className)} {...rootProps} />
        ),
        Chevron: ({ className, orientation, ...chevronProps }) => {
          const Icon =
            orientation === "left"
              ? ChevronLeft
              : orientation === "right"
                ? ChevronRight
                : ChevronDown;
          return <Icon className={cn("size-4", className)} {...chevronProps} />;
        },
        DayButton: CalendarDayButton,
        ...components,
      }}
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
