import React, { useState, useRef, useEffect } from 'react';
import { FiChevronDown, FiSearch } from 'react-icons/fi';

const SearchableSelect = ({ options = [], value, onChange, placeholder = 'Select…' }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="input-field flex items-center justify-between text-left w-full bg-slate-900 border border-slate-800 text-slate-200"
      >
        <span className={`truncate ${value ? '' : 'text-text-subtle'}`}>{value || placeholder}</span>
        <FiChevronDown className={`w-4 h-4 text-text-subtle transition-transform shrink-0 ml-2 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-slate-800 flex items-center gap-2 bg-slate-900">
            <FiSearch className="w-4 h-4 text-text-subtle shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-full bg-transparent outline-none text-sm text-slate-200"
            />
          </div>
          <ul className="max-h-56 overflow-auto py-1 bg-slate-950">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-slate-500">No matches</li>
            )}
            {filtered.map((opt) => (
              <li key={opt}>
                <button
                  type="button"
                  onClick={() => { onChange(opt); setOpen(false); setQuery(''); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-900 ${value === opt ? 'text-primary font-medium' : 'text-slate-300'}`}
                >
                  {opt}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
