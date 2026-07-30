import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge, Button, EmptyState, ErrorState, Modal, SkeletonText } from '@/components/ui/index.js';
import { PROPERTY_STATUS_LABEL, PROPERTY_STATUS_TONE } from '@/lib/labels.js';
import { ROUTES } from '@/routes/paths.js';
import { useAuth } from '@/features/auth/auth-context.js';
import { PropertyStatus } from '@/contracts/index.js';
import { usePropertyDetail } from '@/api/properties.js';
import {
  useAdminPropertySlugLookup,
  usePublishProperty,
  useUpdateProperty,
  useWithdrawProperty,
} from '@/api/admin-properties.js';
import { PropertyForm } from '../components/PropertyForm.jsx';
import { MediaManager } from '../components/MediaManager.jsx';
import { draftFromProperty } from '../lib/property-form.js';

/**
 * `/admin/properties/:id/edit` — edit form and media manager (Section 7.1).
 *
 * The route param is the listing's id, but the only endpoint that returns the
 * full record (`PropertyResponseSchema`, needed for the form's address/group
 * fields and the media manager) is `GET /properties/:slug`. The properties
 * table already knows the slug of any row it links here and passes it via
 * router state; a direct or refreshed visit falls back to
 * `useAdminPropertySlugLookup` (see that hook's doc comment for the tradeoff).
 *
 * @returns {import('react').ReactElement}
 */
export default function PropertyEditPage() {
  const { id } = useParams();
  const location = useLocation();
  const { isAdmin } = useAuth();
  const [confirmingWithdraw, setConfirmingWithdraw] = useState(false);

  const stateSlug = location.state?.slug;
  const slugLookup = useAdminPropertySlugLookup(id, { enabled: !stateSlug });
  const slug = stateSlug ?? slugLookup.data ?? undefined;

  const detail = usePropertyDetail(slug);
  const updateProperty = useUpdateProperty();
  const publishProperty = usePublishProperty();
  const withdrawProperty = useWithdrawProperty();

  const lookupFailed = !stateSlug && !slugLookup.isLoading && (slugLookup.isError || slugLookup.data === null);
  const isLoading = !stateSlug && slugLookup.isLoading ? true : detail.isLoading;

  const handleSubmit = async (values) => {
    await updateProperty.mutateAsync({ id, ...values });
    toast.success('Changes saved.');
  };

  const handlePublish = async () => {
    try {
      await publishProperty.mutateAsync(id);
      toast.success('Listing published.');
    } catch (error) {
      toast.error(error?.message ?? 'Could not publish this listing. Try again.');
    }
  };

  const handleConfirmWithdraw = async () => {
    setConfirmingWithdraw(false);
    try {
      await withdrawProperty.mutateAsync(id);
      toast.success('Listing withdrawn.');
    } catch (error) {
      toast.error(error?.message ?? 'Could not withdraw this listing. Try again.');
    }
  };

  if (isLoading) {
    return <SkeletonText lines={6} />;
  }

  if (lookupFailed) {
    return (
      <EmptyState
        title="That listing could not be found"
        instruction="It may have been removed. Go back to the listings table and try again."
        action={
          <Button as={Link} to={ROUTES.adminProperties} variant="secondary">
            Back to listings
          </Button>
        }
      />
    );
  }

  if (detail.isError) {
    return <ErrorState error={detail.error} onRetry={detail.refetch} />;
  }

  const property = detail.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-ink">{property.title}</h1>
            <Badge tone={PROPERTY_STATUS_TONE[property.status]}>
              {PROPERTY_STATUS_LABEL[property.status]}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            {[property.locality, property.city].filter(Boolean).join(', ')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {property.status === PropertyStatus.DRAFT && (
            <Button loading={publishProperty.isPending} onClick={handlePublish}>
              Publish listing
            </Button>
          )}
          {isAdmin && property.status !== PropertyStatus.WITHDRAWN && (
            <Button variant="danger" onClick={() => setConfirmingWithdraw(true)}>
              Withdraw listing
            </Button>
          )}
        </div>
      </div>

      <PropertyForm
        mode="edit"
        defaultValues={draftFromProperty(property)}
        onSubmit={handleSubmit}
        submitting={updateProperty.isPending}
      />

      <MediaManager propertyId={property.id} slug={property.slug} media={property.media} />

      <Modal
        open={confirmingWithdraw}
        onClose={() => setConfirmingWithdraw(false)}
        title="Withdraw this listing?"
        description="It moves to withdrawn and disappears from the public catalogue."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmingWithdraw(false)}>
              Keep listing
            </Button>
            <Button variant="danger" loading={withdrawProperty.isPending} onClick={handleConfirmWithdraw}>
              Withdraw listing
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink">This can be reviewed again later, but it will no longer be visible to buyers.</p>
      </Modal>
    </div>
  );
}
