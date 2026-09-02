import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import {
  buildTimezoneList,
  filterTimezones,
  isValidTimezone,
  DEFAULT_TIMEZONE,
  TIMEZONE_STORAGE_KEY,
} from './utils';
import type { TimezoneItem } from './utils';
import { getSetting, setSetting } from '@features/database';
import './TimezoneSelector.css';

interface TimezoneSelectorProps {
  /** Current UTC timestamp used to compute offsets (unix seconds). */
  referenceUtcSeconds: number;
  /** Active IANA timezone identifier. */
  value: string;
  /** Callback when user selects a new timezone. */
  onChange: (timezone: string) => void;
}

/**
 * Timezone selector with search/filter.
 *
 * Controlled presentation component: displays active timezone and notifies parent on selection change.
 * Does NOT affect replay engine, candle data, or chart viewport.
 */
export default function TimezoneSelector({ referenceUtcSeconds, value, onChange }: TimezoneSelectorProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Build timezone list based on reference time (handles DST offsets).
  const allTimezones = useMemo(
    () => buildTimezoneList(referenceUtcSeconds),
    [referenceUtcSeconds]
  );

  // Filtered list based on search query.
  const filteredTimezones = useMemo(
    () => filterTimezones(allTimezones, searchQuery),
    [allTimezones, searchQuery]
  );

  // Selected timezone item for display.
  const selectedItem = useMemo(
    () => allTimezones.find((tz) => tz.id === value) ?? allTimezones[0],
    [allTimezones, value]
  );

  // Focus search input when menu opens.
  useEffect(() => {
    if (menuOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [menuOpen]);

  // Close menu on outside click.
  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setSearchQuery('');
      }
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const handleSelect = useCallback((tz: TimezoneItem) => {
    onChange(tz.id);
    setMenuOpen(false);
    setSearchQuery('');
  }, [onChange]);

  const handleToggle = useCallback(() => {
    setMenuOpen((v) => {
      if (v) setSearchQuery('');
      return !v;
    });
  }, []);

  const shortTzLabel = useMemo(() => {
    const city = selectedItem.id.split('/').pop()?.replace(/_/g, ' ') ?? selectedItem.id;
    return `${selectedItem.offsetLabel} (${city})`;
  }, [selectedItem]);

  return (
    <div className="tz-selector" ref={wrapRef}>
      <button
        className="tz-selector__trigger"
        onClick={handleToggle}
        aria-expanded={menuOpen}
        aria-label="Select timezone"
        title={`Timezone: ${selectedItem.id} (${selectedItem.offsetLabel})`}
      >
        <span className="tz-selector__trigger-label mono">
          {shortTzLabel}
        </span>
        <ChevronDown size={13} />
      </button>

      {menuOpen && (
        <div className="tz-selector__dropdown">
          <div className="tz-selector__search-wrap">
            <Search size={13} className="tz-selector__search-icon" />
            <input
              ref={searchInputRef}
              className="tz-selector__search"
              type="text"
              placeholder="Search timezone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="tz-selector__search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="tz-selector__list">
            {filteredTimezones.length === 0 && (
              <div className="tz-selector__empty">No timezone found</div>
            )}
            {filteredTimezones.map((tz) => (
              <button
                key={tz.id}
                className={`tz-selector__item ${tz.id === value ? 'is-active' : ''}`}
                onClick={() => handleSelect(tz)}
              >
                <span className="tz-selector__item-offset mono">{tz.offsetLabel}</span>
                <span className="tz-selector__item-id">{tz.id}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
