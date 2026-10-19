import { AppNotification } from '@features/interfaces/messaging.interface';

export interface MessagingState {
  unreadNotifications: number;
  unreadMessages: number;
  notifications: AppNotification[];
  notificationsLoading: boolean;
}

export const initialMessagingState: MessagingState = {
  unreadNotifications: 0,
  unreadMessages: 0,
  notifications: [],
  notificationsLoading: false,
};
