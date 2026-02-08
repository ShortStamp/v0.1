"use client";

import { FaceRegion } from "@/types";

interface FaceDiagramProps {
  onRegionClick: (region: FaceRegion) => void;
  selectedRegions: FaceRegion[];
}

const regions: { id: FaceRegion; label: string; cx: number; cy: number; rx: number; ry: number }[] = [
  { id: "brows", label: "Brows", cx: 150, cy: 105, rx: 55, ry: 12 },
  { id: "eyes", label: "Eyes", cx: 150, cy: 135, rx: 55, ry: 18 },
  { id: "lashes", label: "Lashes", cx: 150, cy: 155, rx: 55, ry: 10 },
  { id: "cheeks", label: "Cheeks", cx: 150, cy: 200, rx: 70, ry: 25 },
  { id: "lips", label: "Lips", cx: 150, cy: 250, rx: 35, ry: 15 },
  { id: "skin", label: "Skin", cx: 150, cy: 310, rx: 85, ry: 20 },
];

export default function FaceDiagram({ onRegionClick, selectedRegions }: FaceDiagramProps) {
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 300 360" className="h-[400px] w-[300px]">
        {/* Face outline */}
        <ellipse
          cx="150"
          cy="180"
          rx="110"
          ry="150"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-foreground/20"
        />

        {/* Clickable regions */}
        {regions.map((region) => {
          const isSelected = selectedRegions.includes(region.id);
          return (
            <g key={region.id}>
              <ellipse
                cx={region.cx}
                cy={region.cy}
                rx={region.rx}
                ry={region.ry}
                className={`cursor-pointer transition-colors ${
                  isSelected
                    ? "fill-accent/30 stroke-accent"
                    : "fill-accent/5 stroke-foreground/20 hover:fill-accent/15 hover:stroke-accent/50"
                }`}
                strokeWidth="1.5"
                onClick={() => onRegionClick(region.id)}
              />
              <text
                x={region.cx}
                y={region.cy + 4}
                textAnchor="middle"
                className={`pointer-events-none text-xs font-medium ${
                  isSelected ? "fill-accent" : "fill-foreground/50"
                }`}
              >
                {region.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
