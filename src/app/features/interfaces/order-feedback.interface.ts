// features/interfaces/order-feedback.interface.ts

export type FeedbackSectionKey = 'packages' | 'placement';
export type FeedbackTrigger = 'like' | 'complete' | 'exit';

export interface FeedbackSection {
  liked: boolean | null;
  reasons: string[];
  comment: string;
}

export interface FeedbackAutoDiff {
  trigger: FeedbackTrigger;
  placement: {
    moved: number;
    removed_from_truck: number;
    added_to_truck: number;
    unplaced_original: number;
    unplaced_now: number;
    changed: boolean;
  };
  packages: { changed: boolean; package_count_original: number; package_count_now: number };
}

export interface OrderFeedback {
  packages?: FeedbackSection;
  placement?: FeedbackSection;
  auto?: FeedbackAutoDiff;
}

/** GET order-revisions/{orderId}/feedback-status/ */
export interface FeedbackStatus {
  has_revision: boolean;
  has_result: boolean;
  required: boolean;
  placement: FeedbackAutoDiff['placement'];
  packages: FeedbackAutoDiff['packages'];
  feedback: OrderFeedback;
}

/** POST order-revisions/{orderId}/feedback/ */
export interface FeedbackPayload {
  packages?: FeedbackSection | null;
  placement?: FeedbackSection | null;
  trigger: FeedbackTrigger;
  /** data:image/jpeg;base64,... (sıkıştırılmış; ~1-2 MB altında tutulmalı) */
  screenshot?: string | null;
  /** Ekrandaki son yerleşim ({ shipments: [...] }); kaydedilmemiş olsa bile final olarak alınır. */
  result?: { shipments: any[] } | null;
}
