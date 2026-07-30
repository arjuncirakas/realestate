import { useState } from 'react';
import { Button, Card, CardBody, CardHeader, Checkbox, Input, Select } from '@/components/ui/index.js';
import { AREA_UNIT_LABEL, PROPERTY_TYPE_LABEL, toSelectOptions } from '@/lib/labels.js';

/**
 * The blank draft a "Clear filters" click resets to.
 *
 * `groupPurchaseOnly` is a real boolean here — every other field is a string,
 * matching what `PropertyListQuerySchema` and a URL search param both expect
 * (Section 9.2's money-and-area-as-strings rule extends naturally to a filter
 * value that started life as one).
 */
const EMPTY_DRAFT = Object.freeze({
  q: '',
  type: '',
  city: '',
  locality: '',
  minPrice: '',
  maxPrice: '',
  minArea: '',
  maxArea: '',
  areaUnit: '',
  groupPurchaseOnly: false,
});

/**
 * Builds the controlled-input draft from the filters currently applied
 * (props, not local state), normalising `groupPurchaseOnly` back to a real
 * boolean whichever form it arrived in — a fresh boolean from a checkbox, or
 * the string `'true'` a URL search param produces.
 * @param {Record<string, unknown>} filters
 * @returns {typeof EMPTY_DRAFT}
 */
const draftFromFilters = (filters) => ({
  ...EMPTY_DRAFT,
  ...filters,
  groupPurchaseOnly: filters.groupPurchaseOnly === true || filters.groupPurchaseOnly === 'true',
});

/**
 * The catalogue's filter sidebar.
 *
 * Deliberately not wired to `react-hook-form`/`zodResolver`: those are for a
 * write that a contract schema validates end to end (Section 9.3). A filter
 * is a read — an invalid combination is not rejected here, it is reported by
 * `usePropertiesList`'s own contract-schema check, with the contract's own
 * message, once "Apply filters" is pressed.
 *
 * The draft only initialises from `filters` — it does not resync to it on
 * every render, so a keystroke is not overwritten by the applied state it is
 * about to replace. When the URL changes from outside this form (the back
 * button, a "Clear filters" click), the caller remounts it with a fresh `key`
 * — see `CataloguePage` — which is the React-recommended way to reset state
 * from a prop change without a synchronising effect.
 *
 * @param {object} props
 * @param {Record<string, unknown>} props.filters the filters currently applied (drives the initial draft)
 * @param {(filters: Record<string, unknown>) => void} props.onApply
 * @param {() => void} props.onClear
 * @returns {import('react').ReactElement}
 */
export const PropertyFiltersForm = ({ filters, onApply, onClear }) => {
  const [draft, setDraft] = useState(() => draftFromFilters(filters));

  const updateField = (key) => (event) => setDraft((prev) => ({ ...prev, [key]: event.target.value }));
  const updateGroupPurchaseOnly = (event) =>
    setDraft((prev) => ({ ...prev, groupPurchaseOnly: event.target.checked }));

  const handleSubmit = (event) => {
    event.preventDefault();
    onApply(draft);
  };

  const handleClear = () => {
    setDraft(EMPTY_DRAFT);
    onClear();
  };

  return (
    <Card>
      <CardHeader title="Filter plots" />
      <CardBody>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Search"
            placeholder="Title, locality or survey number"
            value={draft.q}
            onChange={updateField('q')}
          />
          <Select
            label="Plot type"
            placeholder="Any type"
            options={toSelectOptions(PROPERTY_TYPE_LABEL)}
            value={draft.type}
            onChange={updateField('type')}
          />
          <Input label="City" placeholder="e.g. Kollam" value={draft.city} onChange={updateField('city')} />
          <Input
            label="Locality"
            placeholder="e.g. Kottiyam"
            value={draft.locality}
            onChange={updateField('locality')}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Min price"
              prefix="₹"
              inputMode="numeric"
              value={draft.minPrice}
              onChange={updateField('minPrice')}
            />
            <Input
              label="Max price"
              prefix="₹"
              inputMode="numeric"
              value={draft.maxPrice}
              onChange={updateField('maxPrice')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Min area"
              inputMode="numeric"
              value={draft.minArea}
              onChange={updateField('minArea')}
            />
            <Input
              label="Max area"
              inputMode="numeric"
              value={draft.maxArea}
              onChange={updateField('maxArea')}
            />
          </div>

          <Select
            label="Area unit"
            placeholder="Any unit"
            options={toSelectOptions(AREA_UNIT_LABEL)}
            value={draft.areaUnit}
            onChange={updateField('areaUnit')}
          />

          <Checkbox
            label="Group purchase opportunities only"
            description="Plots the agency is gathering interest in."
            checked={draft.groupPurchaseOnly}
            onChange={updateGroupPurchaseOnly}
          />

          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm">
              Apply filters
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={handleClear}>
              Clear filters
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
};
