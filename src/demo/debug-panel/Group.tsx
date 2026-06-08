import type { ReactNode } from 'react';

type GroupProps = {
  title: string;
  milestone: string;
  disabled?: boolean;
  children: ReactNode;
};

export function Group({ title, milestone, disabled = true, children }: GroupProps) {
  return (
    <fieldset className="rail-group" disabled={disabled}>
      <legend>
        <span className="rail-group-title">{title}</span>
        <span className="rail-group-tag">{milestone}</span>
      </legend>
      {children}
    </fieldset>
  );
}
