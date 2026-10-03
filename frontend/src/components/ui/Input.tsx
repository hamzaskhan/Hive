import type { InputHTMLAttributes } from "react";
import "./ui.css";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
};

export function Input({ label, hint, id, className = "", ...rest }: Props) {
  const inputId = id ?? rest.name;
  return (
    <label className={`ui-field ${className}`.trim()} htmlFor={inputId}>
      <span className="ui-field__label">{label}</span>
      <input id={inputId} className="ui-input" {...rest} />
      {hint ? <span className="ui-field__hint">{hint}</span> : null}
    </label>
  );
}
