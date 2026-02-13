"use client";

interface FilterBarProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

const filters = ["All Trends", "For You"];

export default function FilterBar({ activeFilter, onFilterChange }: FilterBarProps) {
  return (
    <div className="flex gap-2">
      {filters.map((filter) => (
        <button
          key={filter}
          onClick={() => onFilterChange(filter)}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            activeFilter === filter
              ? "bg-accent text-white shadow-md shadow-accent/20"
              : "bg-muted text-foreground/60 hover:bg-accent/10 hover:text-accent"
          }`}
        >
          {filter}
        </button>
      ))}
    </div>
  );
}
