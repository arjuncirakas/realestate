import { useId } from 'react';
import { cn } from '@/lib/cn.js';
import { Field } from './Field.jsx';
import { controlClasses } from './control-classes.js';

/**
 * A labelled text input.
 *
 * Registering it with react-hook-form spreads the field props straight on:
 *
 *   <Input label="Email" error={errors.email?.message} {...register('email')} />
 *
 * @param {object} props
 * @param {string} props.label sentence case
 * @param {string} [props.id] generated when omitted
 * @param {string} [props.hint]
 * @param {string} [props.error]
 * @param {boolean} [props.required]
 * @param {string} [props.prefix] a fixed leading affix, e.g. `₹`
 * @param {string} [props.className] layout classes for the wrapper
 * @returns {import('react').ReactElement}
 */
export const Input = ({
  label,
  id,
  hint,
  error,
  required,
  prefix,
  className,
  ...inputProps
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
      renderControl={({ id: controlId, describedBy, invalid }) =>
        prefix ? (
          <div
            className={cn(
              controlClasses({ invalid }),
              'flex items-center gap-2 p-0 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-moss',
            )}
          >
            <span className="pl-3 text-ink-muted" aria-hidden="true">
              {prefix}
            </span>
            <input
              id={controlId}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              required={required}
              // The wrapper carries the ring so the affix sits inside it.
              className="w-full rounded-card bg-transparent py-2 pr-3 text-base text-ink outline-none"
              {...inputProps}
            />
          </div>
        ) : (
          <input
            id={controlId}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            required={required}
            className={controlClasses({ invalid })}
            {...inputProps}
          />
        )
      }
    />
  );
};
