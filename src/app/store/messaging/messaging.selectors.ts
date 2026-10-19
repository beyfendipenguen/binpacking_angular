import { createFeatureSelector, createSelector } from '@ngrx/store';
import { MessagingState } from './messaging.state';

export const selectMessagingState = createFeatureSelector<MessagingState>('messaging');

export const selectUnreadNotifications = createSelector(selectMessagingState, (s) => s.unreadNotifications);
export const selectUnreadMessages = createSelector(selectMessagingState, (s) => s.unreadMessages);
export const selectNotifications = createSelector(selectMessagingState, (s) => s.notifications);
export const selectNotificationsLoading = createSelector(selectMessagingState, (s) => s.notificationsLoading);
