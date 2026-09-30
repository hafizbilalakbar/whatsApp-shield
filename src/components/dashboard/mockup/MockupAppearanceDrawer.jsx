import React from 'react';
import { Palette, Moon, Sun, Sparkles, Check, Type, Smartphone } from 'lucide-react';
import { FINISH_PROFILES } from './IosDeviceFrame';

const ACCENT_SWATCHES = [
  { name: 'iOS Blue', color: '#0A84FF' },
  { name: 'Emerald', color: '#34C759' },
  { name: 'Indigo', color: '#5856D6' },
  { name: 'Orange', color: '#FF9500' },
  { name: 'Purple', color: '#AF52DE' },
  { name: 'Teal', color: '#30B0C7' },
  { name: 'Rose', color: '#FF2D55' }
];

export function MockupAppearanceDrawer({
  isOpen,
  onClose,
  settings,
  onUpdateSettings
}) {
  if (!isOpen) return null;

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-50 bg-[#121824]/95 backdrop-blur-xl border-t border-white/10 p-4 rounded-t-2xl shadow-2xl animate-fade-in flex flex-col gap-4 text-xs select-none max-h-[85%] overflow-y-auto"
      style={{ scrollbarWidth: 'none' }}
    >
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="flex items-center gap-1.5 font-bold text-white text-sm">
          <Palette size={15} className="text-emerald-400" />
          Appearance Settings
        </div>
        <button
          onClick={onClose}
          className="text-white/40 hover:text-white text-xs px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 transition-colors"
        >
          Done
        </button>
      </div>

      {/* 1. Campaign Title */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-semibold text-white/70 flex items-center gap-1">
          <Type size={12} className="text-white/40" /> Campaign Title
        </label>
        <input
          type="text"
          value={settings.campaignTitle || 'Lead Finder'}
          onChange={(e) => onUpdateSettings({ campaignTitle: e.target.value })}
          placeholder="e.g. Lead Finder"
          className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-white placeholder:text-white/30 text-xs focus:outline-none focus:border-emerald-500/50"
        />
      </div>

      {/* 2. Device Finish Presets */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-semibold text-white/70 flex items-center gap-1">
          <Smartphone size={12} className="text-white/40" /> Titanium Finish
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {Object.entries(FINISH_PROFILES).map(([key, item]) => {
            const isSelected = (settings.finish || 'graphite') === key;
            return (
              <button
                key={key}
                onClick={() => onUpdateSettings({ finish: key })}
                className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-white'
                    : 'border-white/5 bg-white/[0.03] text-white/60 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span
                  className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/20"
                  style={{ background: item.outerEdge }}
                />
                <span className="truncate font-medium">{item.name}</span>
                {isSelected && <Check size={12} className="text-emerald-400 ml-auto shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. iOS Theme Mode (Dark / Light) */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-semibold text-white/70 flex items-center gap-1">
          Theme Mode
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onUpdateSettings({ theme: 'dark' })}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg border font-medium transition-all ${
              settings.theme !== 'light'
                ? 'border-emerald-500/50 bg-emerald-500/10 text-white'
                : 'border-white/5 bg-white/[0.03] text-white/60 hover:bg-white/5'
            }`}
          >
            <Moon size={13} /> Dark (OLED #000)
          </button>
          <button
            onClick={() => onUpdateSettings({ theme: 'light' })}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg border font-medium transition-all ${
              settings.theme === 'light'
                ? 'border-emerald-500/50 bg-emerald-500/10 text-white'
                : 'border-white/5 bg-white/[0.03] text-white/60 hover:bg-white/5'
            }`}
          >
            <Sun size={13} /> Light (#F2F2F7)
          </button>
        </div>
      </div>

      {/* 4. Accent Color */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-semibold text-white/70 flex items-center gap-1">
          Accent Tint
        </label>
        <div className="flex items-center gap-2 flex-wrap">
          {ACCENT_SWATCHES.map((swatch) => {
            const isSelected = (settings.accentColor || '#0A84FF').toLowerCase() === swatch.color.toLowerCase();
            return (
              <button
                key={swatch.color}
                onClick={() => onUpdateSettings({ accentColor: swatch.color })}
                title={swatch.name}
                className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all ${
                  isSelected ? 'border-white ring-2 ring-emerald-400 scale-110' : 'border-transparent opacity-80 hover:opacity-100'
                }`}
                style={{ backgroundColor: swatch.color }}
              >
                {isSelected && <Check size={11} className="text-white drop-shadow" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Animation Intensity */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-semibold text-white/70 flex items-center gap-1">
          <Sparkles size={12} className="text-white/40" /> Animation Intensity
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {['subtle', 'balanced', 'vivid'].map((level) => {
            const isSelected = (settings.intensity || 'balanced') === level;
            return (
              <button
                key={level}
                onClick={() => onUpdateSettings({ intensity: level })}
                className={`py-1.5 rounded-lg border capitalize font-medium transition-all ${
                  isSelected
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-white'
                    : 'border-white/5 bg-white/[0.03] text-white/50 hover:bg-white/5'
                }`}
              >
                {level}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default MockupAppearanceDrawer;
