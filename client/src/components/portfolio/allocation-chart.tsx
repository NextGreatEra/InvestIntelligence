import { useMemo, useState } from "react";
import { Pie } from "@visx/shape";
import { Group } from "@visx/group";
import { motion } from "framer-motion";
import { useDrag } from "@use-gesture/react";
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
  onAllocationChange?: (id: number, newAllocation: number) => void;
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

export default function AllocationChart({ width, height, data, onAllocationChange }: AllocationChartProps) {
  const [dragging, setDragging] = useState<number | null>(null);

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

  // Handle drag gesture
  const bindDrag = useDrag(({ movement: [mx, my], first, last, active, event }) => {
    event?.preventDefault();
    if (first) setDragging(null);

    if (active && dragging !== null) {
      const currentItem = pieData.find(d => d.id === dragging);
      if (!currentItem || !onAllocationChange) return;

      const dragAngle = Math.atan2(my, mx);
      const dragDistance = Math.sqrt(mx * mx + my * my);

      // Convert drag movement to allocation change
      const allocationChange = (dragDistance * Math.cos(dragAngle)) / (radius * 2);
      const newAllocation = Math.max(0, Math.min(100, currentItem.value + allocationChange * 100));

      onAllocationChange(dragging, newAllocation);
    }

    if (last) setDragging(null);
  });

  // Don't render if dimensions are invalid
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
                <motion.g
                  key={`arc-${item.id}`}
                  onMouseDown={() => setDragging(item.id)}
                  className="cursor-pointer"
                  {...bindDrag()}
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <path
                    d={pie.path(arc) || undefined}
                    fill={getColor(item.asset.symbol)}
                    className={`transition-all duration-200 ${
                      dragging === item.id ? 'opacity-80' : 'opacity-100'
                    }`}
                  />
                  {hasSpaceForLabel && (
                    <>
                      <text
                        x={centroidX}
                        y={centroidY - 8}
                        fill="white"
                        fontSize={12}
                        textAnchor="middle"
                        className="select-none pointer-events-none font-medium"
                      >
                        {item.asset.symbol}
                      </text>
                      <text
                        x={centroidX}
                        y={centroidY + 8}
                        fill="white"
                        fontSize={10}
                        textAnchor="middle"
                        className="select-none pointer-events-none"
                      >
                        {`${item.value.toFixed(1)}%`}
                      </text>
                    </>
                  )}
                </motion.g>
              );
            });
          }}
        </Pie>
      </Group>
    </svg>
  );
}