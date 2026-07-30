/**
 * Barrel for the UI primitives, so a feature imports one line:
 *
 *   import { Button, Card, EmptyState } from '@/components/ui/index.js';
 *
 * Only WP0.5 adds to this directory. A feature needing a new primitive reports it
 * to the lead rather than defining a local variant — a second Button is how a
 * design system stops being one.
 */

export { Badge } from './Badge.jsx';
export { Button } from './Button.jsx';
export { Card, CardBody, CardFooter, CardHeader } from './Card.jsx';
export { Checkbox } from './Checkbox.jsx';
export { EmptyState } from './EmptyState.jsx';
export { ErrorState } from './ErrorState.jsx';
export { Field } from './Field.jsx';
export { controlClasses } from './control-classes.js';
export { Input } from './Input.jsx';
export { Modal } from './Modal.jsx';
export { Pagination } from './Pagination.jsx';
export { PlotIdentityStrip } from './PlotIdentityStrip.jsx';
export { Select } from './Select.jsx';
export { Skeleton, SkeletonCardGrid, SkeletonTable, SkeletonText } from './Skeleton.jsx';
export { Table } from './Table.jsx';
export { Textarea } from './Textarea.jsx';
