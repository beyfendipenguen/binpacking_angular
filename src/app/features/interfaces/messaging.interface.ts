// Uygulama içi bildirim + mesajlaşma tipleri (backend: messaging uygulaması)

export type NotificationKind = 'system' | 'feedback' | 'announcement';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  link: string;
  is_read: boolean;
  created_at: string;
}

export interface MessagingSummary {
  unread_notifications: number;
  unread_messages: number;
}

export interface MessagingPeer {
  id: string;
  name: string;
  photo: string | null;
}

/** 'support' = yönetici/destek; 'user' = aynı şirketteki kişi */
export interface ConversationSummary {
  type: 'support' | 'user';
  /** 'support' ya da kullanıcı id'si */
  peer: string;
  user: MessagingPeer | null;
  last_message: string | null;
  last_at: string | null;
  unread: number;
}

export interface ChatMessage {
  id: string;
  kind: 'direct' | 'support';
  sender_id: string | null;
  sender_name: string;
  recipient_id: string | null;
  body: string;
  image_url: string | null;
  is_read: boolean;
  mine: boolean;
  created_at: string;
  feedback_id: string | null;
}

export interface PagedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
