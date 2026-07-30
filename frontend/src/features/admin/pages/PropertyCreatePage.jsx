import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useCreateProperty } from '@/api/admin-properties.js';
import { buildPath, ROUTES } from '@/routes/paths.js';
import { PropertyForm } from '../components/PropertyForm.jsx';

/**
 * `/admin/properties/new` — creates a listing in `DRAFT` (Section 5.2), then
 * moves straight to the edit page so the agent can add photos and publish
 * when ready.
 * @returns {import('react').ReactElement}
 */
export default function PropertyCreatePage() {
  const navigate = useNavigate();
  const createProperty = useCreateProperty();

  const handleSubmit = async (values) => {
    const property = await createProperty.mutateAsync(values);
    toast.success('Listing created as a draft. Add photos and publish when ready.');
    navigate(buildPath(ROUTES.adminPropertyEdit, { id: property.id }), {
      state: { slug: property.slug },
      replace: true,
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">New listing</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Saved as a draft. Publish it once photos and details are ready.
        </p>
      </div>

      <PropertyForm mode="create" onSubmit={handleSubmit} submitting={createProperty.isPending} />
    </div>
  );
}
