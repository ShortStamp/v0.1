"use client";

interface FilterBarProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

const filters = ["All Trends", "For You"];

export default function FilterBar({ activeFilter, onFilterChange }: FilterBarProps) {
  return (
    <div className="flex gap-3">
      {filters.map((filter) => (
        <button
          key={filter}
          onClick={() => onFilterChange(filter)}
<<<<<<< Updated upstream
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            activeFilter === filter
              ? "bg-accent text-white shadow-md shadow-accent/20"
              : "bg-muted text-foreground/60 hover:bg-accent/10 hover:text-accent"
=======
          className={`rounded-full px-6 py-2.5 text-[11px] font-bold uppercase tracking-[0.15em] transition-all duration-300 font-sans ${
            activeFilter === filter
              ? "bg-accent text-white shadow-lg shadow-accent/20"
              : "bg-white text-foreground/40 hover:bg-muted hover:text-foreground border border-border/50"
>>>>>>> Stashed changes
          }`}
        >
          {filter}
        </button>
      ))}
    </div>
  );
}
