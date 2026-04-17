import React, { useState, useEffect } from "react";
import { GlassCard } from "./GlassCard";
import { Settings as SettingsIcon, Building, Wallet, Trash2, RefreshCw, Upload, Database, Globe, Copy, Check } from "lucide-react";
import { formatCurrency, cn } from "@/src/lib/utils";
import { DatabaseStatus } from "./DatabaseStatus";

export const Settings: React.FC<{ user: any }> = ({ user }) => {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const wpPluginCode = `<?php
/**
 * Plugin Name: Abirlink ERP Embed
 * Description: Embeds the Abirlink ERP application into your WordPress site using a simple shortcode.
 * Version: 1.0.0
 * Author: Abirlink CommunicationBD
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

/**
 * Register the shortcode [abirlink_erp]
 */
function abirlink_erp_shortcode( $atts ) {
	// Default attributes
	$atts = shortcode_atts(
		array(
			'url'    => '${window.location.origin}',
			'height' => '800px',
			'width'  => '100%',
		),
		$atts,
		'abirlink_erp'
	);

	// Sanitize URL
	$url = esc_url( $atts['url'] );
	$height = esc_attr( $atts['height'] );
	$width = esc_attr( $atts['width'] );

	// Output the iframe
	$output = '<div class="abirlink-erp-container" style="width: ' . $width . '; height: ' . $height . '; overflow: hidden; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); border: 1px solid rgba(255,255,255,0.1);">';
	$output .= '<iframe src="' . $url . '" style="width: 100%; height: 100%; border: none;" allow="camera; microphone; geolocation; screen-wake-lock; wake-lock" allowfullscreen></iframe>';
	$output .= '</div>';

	return $output;
}
add_shortcode( 'abirlink_erp', 'abirlink_erp_shortcode' );
`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(wpPluginCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
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
      } finally {
        setLoading(false);
      }
    };
    
    // Add a small delay in dev to avoid race conditions with server restart
    const timeout = setTimeout(fetchSettings, process.env.NODE_ENV === "development" ? 1000 : 0);
    return () => clearTimeout(timeout);
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("token")}`
      },
      body: JSON.stringify(settings),
    });
    if (res.ok) {
      setSaving(false);
      alert("Settings saved successfully!");
      window.location.reload();
    }
  };

  const handleReset = async () => {
    if (!confirm("CRITICAL: This will delete ALL data (Income, Expenses, Inventory, Requisitions, etc.) and reset balances to zero. This action cannot be undone. Are you sure?")) return;
    const res = await fetch("/api/admin/reset", {
      method: "POST",
      headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
    });
    if (res.ok) {
      alert("System data reset successfully!");
      window.location.reload();
    } else {
      alert("Failed to reset system data.");
    }
  };

  if (loading) return <div className="text-slate-400">Loading settings...</div>;

  const netBalance = (Object.values(settings.balances) as number[]).reduce((a: number, b: number) => a + Number(b), 0);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-bold text-white">Admin Settings</h3>
          <p className="text-slate-500">Configure company profile and initial balances</p>
        </div>
        <button
          onClick={handleReset}
          className="bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 border border-red-600/20 transition-all"
        >
          <RefreshCw className="w-5 h-5" /> Reset System Data
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Company Info */}
          <GlassCard className="space-y-6">
            <h4 className="text-lg font-bold text-white flex items-center gap-2">
              <Building className="text-blue-500 w-5 h-5" /> Company Profile
            </h4>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Company Name</label>
                <input
                  type="text"
                  value={settings.companyName}
                  onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Company Logo</label>
                <div className="flex flex-col gap-4">
                  <div className="flex gap-3 items-center">
                    <div className="w-16 h-16 bg-slate-800 rounded-xl border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {settings.logo ? (
                        <img src={settings.logo} className="w-full h-full object-contain" alt="Logo Preview" />
                      ) : (
                        <Building className="text-slate-600 w-8 h-8" />
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="relative group">
                        <input
                          type="file"
                          accept="image/png, image/jpeg"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              // Validate file type
                              const validTypes = ["image/jpeg", "image/png", "image/jpg"];
                              if (!validTypes.includes(file.type)) {
                                alert("Please upload a JPEG or PNG image.");
                                return;
                              }

                              // Validate file size (3MB)
                              if (file.size > 3 * 1024 * 1024) {
                                alert("File size must be less than 3MB");
                                return;
                              }
                              
                              const reader = new FileReader();
                              reader.onloadend = async () => {
                                try {
                                  const uploadRes = await fetch("/api/upload", {
                                    method: "POST",
                                    headers: { 
                                      "Content-Type": "application/json",
                                      "Authorization": `Bearer ${localStorage.getItem("token")}`
                                    },
                                    body: JSON.stringify({ image: reader.result, filename: file.name }),
                                  });
                                  if (uploadRes.ok) {
                                    const { url } = await uploadRes.json();
                                    setSettings({ ...settings, logo: url });
                                  } else {
                                    alert("Upload failed. Please try again.");
                                  }
                                } catch (err) {
                                  console.error("Upload error:", err);
                                  alert("Upload error. Please try again.");
                                }
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className="w-full bg-white/5 border border-dashed border-white/20 rounded-xl py-3 px-4 text-slate-400 flex items-center justify-center gap-2 group-hover:border-blue-500/50 group-hover:bg-blue-500/5 transition-all">
                          <Upload className="w-4 h-4" />
                          <span className="text-sm font-medium">Upload New Logo (PNG/JPG - Max 3MB)</span>
                        </div>
                      </div>
                      {settings.logo && (
                        <button
                          type="button"
                          onClick={() => setSettings({ ...settings, logo: null })}
                          className="text-[10px] font-bold text-red-500 uppercase tracking-widest hover:text-red-400 transition-colors ml-1"
                        >
                          Remove Logo
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-widest ml-1">Or Logo URL</label>
                    <input
                      type="text"
                      value={settings.logo || ""}
                      onChange={(e) => setSettings({ ...settings, logo: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      placeholder="https://..."
                    />
                  </div>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Initial Balances */}
          <GlassCard className="space-y-6">
            <h4 className="text-lg font-bold text-white flex items-center gap-2">
              <Wallet className="text-emerald-500 w-5 h-5" /> Initial Balances
            </h4>
            
            <div className="grid grid-cols-2 gap-4">
              {Object.keys(settings.balances).map((key) => (
                <div key={key} className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">{key} Balance</label>
                  <input
                    type="number"
                    value={settings.balances[key]}
                    onChange={(e) => setSettings({ 
                      ...settings, 
                      balances: { ...settings.balances, [key]: e.target.value } 
                    })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-white/5">
              <div className="flex justify-between items-center">
                <p className="text-sm font-bold text-slate-400">Total Net Balance</p>
                <p className="text-xl font-bold text-emerald-400">{formatCurrency(netBalance)}</p>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* WordPress Integration */}
        <GlassCard className="space-y-6">
          <div className="flex justify-between items-start">
            <h4 className="text-lg font-bold text-white flex items-center gap-2">
              <Globe className="text-indigo-500 w-5 h-5" /> WordPress Integration
            </h4>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={copyToClipboard}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-bold text-slate-300 transition-all"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied!" : "Copy Plugin Code"}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-sm text-slate-400 leading-relaxed">
              To embed this ERP into your WordPress site, create a new file named <code className="text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">abirlink-erp.php</code> in your WordPress <code className="text-slate-300">wp-content/plugins/</code> directory and paste the code below.
            </p>
            
            <div className="relative group">
              <pre className="bg-slate-950/50 border border-white/5 rounded-xl p-4 text-[11px] font-mono text-slate-400 overflow-x-auto max-h-[300px] scrollbar-thin scrollbar-thumb-white/10">
                {wpPluginCode}
              </pre>
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="p-2 bg-slate-900 border border-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 space-y-3">
              <h5 className="text-xs font-bold text-blue-400 uppercase tracking-wider">How to use:</h5>
              <ol className="text-xs text-slate-400 space-y-2 list-decimal ml-4">
                <li>Upload the file to your WordPress plugins folder.</li>
                <li>Activate the plugin from the WordPress Dashboard.</li>
                <li>Use the shortcode <code className="text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">[abirlink_erp]</code> on any page or post.</li>
                <li>You can customize the height: <code className="text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">[abirlink_erp height="1000px"]</code></li>
              </ol>
            </div>
          </div>
        </GlassCard>

        {/* Database Status */}
        <DatabaseStatus />

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-xl shadow-blue-600/20 transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {saving ? "Saving Changes..." : "Save All Settings"}
        </button>
      </form>
    </div>
  );
};
