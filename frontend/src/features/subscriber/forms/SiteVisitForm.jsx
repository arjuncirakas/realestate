import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { SiteVisitCreateSchema, VisitSlot } from '@/contracts/index.js';
import { Button, Input, Select } from '@/components/ui/index.js';
import { toDateInputValue } from '@/lib/format.js';
import { toSelectOptions, VISIT_SLOT_LABEL } from '@/lib/labels.js';
import { useAuth } from '@/features/auth/auth-context.js';
import { useRequestSiteVisit } from '@/api/visits.js';
import { blankToUndefined } from './blank-to-undefined.js';
import { SignInPrompt } from './SignInPrompt.jsx';

const SLOT_OPTIONS = toSelectOptions(VISIT_SLOT_LABEL);

const SiteVisitFormSchema = SiteVisitCreateSchema.extend({
  contactPhone: blankToUndefined(SiteVisitCreateSchema.shape.contactPhone),
});

/**
 * Requests a site visit for a plot (Section 5.2:
 * `POST /properties/:id/site-visits`). Requires a session — a signed-out
 * visitor sees a sign-in prompt instead of the form.
 *
 * The "not in the past" rule on `preferredDate` is enforced server-side
 * (Section 5.2 notes on `SiteVisitCreateSchema`); the `min` attribute here is
 * a usability nudge, not the source of truth.
 *
 * @param {object} props
 * @param {string} props.propertyId
 * @param {() => void} [props.onSuccess] called after the visit is requested
 * @returns {import('react').ReactElement}
 */
export const SiteVisitForm = ({ propertyId, onSuccess }) => {
  const { isAuthenticated, user } = useAuth();
  const requestVisit = useRequestSiteVisit();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(SiteVisitFormSchema),
    defaultValues: {
      preferredDate: '',
      preferredSlot: VisitSlot.MORNING,
      contactPhone: user?.phone ?? '',
    },
  });

  if (!isAuthenticated) {
    return <SignInPrompt action="request a site visit" />;
  }

  const onSubmit = async (values) => {
    try {
      await requestVisit.mutateAsync({ propertyId, ...values });
      toast.success('Site visit requested. The agency will contact you to confirm.');
      reset();
      onSuccess?.();
    } catch (error) {
      toast.error(error.message ?? 'Could not request the visit. Try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <Input
        label="Preferred date"
        type="date"
        required
        min={toDateInputValue(new Date())}
        error={errors.preferredDate?.message}
        {...register('preferredDate')}
      />
      <Select
        label="Preferred time of day"
        options={SLOT_OPTIONS}
        required
        error={errors.preferredSlot?.message}
        {...register('preferredSlot')}
      />
      <Input
        label="Contact phone"
        type="tel"
        hint="Optional — the agency will call to confirm the visit."
        error={errors.contactPhone?.message}
        {...register('contactPhone')}
      />
      <Button type="submit" loading={requestVisit.isPending} fullWidth>
        Request site visit
      </Button>
    </form>
  );
};
