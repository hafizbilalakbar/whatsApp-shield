import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';
import { cn } from './cn';

export function CustomDropdown({
  value,
  onChange,
  options = [],
  placeholder = 'Select...',
  searchable = false,
  className = '',
  optionRender,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const searchRef = useRef(null);

  const filtered = options.filter(opt => {
    if (!search) return true;
    const label = optionRender ? (typeof opt === 'string' ? opt : (opt.label || '')) : (typeof opt === 'string' ? opt : (opt.value || ''));
    return label.toLowerCase().includes(search.toLowerCase());
  });

  useEffect(() => {
    if (open && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 10);
    }
  }, [open]);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedLabel = optionRender
    ? optionRender(value)
    : (typeof value === 'string' ? value : (value?.label || value?.value || placeholder));

  return (
    <div className={cn('custom-dropdown relative inline-block', className)} ref={containerRef}>
      <button
        type="button"
        className={cn(
          'custom-dropdown-trigger',
          open && 'open'
        )}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="truncate">{selectedLabel || placeholder}</span>
        <ChevronDown className="chevron" size={14} />
      </button>
      {open && (
        <>
          <div className="dropdown-overlay" onClick={() => { setOpen(false); setSearch(''); }} />
          <div className="custom-dropdown-panel">
            {searchable && (
              <div className="custom-dropdown-search">
                <Search className="search-icon" size={14} />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Search..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            )}
            <div className="custom-dropdown-options">
              {filtered.length === 0 ? (
                <div className="custom-dropdown-option" style={{ opacity: 0.5 }}>
                  No results found
                </div>
              ) : (
                filtered.map((opt, idx) => {
                  const val = typeof opt === 'string' ? opt : (opt.value || opt);
                  const isSelected = val === value;
                  return (
                    <div
                      key={idx}
                      className={cn(
                        'custom-dropdown-option',
                        isSelected && 'selected'
                      )}
                      onClick={() => {
                        onChange(val);
                        setOpen(false);
                        setSearch('');
                      }}
                    >
                      <Check className="check-icon" size={16} />
                      <span className="option-label">
                        {optionRender ? optionRender(opt) : val}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
