import { useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { File as FileIcon, ImageOff, Star, Trash2, Video } from 'lucide-react';
import { ACCEPTED_MIME_TYPES, UPLOAD_LIMITS } from '@/contracts/index.js';
import { Badge, Button, EmptyState, Input, Modal } from '@/components/ui/index.js';
import { useDeleteMedia, useUpdateMedia, useUploadMedia } from '@/api/media.js';

const ACCEPT_ATTRIBUTE = Object.keys(ACCEPTED_MIME_TYPES).join(',');

/**
 * Checks a batch of chosen files against Section 5.2's upload rules before it
 * ever reaches the network — the server enforces the same limits, but there is
 * no reason to make an agent wait for a round trip to learn a video was 4 MB
 * over the cap.
 * @param {File[]} files
 * @returns {string | null} a message describing the first violation, or null when the batch is fine
 */
const validateBatch = (files) => {
  if (files.length === 0) return null;
  if (files.length > UPLOAD_LIMITS.maxFiles) {
    return `Choose at most ${UPLOAD_LIMITS.maxFiles} files at a time.`;
  }
  const tooLarge = files.find((file) => file.size > UPLOAD_LIMITS.maxFileSizeBytes);
  if (tooLarge) {
    return `${tooLarge.name} is larger than 10 MB.`;
  }
  const unsupported = files.find((file) => !(file.type in ACCEPTED_MIME_TYPES));
  if (unsupported) {
    return `${unsupported.name} is not a supported file type.`;
  }
  return null;
};

/**
 * One media row: thumbnail, caption and order editing, cover selection, and
 * delete. Caption and order are edited locally and only sent as a patch once
 * "Save" is pressed, so moving through several fields does not fire a request
 * per keystroke.
 *
 * @param {object} props
 * @param {object} props.item a `PropertyMediaResponseSchema` row
 * @param {string} props.slug the property's slug, for cache invalidation
 * @param {() => void} props.onRequestDelete
 * @returns {import('react').ReactElement}
 */
const MediaItem = ({ item, slug, onRequestDelete }) => {
  const [caption, setCaption] = useState(item.caption ?? '');
  const [sortOrder, setSortOrder] = useState(String(item.sortOrder));
  const updateMedia = useUpdateMedia();
  const captionId = useId();
  const orderId = useId();

  const isDirty = caption !== (item.caption ?? '') || Number(sortOrder) !== item.sortOrder;

  const handleSave = async () => {
    try {
      await updateMedia.mutateAsync({
        id: item.id,
        slug,
        patch: {
          caption: caption.trim() || null,
          sortOrder: Number(sortOrder),
        },
      });
      toast.success('Media details saved.');
    } catch (error) {
      toast.error(error?.message ?? 'Could not save these details. Try again.');
    }
  };

  const handleSetCover = async () => {
    try {
      await updateMedia.mutateAsync({
        id: item.id,
        slug,
        patch: { isCover: true },
      });
      toast.success('Cover photo updated.');
    } catch (error) {
      toast.error(error?.message ?? 'Could not set the cover photo. Try again.');
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-card border border-hairline bg-surface p-3 sm:flex-row">
      <div className="aspect-[4/3] w-full shrink-0 overflow-hidden rounded-card bg-parchment sm:w-40">
        {item.type === 'IMAGE' ? (
          <img
            src={item.url}
            alt={item.caption ?? 'Plot media'}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-ink-muted">
            {item.type === 'VIDEO' ? (
              <Video className="size-6" aria-hidden="true" />
            ) : (
              <FileIcon className="size-6" aria-hidden="true" />
            )}
            <span className="text-xs">{item.type}</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {item.isCover && <Badge tone="moss">Cover photo</Badge>}
          <Badge tone="muted">{item.type}</Badge>
        </div>

        <Input
          id={captionId}
          label="Caption"
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
        />
        <Input
          id={orderId}
          label="Order"
          type="number"
          min="0"
          className="max-w-32"
          value={sortOrder}
          onChange={(event) => setSortOrder(event.target.value)}
        />

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!isDirty}
            loading={updateMedia.isPending}
            onClick={handleSave}
          >
            Save details
          </Button>
          {!item.isCover && item.type === 'IMAGE' && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              iconLeft={<Star className="size-4" />}
              loading={updateMedia.isPending}
              onClick={handleSetCover}
            >
              Set as cover
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="danger"
            iconLeft={<Trash2 className="size-4" />}
            onClick={onRequestDelete}
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
};

/**
 * The listing edit page's media manager: upload, caption/order/cover editing,
 * and delete (Section 5.2, `/properties/:id/media`, `/media/:id`).
 *
 * `media` comes straight from the property's own detail record rather than a
 * separate query — there is no standalone "list media" endpoint, and the
 * property fetch that loaded this page already carries it, ordered by
 * `sortOrder` (Section 5.2).
 *
 * @param {object} props
 * @param {string} props.propertyId
 * @param {string} props.slug
 * @param {Array<object>} props.media `PropertyMediaResponseSchema[]`
 * @returns {import('react').ReactElement}
 */
export const MediaManager = ({ propertyId, slug, media }) => {
  const fileInputRef = useRef(null);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const uploadMedia = useUploadMedia();
  const deleteMedia = useDeleteMedia();

  const handleFilesChosen = async (event) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;

    const problem = validateBatch(files);
    if (problem) {
      toast.error(problem);
      return;
    }

    try {
      await uploadMedia.mutateAsync({ propertyId, slug, files });
      toast.success(files.length === 1 ? 'Photo uploaded.' : `${files.length} files uploaded.`);
    } catch (error) {
      toast.error(error?.message ?? 'Could not upload those files. Try again.');
    }
  };

  const handleConfirmDelete = async () => {
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    try {
      await deleteMedia.mutateAsync({ id, slug });
      toast.success('Media removed.');
    } catch (error) {
      toast.error(error?.message ?? 'Could not remove that file. Try again.');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Photos and documents</h2>
          <p className="text-sm text-ink-muted">
            Up to {UPLOAD_LIMITS.maxFiles} files at a time, 10 MB each. JPEG, PNG, WebP, MP4 or PDF.
          </p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPT_ATTRIBUTE}
            onChange={handleFilesChosen}
            className="sr-only"
            aria-label="Choose files to upload"
          />
          <Button
            type="button"
            variant="secondary"
            loading={uploadMedia.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            Upload files
          </Button>
        </div>
      </div>

      {media.length === 0 ? (
        <EmptyState
          icon={<ImageOff className="size-8" />}
          title="No photos yet"
          instruction="Upload photos so this listing has something to show once it is published."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {[...media]
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((item) => (
              <MediaItem
                key={item.id}
                item={item}
                slug={slug}
                onRequestDelete={() => setPendingDeleteId(item.id)}
              />
            ))}
        </div>
      )}

      <Modal
        open={pendingDeleteId !== null}
        onClose={() => setPendingDeleteId(null)}
        title="Remove this file?"
        description="This cannot be undone."
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingDeleteId(null)}>
              Keep file
            </Button>
            <Button variant="danger" loading={deleteMedia.isPending} onClick={handleConfirmDelete}>
              Remove file
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink">The file will be removed from this listing immediately.</p>
      </Modal>
    </div>
  );
};
