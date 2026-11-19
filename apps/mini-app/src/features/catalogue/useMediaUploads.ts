import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { catalogueApi } from '../../api/catalogue';
import { MediaUploadQueue } from '../../lib/media-upload-queue';

export function useMediaUploads(onSaved: () => void) {
  const saved = useRef(onSaved);
  useEffect(() => {
    saved.current = onSaved;
  }, [onSaved]);
  const [queue] = useState(
    () =>
      new MediaUploadQueue(
        (file, details) => catalogueApi.upload(file, details),
        () => saved.current(),
      ),
  );
  const jobs = useSyncExternalStore(queue.subscribe, queue.getSnapshot);
  const unfinished = jobs.some(job => job.state !== 'saved');
  useEffect(() => {
    if (!unfinished) {
      return;
    }
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unfinished]);
  return { jobs, queue };
}
