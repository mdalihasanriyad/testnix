import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";

export type ChartTestPoint = {
  at: number;
  label: string;
  download: number;
  upload: number;
  ping: number;
};

export function SpeedTrendChart({ data }: { data: ChartTestPoint[] }) {
  if (!data.length) return null;

  return (
    <div className="w-full h-72 sm:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#e5e5e5" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: "#737373" }}
            axisLine={{ stroke: "#d4d4d4" }}
            tickLine={{ stroke: "#d4d4d4" }}
          />
          <YAxis
            yAxisId="speed"
            tick={{ fontSize: 12, fill: "#737373" }}
            axisLine={{ stroke: "#d4d4d4" }}
            tickLine={{ stroke: "#d4d4d4" }}
            label={{
              value: "Mbps",
              angle: -90,
              position: "insideLeft",
              offset: 10,
              fill: "#737373",
              fontSize: 12,
            }}
          />
          <YAxis
            yAxisId="ping"
            orientation="right"
            tick={{ fontSize: 12, fill: "#737373" }}
            axisLine={{ stroke: "#d4d4d4" }}
            tickLine={{ stroke: "#d4d4d4" }}
            label={{
              value: "Ping (ms)",
              angle: 90,
              position: "insideRight",
              offset: 10,
              fill: "#737373",
              fontSize: 12,
            }}
          />
          <Tooltip
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid #e5e5e5",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              fontSize: 12,
            }}
          formatter={(
            value: number | string | Array<number | string>,
            name: string | number,
          ) => {
            if (name === "Ping") return [`${value} ms`, name];
            return [`${value} Mbps`, name];
          }}
          labelFormatter={(label: string | number) => label}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 16 }} />
          <Line
            yAxisId="speed"
            type="monotone"
            dataKey="download"
            name="Download"
            stroke="#171717"
            strokeWidth={2.5}
            dot={{ r: 4, fill: "#171717" }}
            activeDot={{ r: 6 }}
          />
          <Line
            yAxisId="speed"
            type="monotone"
            dataKey="upload"
            name="Upload"
            stroke="#E5E5E5"
            strokeWidth={2.5}
            dot={{ r: 4, fill: "#E5E5E5" }}
            activeDot={{ r: 6 }}
            strokeDasharray="5 5"
          />
          <Line
            yAxisId="ping"
            type="monotone"
            dataKey="ping"
            name="Ping"
            stroke="#ef4444"
            strokeWidth={2}
            dot={{ r: 3, fill: "#ef4444" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
