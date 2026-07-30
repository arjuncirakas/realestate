import { useId } from 'react';
import { cn } from '@/lib/cn.js';
import { Field } from './Field.jsx';
import { controlClasses } from './control-classes.js';

/**
 * A labelled multi-line input, for enquiry messages and agent notes.
 *
 * @param {object} props
 * @param {string} props.label sentence case
 * @param {number} [props.rows]
 * @param {string} [props.id] generated when omitted
 * @param {string} [props.hint]
 * @param {string} [props.error]
 * @param {boolean} [props.required]
 * @param {string} [props.className] layout classes for the wrapper
 * @returns {import('react').ReactElement}
 */
export const Textarea = ({
  label,
  rows = 4,
  id,
  hint,
  error,
  required,
  className,
  ...textareaProps
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
        <textarea
          id={controlId}
          rows={rows}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          required={required}
          // Vertical only: horizontal resize breaks the layout at 360px.
          className={cn(controlClasses({ invalid }), 'resize-y')}
          {...textareaProps}
        />
      )}
    />
  );
};
