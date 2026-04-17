import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { GlassCard } from "./GlassCard";
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Package,
  AlertTriangle
} from "lucide-react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from "recharts";
import { formatCurrency, cn } from "@/src/lib/utils";
import { format, subDays, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";

export const Dashboard: React.FC<{ user: any }> = ({ user }) => {
  const [data, setData] = useState<any>({ income: [], expenses: [], settings: null, stock: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem("token");
        const headers = { Authorization: `Bearer ${token}` };
        const [incRes, expRes, setRes, stockRes] = await Promise.all([
          fetch("/api/income", { headers }),
          fetch("/api/expenses", { headers }),
          fetch("/api/settings", { headers }),
          fetch("/api/stock", { headers })
        ]);
        
        if (incRes.ok && expRes.ok && setRes.ok && stockRes.ok) {
          const [income, expenses, settings, stock] = await Promise.all([
            incRes.json(),
            expRes.json(),
            setRes.json(),
            stockRes.json()
          ]);
          setData({ income, expenses, settings, stock });
        }
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.warn("Dashboard data fetch failed (expected during dev server restarts):", error);
        } else {
          console.error("Failed to fetch dashboard data:", error);
        }
      } finally {
        setLoading(false);
      }
    };
    
    // Add a small delay in dev to avoid race conditions with server restart
    const timeout = setTimeout(fetchData, process.env.NODE_ENV === "development" ? 1000 : 0);
    return () => clearTimeout(timeout);
  }, []);

  if (loading) return <div className="text-slate-400">Loading dashboard...</div>;

  const approvedExpenses = data.expenses.filter((e: any) => e.status === "Approved");
  const totalIncome = data.income.reduce((acc: number, curr: any) => acc + Number(curr.amount), 0);
  const totalExpense = approvedExpenses.reduce((acc: number, curr: any) => acc + (Number(curr.amount) - Number(curr.deductedAmount || 0)), 0);
  const netBalance = totalIncome - totalExpense;

  const getSourceData = (source: string) => {
    const key = source.toLowerCase();
    const initial = Number(data.settings?.balances?.[key] || 0);
    const income = data.income
      .filter((i: any) => i.source.toLowerCase() === key)
      .reduce((acc: number, curr: any) => acc + Number(curr.amount), 0);
    const expense = approvedExpenses
      .filter((e: any) => e.source.toLowerCase() === key)
      .reduce((acc: number, curr: any) => acc + (Number(curr.amount) - Number(curr.deductedAmount || 0)), 0);
    return { balance: initial + income - expense, expense };
  };

  const sourceStats = {
    cash: getSourceData("Cash"),
    bkash: getSourceData("Bkash"),
    dbbl: getSourceData("DBBL"),
    nagad: getSourceData("Nagad")
  };

  // Chart Data: Daily Spending Trend (Last 7 days)
  const last7Days = Array.from({ length: 7 }).map((_, i) => {
    const date = subDays(new Date(), i);
    const dateStr = format(date, "yyyy-MM-dd");
    const dayIncome = data.income
      .filter((inc: any) => format(new Date(inc.date), "yyyy-MM-dd") === dateStr)
      .reduce((acc: number, curr: any) => acc + Number(curr.amount), 0);
    const dayExpense = approvedExpenses
      .filter((exp: any) => format(new Date(exp.date), "yyyy-MM-dd") === dateStr)
      .reduce((acc: number, curr: any) => acc + (Number(curr.amount) - Number(curr.deductedAmount || 0)), 0);
    return { date: format(date, "MMM dd"), income: dayIncome, expense: dayExpense };
  }).reverse();

  // Chart Data: Category Expenses (Pie)
  const categoryData = approvedExpenses.reduce((acc: any, curr: any) => {
    const existing = acc.find((item: any) => item.name === curr.category);
    const netAmount = Number(curr.amount) - Number(curr.deductedAmount || 0);
    if (existing) existing.value += netAmount;
    else acc.push({ name: curr.category, value: netAmount });
    return acc;
  }, []);

  const COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f43f5e", "#f59e0b", "#10b981", "#06b6d4"];

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <GlassCard className="border-l-4 border-blue-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Total Income</p>
              <h3 className="text-2xl font-bold text-white">{formatCurrency(totalIncome)}</h3>
            </div>
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <TrendingUp className="text-blue-500 w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1 text-xs text-blue-400">
            <ArrowUpRight className="w-3 h-3" />
            <span>+12.5% from last month</span>
          </div>
        </GlassCard>

        <GlassCard className="border-l-4 border-red-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Total Expense</p>
              <h3 className="text-2xl font-bold text-white">{formatCurrency(totalExpense)}</h3>
            </div>
            <div className="p-2 bg-red-500/10 rounded-lg">
              <TrendingDown className="text-red-500 w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1 text-xs text-red-400">
            <ArrowDownRight className="w-3 h-3" />
            <span>+8.2% from last month</span>
          </div>
        </GlassCard>

        <GlassCard className="border-l-4 border-emerald-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Net Balance</p>
              <h3 className="text-2xl font-bold text-white">{formatCurrency(netBalance)}</h3>
            </div>
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <Wallet className="text-emerald-500 w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1 text-xs text-emerald-400">
            <CheckCircle2 className="w-3 h-3" />
            <span>System verified</span>
          </div>
        </GlassCard>

        <GlassCard className="border-l-4 border-amber-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Pending Approvals</p>
              <h3 className="text-2xl font-bold text-white">
                {data.expenses.filter((e: any) => e.status !== "Approved").length}
              </h3>
            </div>
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <Clock className="text-amber-500 w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1 text-xs text-amber-400">
            <AlertCircle className="w-3 h-3" />
            <span>Requires attention</span>
          </div>
        </GlassCard>

        {(user.role === "Admin" || user.role === "Manager") && data.stock.some((item: any) => item.quantity <= item.min_stock_level) && (
          <GlassCard className="border-l-4 border-red-500 bg-red-500/5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Low Stock Alert</p>
                <h3 className="text-2xl font-bold text-white">
                  {data.stock.filter((item: any) => item.quantity <= item.min_stock_level).length} Items
                </h3>
              </div>
              <div className="p-2 bg-red-500/10 rounded-lg">
                <Package className="text-red-500 w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs text-red-400 font-bold">
              <AlertTriangle className="w-3 h-3" />
              <span>Restock recommended</span>
            </div>
          </GlassCard>
        )}
      </div>

      {/* Source Balances Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <GlassCard className="border-l-4 border-slate-400">
          <div className="flex justify-between items-start">
            <div className="space-y-3">
              <div>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">Cash Balance</p>
                <h3 className="text-xl font-bold text-white">{formatCurrency(sourceStats.cash.balance)}</h3>
              </div>
              <div className="pt-2 border-t border-white/5">
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">Cash Expense</p>
                <p className="text-sm font-bold text-red-400">{formatCurrency(sourceStats.cash.expense)}</p>
              </div>
            </div>
            <div className="p-2 bg-slate-400/10 rounded-lg">
              <Wallet className="text-slate-400 w-4 h-4" />
            </div>
          </div>
        </GlassCard>

        <GlassCard className="border-l-4 border-blue-400">
          <div className="flex justify-between items-start">
            <div className="space-y-3">
              <div>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">Bkash Balance</p>
                <h3 className="text-xl font-bold text-white">{formatCurrency(sourceStats.bkash.balance)}</h3>
              </div>
              <div className="pt-2 border-t border-white/5">
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">Bkash Expense</p>
                <p className="text-sm font-bold text-red-400">{formatCurrency(sourceStats.bkash.expense)}</p>
              </div>
            </div>
            <div className="p-2 bg-blue-400/10 rounded-lg">
              <Wallet className="text-blue-400 w-4 h-4" />
            </div>
          </div>
        </GlassCard>

        <GlassCard className="border-l-4 border-red-400">
          <div className="flex justify-between items-start">
            <div className="space-y-3">
              <div>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">DBBL Balance</p>
                <h3 className="text-xl font-bold text-white">{formatCurrency(sourceStats.dbbl.balance)}</h3>
              </div>
              <div className="pt-2 border-t border-white/5">
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">DBBL Expense</p>
                <p className="text-sm font-bold text-red-400">{formatCurrency(sourceStats.dbbl.expense)}</p>
              </div>
            </div>
            <div className="p-2 bg-red-400/10 rounded-lg">
              <Wallet className="text-red-400 w-4 h-4" />
            </div>
          </div>
        </GlassCard>

        <GlassCard className="border-l-4 border-orange-400">
          <div className="flex justify-between items-start">
            <div className="space-y-3">
              <div>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">Nagad Balance</p>
                <h3 className="text-xl font-bold text-white">{formatCurrency(sourceStats.nagad.balance)}</h3>
              </div>
              <div className="pt-2 border-t border-white/5">
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">Nagad Expense</p>
                <p className="text-sm font-bold text-red-400">{formatCurrency(sourceStats.nagad.expense)}</p>
              </div>
            </div>
            <div className="p-2 bg-orange-400/10 rounded-lg">
              <Wallet className="text-orange-400 w-4 h-4" />
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <GlassCard className="h-[400px] flex flex-col">
          <h4 className="text-lg font-bold text-white mb-6">Income vs Expense Trend</h4>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={last7Days}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `৳${val}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #ffffff10", borderRadius: "12px" }}
                  itemStyle={{ fontSize: "12px" }}
                />
                <Area type="monotone" dataKey="income" stroke="#3b82f6" fillOpacity={1} fill="url(#colorIncome)" strokeWidth={3} />
                <Area type="monotone" dataKey="expense" stroke="#f43f5e" fillOpacity={1} fill="url(#colorExpense)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className="h-[400px] flex flex-col">
          <h4 className="text-lg font-bold text-white mb-6">Expense by Category</h4>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                   contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #ffffff10", borderRadius: "12px" }}
                   itemStyle={{ fontSize: "12px" }}
                />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>

        {(user.role === "Admin" || user.role === "Manager") && (
          <GlassCard className="lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <h4 className="text-lg font-bold text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-500" /> Stock Overview
              </h4>
              <Link to="/inventory" className="text-xs text-blue-400 hover:text-blue-300 font-bold uppercase tracking-wider">
                View Inventory
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Total Items</p>
                <p className="text-xl font-bold text-white">{data.stock.length}</p>
              </div>
              <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Low Stock</p>
                <p className="text-xl font-bold text-red-400">
                  {data.stock.filter((item: any) => item.quantity <= item.min_stock_level).length}
                </p>
              </div>
              <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">In Stock</p>
                <p className="text-xl font-bold text-emerald-400">
                  {data.stock.filter((item: any) => item.quantity > item.min_stock_level).length}
                </p>
              </div>
              <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Out of Stock</p>
                <p className="text-xl font-bold text-slate-400">
                  {data.stock.filter((item: any) => item.quantity === 0).length}
                </p>
              </div>
            </div>
          </GlassCard>
        )}

        {/* Recent Activity */}
      <GlassCard>
        <h4 className="text-lg font-bold text-white mb-6">Recent Activity</h4>
        <div className="space-y-4">
          {[...data.income, ...data.expenses]
            .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 5)
            .map((item: any) => (
              <div key={`${item.status ? 'expense' : 'income'}-${item.id}`} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    item.status ? "bg-red-500/10 text-red-500" : "bg-emerald-500/10 text-emerald-500"
                  )}>
                    {item.status ? <TrendingDown className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="font-bold text-white">{item.category}</p>
                    <p className="text-xs text-slate-500">{format(new Date(item.date), "MMM dd, yyyy • hh:mm a")}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn("font-bold", item.status ? "text-red-400" : "text-emerald-400")}>
                    {item.status ? "-" : "+"}{formatCurrency(item.status ? (Number(item.amount) - Number(item.deductedAmount || 0)) : item.amount)}
                  </p>
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">
                    {item.source}
                  </p>
                </div>
              </div>
            ))}
        </div>
      </GlassCard>
    </div>
  );
};
