import type { ReactNode } from 'react';
import { fieldLabel } from './formStyles';

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <div style={fieldLabel}>{label}</div>
      {children}
    </label>
  );
}
