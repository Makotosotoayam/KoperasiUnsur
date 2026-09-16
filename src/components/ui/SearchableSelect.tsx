import { useEffect, useRef, useState } from 'react';

export interface SearchableOption {
    value: string;
    label: string;
}

interface SearchableSelectProps {
    options: SearchableOption[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
}

export function SearchableSelect({ options, value, onChange, placeholder, disabled }: SearchableSelectProps) {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedLabel = options.find((o) => o.value === value)?.label ?? '';

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
                setQuery('');
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filtered = query
        ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
        : options;

    return (
        <div className="relative" ref={containerRef}>
            <input
                type="text"
                disabled={disabled}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-500"
                placeholder={placeholder ?? '- Pilih -'}
                value={open ? query : selectedLabel}
                onFocus={() => { setOpen(true); setQuery(''); }}
                onChange={(e) => setQuery(e.target.value)}
            />
            {open && !disabled && (
                <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
                    {filtered.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-gray-400">Tidak ditemukan</div>
                    ) : (
                        filtered.map((o) => (
                            <button
                                key={o.value}
                                type="button"
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 ${o.value === value ? 'bg-emerald-50 font-medium text-emerald-700' : 'text-gray-700'}`}
                                onClick={() => {
                                    onChange(o.value);
                                    setOpen(false);
                                    setQuery('');
                                }}
                            >
                                {o.label}
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}