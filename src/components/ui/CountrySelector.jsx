import React, { useState, useMemo } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';
import { countries } from '../../data/countries';
import { cn } from './cn';

const CountrySelector = ({ selectedCountryCode, onSelect, className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const selectedCountry = useMemo(() => {
    return countries.find(c => c.code === selectedCountryCode) || null;
  }, [selectedCountryCode]);

  const filteredCountries = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return countries.filter(
      c => c.name.toLowerCase().includes(term) || c.code.includes(term)
    );
  }, [searchTerm]);

  const handleSelect = (country) => {
    onSelect(country.code);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-10 w-full items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-sm hover:bg-surface/80 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all"
      >
        <div className="flex items-center gap-2">
          {selectedCountry ? (
            <>
              <img
                src={`https://flagcdn.com/w20/${selectedCountry.iso}.png`}
                srcSet={`https://flagcdn.com/w40/${selectedCountry.iso}.png 2x`}
                width="20"
                alt={selectedCountry.name}
                className="inline-block rounded-sm shadow-sm border border-border/50"
              />
              <span className="font-medium text-text-primary truncate max-w-[120px] sm:max-w-none">
                {selectedCountry.name}
              </span>
              <span className="text-text-muted">+{selectedCountry.code}</span>
            </>
          ) : (
            <span className="text-text-muted">Select Country</span>
          )}
        </div>
        <ChevronDown className="h-4 w-4 opacity-50 text-text-secondary" />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-1 w-full z-50 rounded-md border border-border bg-surface shadow-lg overflow-hidden animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center border-b border-border px-3 py-2 bg-background">
              <Search className="h-4 w-4 text-text-muted mr-2" />
              <input
                type="text"
                placeholder="Search country or dial code..."
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
                filteredCountries.map((country) => (
                  <button
                    key={`${country.iso}-${country.code}`}
                    type="button"
                    onClick={() => handleSelect(country)}
                    className={cn(
                      "flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-background/80 transition-colors",
                      selectedCountryCode === country.code && "bg-primary/10 text-primary hover:bg-primary/20"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <img
                        src={`https://flagcdn.com/w20/${country.iso}.png`}
                        width="20"
                        alt={country.name}
                        className="rounded-sm shadow-sm border border-border/50"
                        loading="lazy"
                      />
                      <span className={cn(selectedCountryCode === country.code ? "font-semibold" : "")}>
                        {country.name}
                      </span>
                    </div>
                    <span className="text-text-muted">+{country.code}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CountrySelector;
