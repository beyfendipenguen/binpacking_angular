import { createFeatureSelector, createSelector } from '@ngrx/store';
import { AppNotification } from '@features/interfaces/messaging.interface';
import { MessagingState } from './messaging.state';

export const selectMessagingState = createFeatureSelector<MessagingState>('messaging');

// Parametre/dönüş tipleri açıkça yazıldı: çıkarım (inference) kaybolursa selectSignal `unknown` döndürüyordu.
export const selectUnreadNotifications = createSelector(
  selectMessagingState,
  (s: MessagingState): number => s.unreadNotifications
);
export const selectUnreadMessages = createSelector(
  selectMessagingState,
  (s: MessagingState): number => s.unreadMessages
);
export const selectNotifications = createSelector(
  selectMessagingState,
  (s: MessagingState): AppNotification[] => s.notifications
);
export const selectNotificationsLoading = createSelector(
  selectMessagingState,
  (s: MessagingState): boolean => s.notificationsLoading
);
