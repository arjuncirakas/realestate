import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { EnquiryCreateSchema } from '@/contracts/index.js';
import { Button, Input, Textarea } from '@/components/ui/index.js';
import { useAuth } from '@/features/auth/auth-context.js';
import { useCreateEnquiry } from '@/api/enquiries.js';
import { blankToUndefined } from './blank-to-undefined.js';

const EnquiryFormSchema = EnquiryCreateSchema.extend({
  phone: blankToUndefined(EnquiryCreateSchema.shape.phone),
});

/**
 * The enquiry form embedded on a plot's detail page (Section 5.2:
 * `POST /properties/:id/enquiries`).
 *
 * The endpoint is public and rate-limited, so this form works for a
 * signed-out visitor as well as a subscriber — a guest types their own
 * contact details, and a signed-in user gets them prefilled from their
 * account.
 *
 * @param {object} props
 * @param {string} props.propertyId
 * @param {() => void} [props.onSuccess] called after the enquiry is sent
 * @returns {import('react').ReactElement}
 */
export const EnquiryForm = ({ propertyId, onSuccess }) => {
  const { user } = useAuth();
  const createEnquiry = useCreateEnquiry();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(EnquiryFormSchema),
    defaultValues: {
      name: user?.fullName ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
      message: '',
    },
  });

  const onSubmit = async (values) => {
    try {
      await createEnquiry.mutateAsync({ propertyId, ...values });
      toast.success('Enquiry sent. The agency will contact you shortly.');
      reset();
      onSuccess?.();
    } catch (error) {
      toast.error(error.message ?? 'Could not send your enquiry. Try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <Input label="Your name" required error={errors.name?.message} {...register('name')} />
      <Input
        label="Email"
        type="email"
        required
        error={errors.email?.message}
        {...register('email')}
      />
      <Input
        label="Phone"
        type="tel"
        hint="Optional"
        error={errors.phone?.message}
        {...register('phone')}
      />
      <Textarea
        label="Message"
        required
        hint="Tell the agency what you'd like to know about this plot."
        error={errors.message?.message}
        {...register('message')}
      />
      <Button type="submit" loading={createEnquiry.isPending} fullWidth>
        Send enquiry
      </Button>
    </form>
  );
};
