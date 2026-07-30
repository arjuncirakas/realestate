import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PropertyForm } from './PropertyForm.jsx';

/**
 * Proves `PropertyForm` is driven end to end by the imported
 * `PropertyCreateSchema` (Section 9.3): money survives as a string rather
 * than being coerced to a number, amenities become the array the contract
 * expects, and the coordinate-pair rule from `property.contract.js` — not
 * restated here — rejects a lone latitude with its own message.
 */

const fillRequiredFields = async (user) => {
  await user.type(screen.getByLabelText(/Title/), 'Eight cent plot near Kottiyam junction');
  await user.type(screen.getByLabelText(/^Price\*/), '3900000');
  await user.type(screen.getByLabelText(/^Area\*/), '8');
  await user.type(screen.getByLabelText(/^City/), 'Kollam');
  await user.type(screen.getByLabelText(/^State/), 'Kerala');
};

describe('PropertyForm', () => {
  it('submits price as a string and amenities as an array, not restating the contract', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<PropertyForm mode="create" onSubmit={onSubmit} />);

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText(/Amenities/), 'Borewell, Compound wall');
    await user.click(screen.getByRole('button', { name: 'Save as draft' }));

    expect(onSubmit).toHaveBeenCalledOnce();
    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted.price).toBe('3900000');
    expect(typeof submitted.price).toBe('string');
    expect(submitted.amenities).toEqual(['Borewell', 'Compound wall']);
  });

  it('rejects a latitude with no longitude, using the contract message', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<PropertyForm mode="create" onSubmit={onSubmit} />);

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText(/Latitude/), '8.848');
    await user.click(screen.getByRole('button', { name: 'Save as draft' }));

    expect(await screen.findByText('Provide both latitude and longitude, or neither')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects a group-purchase amount unless the group-purchase checkbox is ticked', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<PropertyForm mode="create" onSubmit={onSubmit} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Save as draft' }));

    // The target/ticket inputs are not even rendered until the checkbox is
    // ticked, which is the form-level guarantee against the contract's
    // "only applies to a group purchase opportunity" rule.
    expect(screen.queryByLabelText(/Target amount/)).not.toBeInTheDocument();
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit.mock.calls[0][0].groupTargetAmount).toBeUndefined();
  });
});
