import { useMemo } from "react";
import { Pie } from "@visx/shape";
import { Group } from "@visx/group";
import { scaleOrdinal } from "@visx/scale";
import { Asset } from "@shared/schema";

interface AllocationChartProps {
  width: number;
  height: number;
  data: Array<{
    id: number;
    assetId: number;
    allocation: string;
    asset: Asset;
  }>;
}

const colors = [
  "#2563eb", // blue-600
  "#7c3aed", // violet-600
  "#db2777", // pink-600
  "#ea580c", // orange-600
  "#16a34a", // green-600
  "#7c2d12", // orange-900
  "#4f46e5", // indigo-600
  "#b91c1c", // red-700
];

export default function AllocationChart({ width, height, data }: AllocationChartProps) {
  // Create color scale
  const getColor = scaleOrdinal({
    domain: data.map(d => d.asset.symbol),
    range: colors,
  });

  // Calculate pie data
  const pieData = useMemo(() => {
    return data.map(item => ({
      ...item,
      value: parseFloat(item.allocation) || 0,
    }));
  }, [data]);

  // Setup dimensions
  const radius = Math.min(width, height) / 2;
  const centerY = height / 2;
  const centerX = width / 2;

  // Don't render if dimensions are invalid or no data
  if (width < 10 || height < 10 || !data.length) return null;

  return (
    <svg width={width} height={height}>
      <Group top={centerY} left={centerX}>
        <Pie
          data={pieData}
          pieValue={d => d.value}
          outerRadius={radius - 20}
          innerRadius={radius * 0.6}
          cornerRadius={3}
          padAngle={0.02}
        >
          {pie => {
            return pie.arcs.map(arc => {
              const [centroidX, centroidY] = pie.path.centroid(arc);
              const hasSpaceForLabel = arc.endAngle - arc.startAngle >= 0.1;
              const item = arc.data;

              return (
                <g key={`arc-${item.id}`}>
                  <path
                    d={pie.path(arc) || undefined}
                    fill={getColor(item.asset.symbol)}
                    className="transition-opacity duration-200"
                  />
                  {hasSpaceForLabel && (
                    <>
                      <text
                        x={centroidX}
                        y={centroidY - 8}
                        fill="white"
                        fontSize={12}
                        textAnchor="middle"
                        className="select-none font-medium"
                      >
                        {item.asset.symbol}
                      </text>
                      <text
                        x={centroidX}
                        y={centroidY + 8}
                        fill="white"
                        fontSize={10}
                        textAnchor="middle"
                        className="select-none"
                      >
                        {`${item.value.toFixed(1)}%`}
                      </text>
                    </>
                  )}
                </g>
              );
            });
          }}
        </Pie>
      </Group>
    </svg>
  );
}