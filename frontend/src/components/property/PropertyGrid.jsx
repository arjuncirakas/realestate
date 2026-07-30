import { cn } from '@/lib/cn.js';
import { EmptyState, ErrorState, SkeletonCardGrid } from '@/components/ui/index.js';
import { PropertyCard } from './PropertyCard.jsx';

/**
 * Renders a `usePropertiesList` result as the four required states (Section
 * 9.3: loading skeleton, empty, error, success — never a bare spinner).
 *
 * Takes the whole hook result rather than just `data` so a filter combination
 * the contract schema itself rejects (`minPrice` above `maxPrice`, say) shows
 * that schema's own message through `ErrorState` instead of either crashing
 * or quietly sending nothing.
 *
 * @param {object} props
 * @param {ReturnType<typeof import('@/api/properties.js').usePropertiesList>} props.result
 * @param {number} [props.skeletonCount]
 * @param {string} [props.emptyTitle]
 * @param {string} [props.emptyInstruction]
 * @param {string} [props.className]
 * @returns {import('react').ReactElement}
 */
export const PropertyGrid = ({
  result,
  skeletonCount = 6,
  emptyTitle = 'No plots match these filters',
  emptyInstruction = 'Widen the price range or clear a filter and try again.',
  className,
}) => {
  const { data, isPending, isError, error, refetch, validationError } = result;

  if (validationError) {
    return (
      <ErrorState
        title="These filters do not work together"
        error={{ message: validationError.issues[0]?.message }}
        instruction="Adjust the filters and try again."
        className={className}
      />
    );
  }

  if (isPending) {
    return <SkeletonCardGrid count={skeletonCount} label="Loading plots" className={className} />;
  }

  if (isError) {
    return <ErrorState error={error} onRetry={refetch} className={className} />;
  }

  if (data.items.length === 0) {
    return <EmptyState title={emptyTitle} instruction={emptyInstruction} className={className} />;
  }

  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}>
      {data.items.map((property) => (
        <PropertyCard key={property.id} property={property} />
      ))}
    </div>
  );
};
