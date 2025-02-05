import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface PricePoint {
  timestamp: number;
  price: number;
}

interface PriceChartProps {
  data: PricePoint[];
  symbol: string;
}

export default function PriceChart({ data, symbol }: PriceChartProps) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{symbol} Price History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <XAxis
                dataKey="timestamp"
                tickFormatter={(timestamp) => 
                  new Date(timestamp).toLocaleDateString()
                }
              />
              <YAxis
                tickFormatter={(value) => 
                  `$${value.toLocaleString()}`
                }
              />
              <Tooltip
                labelFormatter={(label) => 
                  new Date(label).toLocaleString()
                }
                formatter={(value: number) => 
                  [`$${value.toLocaleString()}`, "Price"]
                }
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
