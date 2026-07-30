import { useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn.js';
import { Field } from './Field.jsx';
import { controlClasses } from './control-classes.js';

/**
 * A labelled select.
 *
 * Renders a native `<select>` on purpose: on a phone it opens the platform
 * picker, which is faster and more accessible than any custom listbox, and this
 * audience is frequently on a mid-range Android device.
 *
 * @param {object} props
 * @param {string} props.label sentence case
 * @param {Array<{ value: string, label: string }>} props.options use `toSelectOptions` from lib/labels.js
 * @param {string} [props.placeholder] adds a leading empty option, e.g. "Any status"
 * @param {string} [props.id] generated when omitted
 * @param {string} [props.hint]
 * @param {string} [props.error]
 * @param {boolean} [props.required]
 * @param {string} [props.className] layout classes for the wrapper
 * @returns {import('react').ReactElement}
 */
export const Select = ({
  label,
  options = [],
  placeholder,
  id,
  hint,
  error,
  required,
  className,
  ...selectProps
}) => {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  return (
    <Field
      id={fieldId}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={className}
      renderControl={({ id: controlId, describedBy, invalid }) => (
        <div className="relative">
          <select
            id={controlId}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            required={required}
            className={cn(controlClasses({ invalid }), 'appearance-none pr-10')}
            {...selectProps}
          >
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
            aria-hidden="true"
          />
        </div>
      )}
    />
  );
};
