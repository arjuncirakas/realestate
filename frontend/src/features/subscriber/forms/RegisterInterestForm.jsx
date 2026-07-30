import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { InterestCreateSchema } from '@/contracts/index.js';
import { Button, Input, Textarea } from '@/components/ui/index.js';
import { useAuth } from '@/features/auth/auth-context.js';
import { useRegisterInterest } from '@/api/interests.js';
import { blankToUndefined } from './blank-to-undefined.js';
import { SignInPrompt } from './SignInPrompt.jsx';

const RegisterInterestFormSchema = InterestCreateSchema.extend({
  indicativeAmount: blankToUndefined(InterestCreateSchema.shape.indicativeAmount),
  notes: blankToUndefined(InterestCreateSchema.shape.notes),
});

/**
 * Registers an expression of interest in a group-purchase opportunity
 * (Section 5.2: `POST /properties/:id/interest`).
 *
 * This is an enquiry mechanism, not an investment product (Section 1.3): it
 * records interest only, creates no commitment, and moves no money — the
 * agency follows up by phone or email. Requires a session — a signed-out
 * visitor sees a sign-in prompt instead of the form. A withdrawn registration
 * can be submitted again; the endpoint only rejects a second submission while
 * one is already open.
 *
 * @param {object} props
 * @param {string} props.propertyId
 * @param {() => void} [props.onSuccess] called after the registration is recorded
 * @returns {import('react').ReactElement}
 */
export const RegisterInterestForm = ({ propertyId, onSuccess }) => {
  const { isAuthenticated } = useAuth();
  const registerInterest = useRegisterInterest();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(RegisterInterestFormSchema),
    defaultValues: { indicativeAmount: '', notes: '' },
  });

  if (!isAuthenticated) {
    return <SignInPrompt action="register your interest in this group purchase opportunity" />;
  }

  const onSubmit = async (values) => {
    try {
      await registerInterest.mutateAsync({ propertyId, ...values });
      toast.success('Interest registered. The agency will contact you about this opportunity.');
      reset();
      onSuccess?.();
    } catch (error) {
      if (error.code === 'CONFLICT') {
        toast.error('You already have an open registration for this plot.');
      } else {
        toast.error(error.message ?? 'Could not register your interest. Try again.');
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <Input
        label="Indicative amount"
        prefix="₹"
        hint="Optional — a rough figure to help the agency's follow-up. Not a commitment."
        error={errors.indicativeAmount?.message}
        {...register('indicativeAmount')}
      />
      <Textarea
        label="Notes"
        hint="Optional — anything else the agency should know."
        error={errors.notes?.message}
        {...register('notes')}
      />
      <Button type="submit" loading={registerInterest.isPending} fullWidth>
        Register interest
      </Button>
    </form>
  );
};
