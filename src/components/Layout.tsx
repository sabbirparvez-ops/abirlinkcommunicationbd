import React from "react";
import { useLocation, useNavigate, Link, Outlet } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { 
  LayoutDashboard, 
  PlusCircle, 
  MinusCircle, 
  CheckCircle, 
  Users, 
  FileBarChart, 
  BookOpen, 
  Settings as SettingsIcon,
  LogOut,
  Menu,
  X,
  Bell,
  Check,
  Calendar,
  ClipboardList,
  Package,
  ShoppingCart
} from "lucide-react";
import { cn } from "@/src/lib/utils";
import { Notification } from "@/src/types";
import { AwakeManager } from "./AwakeManager";

export const Layout: React.FC<{ user: any; onLogout: () => void }> = ({ user, onLogout }) => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const [isNotificationsOpen, setIsNotificationsOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [settings, setSettings] = React.useState<any>(null);
  const location = useLocation();
  const pathname = location.pathname;
  const navigate = useNavigate();

  if (!user) return null;

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings", {
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.warn("Settings fetch failed (expected during dev server restarts):", error);
      } else {
        console.error("Failed to fetch settings:", error);
      }
    }
  };

  const fetchNotifications = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const response = await fetch("/api/notifications", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
      }
    } catch (error) {
      // Only log error if it's not a transient network error during development
      if (process.env.NODE_ENV === "development") {
        console.warn("Notification fetch failed (expected during dev server restarts):", error);
      } else {
        console.error("Failed to fetch notifications:", error);
      }
    }
  };

  React.useEffect(() => {
    // Add a small delay for the first fetch to ensure server is ready
    const timeout = setTimeout(() => {
      fetchNotifications();
      fetchSettings();
    }, 1000);
    const interval = setInterval(fetchNotifications, 30000); // Poll every 30s
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch("/api/notifications/read-all", {
        method: "PUT",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/" },
    { icon: PlusCircle, label: "Add Income", path: "/income" },
    { icon: MinusCircle, label: "Add Expense", path: "/expense" },
    { icon: ClipboardList, label: "Requisition", path: "/requisition" },
    { icon: Package, label: "Inventory", path: "/inventory", roles: ["Admin", "Manager"] },
    { icon: CheckCircle, label: "Approvals", path: "/approvals", roles: ["Admin", "Manager"] },
    { icon: BookOpen, label: "Petty Cash", path: "/petty-cash" },
    { icon: FileBarChart, label: "Reports", path: "/reports" },
    { icon: Users, label: "Users", path: "/users", roles: ["Admin"] },
    { icon: SettingsIcon, label: "Settings", path: "/settings", roles: ["Admin"] },
  ];

  const filteredMenu = menuItems.filter(item => !item.roles || item.roles.includes(user.role));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex overflow-hidden">
      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            className="w-72 bg-slate-900/50 backdrop-blur-xl border-r border-white/5 flex flex-col z-50"
          >
            <div className="p-6 flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20 overflow-hidden">
                {settings?.logo ? (
                  <img src={settings.logo} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <FileBarChart className="text-white w-6 h-6" />
                )}
              </div>
              <div>
                <h1 className="font-bold text-white leading-tight truncate max-w-[160px]">
                  {settings?.companyName || "Abirlink CommunicationBD"}
                </h1>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Laser Book</p>
              </div>
            </div>

            <div className="px-6 py-4 mx-4 bg-white/5 rounded-2xl border border-white/5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600/20 rounded-lg">
                  <Calendar className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Today</p>
                  <p className="text-xs font-bold text-white">
                    {new Date().toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric', 
                      year: 'numeric',
                      weekday: 'short'
                    })}
                  </p>
                </div>
              </div>
            </div>

            <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
              {filteredMenu.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all group",
                    pathname === item.path
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <item.icon className={cn("w-5 h-5 transition-transform group-hover:scale-110", pathname === item.path ? "text-white" : "text-slate-500")} />
                  <span className="font-medium">{item.label}</span>
                </Link>
              ))}
            </nav>

            <div className="p-4 border-t border-white/5">
              <div className="bg-white/5 rounded-2xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                  {user.name?.[0] || user.username?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{user.name || user.username}</p>
                  <p className="text-[10px] text-slate-500 uppercase font-bold">{user.role}</p>
                </div>
                <button 
                  onClick={onLogout}
                  className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Header */}
        <header className="h-20 border-b border-white/5 flex items-center justify-between px-8 bg-slate-950/50 backdrop-blur-md z-40">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            >
              {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <h2 className="text-xl font-bold text-white">
              {filteredMenu.find(m => m.path === pathname)?.label || "Dashboard"}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden lg:block">
              <AwakeManager />
            </div>
            <div className="relative">
              <button 
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="p-2 text-slate-400 hover:text-white transition-colors relative"
              >
                <Bell className="w-6 h-6" />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-slate-950" />
                )}
              </button>

              <AnimatePresence>
                {isNotificationsOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setIsNotificationsOpen(false)} 
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-80 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden"
                    >
                      <div className="p-4 border-b border-white/5 flex items-center justify-between">
                        <h3 className="font-bold text-white">Notifications</h3>
                        {unreadCount > 0 && (
                          <button 
                            onClick={markAllAsRead}
                            className="text-[10px] text-blue-400 hover:text-blue-300 uppercase font-bold tracking-wider"
                          >
                            Mark all as read
                          </button>
                        )}
                      </div>
                      <div className="max-h-96 overflow-y-auto custom-scrollbar">
                        {notifications.length === 0 ? (
                          <div className="p-8 text-center">
                            <Bell className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-20" />
                            <p className="text-sm text-slate-500">No notifications yet</p>
                          </div>
                        ) : (
                          notifications.map((n) => (
                            <div 
                              key={n.id}
                              onClick={() => !n.read && markAsRead(n.id)}
                              className={cn(
                                "p-4 border-b border-white/5 cursor-pointer transition-colors hover:bg-white/5",
                                !n.read && "bg-blue-600/5"
                              )}
                            >
                              <div className="flex justify-between items-start mb-1">
                                <h4 className={cn("text-sm font-bold", n.read ? "text-slate-300" : "text-white")}>
                                  {n.title}
                                </h4>
                                {!n.read && <div className="w-2 h-2 bg-blue-500 rounded-full mt-1" />}
                              </div>
                              <p className="text-xs text-slate-400 line-clamp-2 mb-2">{n.message}</p>
                              <p className="text-[10px] text-slate-600 uppercase font-bold">
                                {new Date(n.date).toLocaleString()}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            <div className="h-8 w-[1px] bg-white/10 mx-2" />
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-white">{user.name || user.username}</p>
                <p className="text-[10px] text-slate-500 uppercase font-bold">{user.role}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-800 border border-white/10 flex items-center justify-center overflow-hidden">
                {user.photo ? (
                  <img src={user.photo} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg font-bold text-slate-400">{user.username[0].toUpperCase()}</span>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

    </div>
  );
};
