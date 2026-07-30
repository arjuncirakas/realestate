import { useState } from 'react';
import { FileText, Image as ImageIcon, Video } from 'lucide-react';
import { cn } from '@/lib/cn.js';

/** Label for a non-image attachment, keyed by `MediaType`. */
const OTHER_MEDIA_LABEL = Object.freeze({
  VIDEO: 'Walkthrough video',
  DOCUMENT: 'Document',
  TOUR_360: '360° tour',
});

/**
 * The detail page's photo gallery, plus a plain list of any video, document
 * or 360° tour attachments — those open in a new tab rather than trying to
 * embed a player or viewer this MVP does not need.
 *
 * @param {object} props
 * @param {Array<import('zod').infer<typeof import('@/contracts/index.js').PropertyMediaResponseSchema>>} [props.media]
 * @param {string} props.title used as the fallback alt text
 * @returns {import('react').ReactElement}
 */
export const PropertyGallery = ({ media = [], title }) => {
  const images = [...media]
    .filter((item) => item.type === 'IMAGE')
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const others = media.filter((item) => item.type !== 'IMAGE');
  const [activeIndex, setActiveIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center rounded-card border border-hairline bg-parchment text-ink-muted">
        <ImageIcon className="size-8" aria-hidden="true" />
        <span className="sr-only">No photos have been added for this plot yet.</span>
      </div>
    );
  }

  const active = images[Math.min(activeIndex, images.length - 1)];

  return (
    <div>
      {/*
        Deliberately eager. This is the largest contentful paint on the detail
        page, and `loading="lazy"` on an LCP image delays discovery until layout,
        which measurably worsens the metric. The thumbnails below are the ones
        that should defer.
      */}
      <img
        src={active.url}
        alt={active.caption || title}
        loading="eager"
        fetchPriority="high"
        decoding="async"
        className="aspect-[4/3] w-full rounded-card border border-hairline object-cover"
      />

      {images.length > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-current={index === activeIndex}
              aria-label={`Show photo ${index + 1} of ${images.length}`}
              className={cn(
                'size-16 shrink-0 overflow-hidden rounded-card border',
                index === activeIndex ? 'border-moss' : 'border-hairline',
              )}
            >
              <img
                src={image.url}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {others.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {others.map((item) => (
            <li key={item.id}>
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-card border border-hairline bg-surface px-2.5 py-1.5 text-xs text-ink hover:bg-parchment"
              >
                {item.type === 'VIDEO' ? (
                  <Video className="size-3.5" aria-hidden="true" />
                ) : (
                  <FileText className="size-3.5" aria-hidden="true" />
                )}
                {item.caption || OTHER_MEDIA_LABEL[item.type] || 'Attachment'}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
