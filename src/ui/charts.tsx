import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatMoneyShort } from '../lib/money';
import { useSettings, useThemeColors } from '../state/settings';
import { prefersReducedMotion } from '../lib/motion';

/** Charts grow in once when shown (and smoothly morph when data changes). */
const anim = () => ({ isAnimationActive: !prefersReducedMotion(), animationDuration: 900, animationEasing: 'ease-out' as const });

interface BarDatum {
  label: string;
  value: number; // kuruş
  highlight?: boolean;
}

function useTooltipStyle() {
  const c = useThemeColors();
  return {
    contentStyle: { background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, fontSize: 13, color: c.text },
    labelStyle: { color: c.muted, marginBottom: 2 },
    itemStyle: { color: c.text },
    cursor: { fill: c.grid, opacity: 0.6 },
  };
}

export function SpendBars({ data, height = 180, color }: { data: BarDatum[]; height?: number; color?: string }) {
  const c = useThemeColors();
  const { money } = useSettings();
  const tt = useTooltipStyle();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={c.grid} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: c.muted, fontSize: 11 }} interval="preserveStartEnd" minTickGap={4} />
        <YAxis tickLine={false} axisLine={false} tick={{ fill: c.muted, fontSize: 11 }} tickFormatter={(v: number) => formatMoneyShort(v)} width={44} />
        <Tooltip {...tt} formatter={(v) => [money(Number(v)), 'Harcama']} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={28} {...anim()} animationBegin={150}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.highlight ? (color ?? c.accent) : `${color ?? c.accent}99`} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function IncomeExpenseBars({ data, height = 200 }: { data: { label: string; income: number; expense: number }[]; height?: number }) {
  const c = useThemeColors();
  const { money } = useSettings();
  const tt = useTooltipStyle();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={c.grid} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: c.muted, fontSize: 11 }} />
        <YAxis tickLine={false} axisLine={false} tick={{ fill: c.muted, fontSize: 11 }} tickFormatter={(v: number) => formatMoneyShort(v)} width={44} />
        <Tooltip {...tt} formatter={(v, name) => [money(Number(v)), name === 'income' ? 'Gelir' : 'Gider']} />
        <Legend formatter={(v) => (v === 'income' ? 'Gelir' : 'Gider')} wrapperStyle={{ fontSize: 12, color: c.muted }} iconType="circle" iconSize={8} />
        <Bar dataKey="income" fill={c.pos} radius={[4, 4, 0, 0]} maxBarSize={18} {...anim()} animationBegin={100} />
        <Bar dataKey="expense" fill={c.neg} radius={[4, 4, 0, 0]} maxBarSize={18} {...anim()} animationBegin={250} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Donut({ data, height = 200, valueFormatter }: { data: { name: string; value: number; color: string }[]; height?: number; valueFormatter?: (v: number) => string }) {
  const c = useThemeColors();
  const { money } = useSettings();
  const tt = useTooltipStyle();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="90%" paddingAngle={data.length > 1 ? 2 : 0} stroke={c.card} strokeWidth={2} {...anim()} animationDuration={1100} animationBegin={120} cornerRadius={4}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color} />
          ))}
        </Pie>
        <Tooltip {...tt} formatter={(v, n) => [(valueFormatter ?? money)(Number(v)), String(n)]} />
      </PieChart>
    </ResponsiveContainer>
  );
}
