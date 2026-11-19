import type { ItemDetails } from '@tuckly/contracts';

import { errorMessage } from '../api/client';

type UploadDraft = { file: File; details: ItemDetails };
export type MediaUpload = {
  id: number;
  title: string;
  spaceName: string;
} & (
  | { state: 'queued' | 'uploading'; draft: UploadDraft }
  | { state: 'error'; draft: UploadDraft; error: string }
  | { state: 'saved' }
);

// Lives above the item dialog and keeps the original destination and file for
// retries. Only one request runs at a time; failed jobs do not block later ones.
export class MediaUploadQueue {
  private jobs: MediaUpload[] = [];
  private listeners = new Set<() => void>();
  private nextId = 0;
  private running = false;

  constructor(
    private readonly upload: (file: File, details: ItemDetails) => Promise<unknown>,
    private readonly onSaved: () => void,
  ) {}

  getSnapshot = () => this.jobs;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private emit() {
    this.listeners.forEach(listener => listener());
  }
  enqueue(file: File, details: ItemDetails, spaceName: string) {
    this.jobs = [
      ...this.jobs,
      {
        id: ++this.nextId,
        title: details.title || file.name,
        spaceName,
        state: 'queued',
        draft: { file, details: structuredClone(details) },
      },
    ];
    this.emit();
    void this.run();
  }
  retry(id: number) {
    this.jobs = this.jobs.map(job =>
      job.id === id && job.state === 'error' ? { ...job, state: 'queued' } : job,
    );
    this.emit();
    void this.run();
  }
  dismiss(id: number) {
    this.jobs = this.jobs.filter(job => job.id !== id || !['saved', 'error'].includes(job.state));
    this.emit();
  }
  private async run() {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      let job;
      while ((job = this.jobs.find(row => row.state === 'queued'))) {
        if (job.state !== 'queued') {
          continue;
        }
        const current = job;
        this.jobs = this.jobs.map(row =>
          row.id === current.id ? { ...current, state: 'uploading' } : row,
        );
        this.emit();
        try {
          await this.upload(current.draft.file, current.draft.details);
        } catch (error) {
          this.jobs = this.jobs.map(row =>
            row.id === current.id
              ? { ...current, state: 'error', error: errorMessage(error) }
              : row,
          );
          this.emit();
          continue;
        }
        // Release the File and draft once the server confirms the save.
        this.jobs = this.jobs.map(row =>
          row.id === current.id
            ? { id: current.id, title: current.title, spaceName: current.spaceName, state: 'saved' }
            : row,
        );
        this.emit();
        this.onSaved();
      }
    } finally {
      this.running = false;
    }
  }
}
