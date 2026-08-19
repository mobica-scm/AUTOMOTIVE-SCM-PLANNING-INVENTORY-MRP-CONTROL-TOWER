"use client";

import { useEffect, useState } from "react";

type MaterialOption = { id: string; internalRef: string; descriptionEn: string };

export function useMaterialOptions() {
  const [options, setOptions] = useState<MaterialOption[]>([]);
  useEffect(() => {
    fetch("/api/materials")
      .then((r) => r.json())
      .then((rows: MaterialOption[]) => setOptions(rows));
  }, []);
  return options;
}

export function MaterialPicker({ value, onChange, options }: { value: string; onChange: (id: string) => void; options: MaterialOption[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full">
      <option value="">Select material…</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.internalRef} — {o.descriptionEn.slice(0, 50)}
        </option>
      ))}
    </select>
  );
}
