import { useId, useRef, useState } from 'react';

import { COPY } from '@tuckly/contracts';

import { Button } from '../../components/ui/Button';
import type { MediaUpload, MediaUploadQueue } from '../../lib/media-upload-queue';

import './media-uploads.css';

export function MediaUploads({ jobs, queue }: { jobs: MediaUpload[]; queue: MediaUploadQueue }) {
  if (!jobs.length) {
    return null;
  }
  return <MediaUploadsPanel jobs={jobs} queue={queue} />;
}

function MediaUploadsPanel({ jobs, queue }: { jobs: MediaUpload[]; queue: MediaUploadQueue }) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const toggle = useRef<HTMLButtonElement>(null);
  const copy = COPY.mediaUploads;
  const pending = jobs.filter(job => job.state === 'queued' || job.state === 'uploading').length;
  const errors = jobs.filter(job => job.state === 'error').length;
  const collapse = () => {
    setExpanded(false);
    toggle.current?.focus();
  };
  return (
    <section
      className={'media-uploads'}
      aria-label={copy.heading}
      onKeyDown={event => {
        if (expanded && event.key === 'Escape') {
          event.stopPropagation();
          collapse();
        }
      }}
    >
      {expanded && (
        <div id={panelId} className={'media-uploads-panel'}>
          <div className={'media-uploads-heading'}>
            <h2>{copy.heading}</h2>
            <Button aria-label={copy.collapse} onClick={collapse}>
              ⌄
            </Button>
          </div>
          {pending > 0 && <p>{copy.keepOpen}</p>}
          <ul aria-live={'polite'} aria-relevant={'additions text'}>
            {jobs.map(job => (
              <li key={job.id}>
                <strong>{job.title}</strong>
                <small>{job.spaceName}</small>
                <div className={'media-upload-state'}>
                  {job.state === 'uploading' && (
                    <progress aria-label={copy.uploadLabel(job.title)} />
                  )}
                  <span>
                    {job.state === 'queued'
                      ? copy.queued
                      : job.state === 'uploading'
                        ? copy.uploading
                        : job.state === 'saved'
                          ? copy.saved
                          : copy.failed}
                  </span>
                </div>
                {job.state === 'error' && <p role={'alert'}>{job.error}</p>}
                <div className={'media-upload-actions'}>
                  {job.state === 'error' && (
                    <Button onClick={() => queue.retry(job.id)}>{copy.retry}</Button>
                  )}
                  {(job.state === 'error' || job.state === 'saved') && (
                    <Button
                      aria-label={copy.dismissLabel(job.title)}
                      onClick={() => queue.dismiss(job.id)}
                    >
                      {job.state === 'saved' ? copy.done : copy.dismiss}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Button
        ref={toggle}
        className={[
          'media-uploads-toggle',
          pending > 0 && 'is-uploading',
          errors > 0 && 'has-errors',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-label={copy.toggleLabel(pending, errors, jobs.length - pending - errors)}
        aria-expanded={expanded}
        aria-controls={expanded ? panelId : undefined}
        onClick={() => setExpanded(value => !value)}
      >
        <svg
          width={'22'}
          height={'22'}
          viewBox={'0 0 24 24'}
          fill={'none'}
          stroke={'currentColor'}
          strokeWidth={'1.8'}
          strokeLinecap={'round'}
          strokeLinejoin={'round'}
          aria-hidden={'true'}
        >
          {errors > 0 ? (
            <>
              <path d={'M12 8v5'} />
              <path d={'M12 17h.01'} />
              <circle cx={'12'} cy={'12'} r={'9'} />
            </>
          ) : pending > 0 ? (
            <>
              <path d={'M12 16V4m-5 5 5-5 5 5M4 16v4h16v-4'} />
            </>
          ) : (
            <path d={'m5 12 4 4L19 6'} />
          )}
        </svg>
        <span aria-hidden={'true'}>{jobs.length}</span>
      </Button>
    </section>
  );
}
