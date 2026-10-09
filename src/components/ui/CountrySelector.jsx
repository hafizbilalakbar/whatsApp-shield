import React, { useState, useMemo } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';
import { countries, getCountryByCallingCode, getCountryByIso } from '../../data/countries';
import { SvgFlag } from './SvgFlag';
import { cn } from './cn';

const CountrySelector = ({
  selectedCountryIso,
  onSelect,
  onSelectCountry,
  className
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const selectedCountry = useMemo(() => {
    return getCountryByIso(selectedCountryIso);
  }, [selectedCountryIso]);

  const filteredCountries = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return countries;
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.code.includes(term) ||
        c.iso.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  const handleSelect = (country) => {
    onSelect(country.iso.toUpperCase());
    onSelectCountry?.(country);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-10 w-full items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-sm hover:bg-surface/80 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all"
      >
        <div className="flex items-center gap-2 min-w-0">
          {selectedCountry ? (
            <>
              <SvgFlag code={selectedCountry.iso.toUpperCase()} width={20} className="shrink-0" />
              <span className="font-medium text-text-primary truncate max-w-[140px] sm:max-w-none">
                {selectedCountry.name}
              </span>
              <span className="text-text-muted shrink-0">+{selectedCountry.code}</span>
            </>
          ) : (
            <span className="text-text-muted">Select Country</span>
          )}
        </div>
        <ChevronDown className="h-4 w-4 opacity-50 text-text-secondary shrink-0 ml-1" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-full z-50 rounded-md border border-border bg-surface shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center border-b border-border px-3 py-2 bg-background">
              <Search className="h-4 w-4 text-text-muted mr-2 shrink-0" />
              <input
                type="text"
                placeholder="Search country or code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-transparent text-sm focus:outline-none text-text-primary placeholder:text-text-muted"
                autoFocus
              />
            </div>
            <div className="max-h-60 overflow-y-auto py-1 custom-scrollbar">
              {filteredCountries.length === 0 ? (
                <div className="px-3 py-4 text-center text-sm text-text-muted">
                  No countries found.
                </div>
              ) : (
                filteredCountries.map((country) => {
                  const isSelected =
                    selectedCountry &&
                    country.iso.toLowerCase() === selectedCountry.iso.toLowerCase();
                  return (
                    <button
                      key={`${country.iso}-${country.code}`}
                      type="button"
                      onClick={() => handleSelect(country)}
                      className={cn(
                        'flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-background/80 transition-colors text-left',
                        isSelected && 'bg-primary/10 text-primary font-semibold hover:bg-primary/20'
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <SvgFlag code={country.iso.toUpperCase()} width={20} className="shrink-0" />
                        <span className="truncate">{country.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <span className="text-text-muted text-xs">+{country.code}</span>
                        {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CountrySelector;
