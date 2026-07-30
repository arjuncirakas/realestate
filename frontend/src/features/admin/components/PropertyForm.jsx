import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { PropertyCreateSchema, PropertyUpdateSchema } from '@/contracts/index.js';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  Input,
  Select,
  Textarea,
} from '@/components/ui/index.js';
import { StaticMapThumbnail } from '@/components/property/index.js';
import { AREA_UNIT_LABEL, PROPERTY_TYPE_LABEL, toSelectOptions } from '@/lib/labels.js';
import { applyServerFieldErrors } from '../lib/apply-server-errors.js';
import { BLANK_PROPERTY_DRAFT, propertyFormSchema } from '../lib/property-form.js';

const TYPE_OPTIONS = toSelectOptions(PROPERTY_TYPE_LABEL);
const AREA_UNIT_OPTIONS = toSelectOptions(AREA_UNIT_LABEL);

/** Every field name the server can attach a validation detail to (Section 9.3). */
const FORM_FIELDS = Object.keys(BLANK_PROPERTY_DRAFT);

/**
 * The create and edit listing form, driven end to end by `PropertyCreateSchema`
 * / `PropertyUpdateSchema` (Section 9.3) — no rule here is restated locally.
 *
 * Coordinates are optional and both-or-neither (Section 7.3): leaving both
 * blank asks the server to geocode the address, which fails loudly with a
 * field-level message here when `GEOCODING_API_KEY` is unset — that message
 * is surfaced through `applyServerFieldErrors` rather than swallowed. The
 * preview below `StaticMapThumbnail`s whatever the two fields currently hold,
 * never an interactive map — Section 7.3 keeps this to the one live map on the
 * detail page, and a preview is all a coordinate field needs.
 *
 * @param {object} props
 * @param {'create'|'edit'} props.mode
 * @param {Record<string, unknown>} [props.defaultValues] from `draftFromProperty`, for edit mode
 * @param {(values: object) => Promise<void>} props.onSubmit receives the parsed `PropertyCreateSchema`/`PropertyUpdateSchema` payload
 * @param {boolean} [props.submitting]
 * @returns {import('react').ReactElement}
 */
export const PropertyForm = ({ mode, defaultValues, onSubmit, submitting = false }) => {
  const contractSchema = mode === 'edit' ? PropertyUpdateSchema : PropertyCreateSchema;
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(propertyFormSchema(contractSchema)),
    defaultValues: defaultValues ?? BLANK_PROPERTY_DRAFT,
  });

  // `useWatch` rather than the `watch()` function `useForm()` returns: the
  // latter is a plain function react-hook-form mutates in place, which the
  // React Compiler cannot memoize safely and refuses to optimise around.
  const isGroupPurchase = useWatch({ control, name: 'isGroupPurchase' });
  const title = useWatch({ control, name: 'title' });
  const rawLatitude = useWatch({ control, name: 'latitude' });
  const rawLongitude = useWatch({ control, name: 'longitude' });
  const previewLatitude = Number(rawLatitude);
  const previewLongitude = Number(rawLongitude);
  const hasPreviewCoordinates = Number.isFinite(previewLatitude) && Number.isFinite(previewLongitude);

  const handleValid = async (values) => {
    try {
      await onSubmit(values);
    } catch (error) {
      applyServerFieldErrors(error, setError, FORM_FIELDS);
      toast.error(error?.message ?? 'Could not save this listing. Try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit(handleValid)} noValidate className="flex flex-col gap-6">
      <Card>
        <CardHeader title="Listing details" description="What a buyer sees on the plot's page." />
        <CardBody className="flex flex-col gap-4">
          <Input label="Title" required error={errors.title?.message} {...register('title')} />
          <Textarea
            label="Description"
            rows={5}
            error={errors.description?.message}
            {...register('description')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Plot type"
              options={TYPE_OPTIONS}
              required
              error={errors.propertyType?.message}
              {...register('propertyType')}
            />
            <Input
              label="Survey number"
              error={errors.surveyNumber?.message}
              {...register('surveyNumber')}
            />
          </div>
          <Input
            label="Price"
            prefix="₹"
            inputMode="decimal"
            required
            hint="Whole rupees, up to two decimal places."
            error={errors.price?.message}
            {...register('price')}
          />
          <Checkbox
            label="Price is negotiable"
            error={errors.priceIsNegotiable?.message}
            {...register('priceIsNegotiable')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Area"
              inputMode="decimal"
              required
              error={errors.areaValue?.message}
              {...register('areaValue')}
            />
            <Select
              label="Area unit"
              options={AREA_UNIT_OPTIONS}
              required
              error={errors.areaUnit?.message}
              {...register('areaUnit')}
            />
          </div>
          <Input
            label="Amenities"
            hint="Comma-separated, e.g. Borewell, Compound wall, Road frontage"
            error={errors.amenities?.message}
            {...register('amenities')}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Location" description="Address details and coordinates." />
        <CardBody className="flex flex-col gap-4">
          <Input label="Address line" error={errors.addressLine?.message} {...register('addressLine')} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Locality" error={errors.locality?.message} {...register('locality')} />
            <Input label="City" required error={errors.city?.message} {...register('city')} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="District" error={errors.district?.message} {...register('district')} />
            <Input label="State" required error={errors.state?.message} {...register('state')} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Pincode"
              inputMode="numeric"
              error={errors.pincode?.message}
              {...register('pincode')}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Latitude"
              inputMode="decimal"
              hint="Leave both latitude and longitude blank to have the address geocoded automatically."
              error={errors.latitude?.message}
              {...register('latitude')}
            />
            <Input
              label="Longitude"
              inputMode="decimal"
              error={errors.longitude?.message}
              {...register('longitude')}
            />
          </div>
          {hasPreviewCoordinates && (
            <StaticMapThumbnail
              latitude={previewLatitude}
              longitude={previewLongitude}
              label={title || 'this plot'}
              height={160}
            />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Group purchase" description="Only applies when this listing is a group purchase opportunity." />
        <CardBody className="flex flex-col gap-4">
          <Checkbox
            label="This is a group purchase opportunity"
            error={errors.isGroupPurchase?.message}
            {...register('isGroupPurchase')}
          />
          {isGroupPurchase && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Target amount"
                prefix="₹"
                inputMode="decimal"
                hint="The indicative total the agency is gathering interest towards."
                error={errors.groupTargetAmount?.message}
                {...register('groupTargetAmount')}
              />
              <Input
                label="Minimum ticket amount"
                prefix="₹"
                inputMode="decimal"
                error={errors.groupMinTicket?.message}
                {...register('groupMinTicket')}
              />
            </div>
          )}
        </CardBody>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" loading={submitting}>
          {mode === 'edit' ? 'Save changes' : 'Save as draft'}
        </Button>
      </div>
    </form>
  );
};
