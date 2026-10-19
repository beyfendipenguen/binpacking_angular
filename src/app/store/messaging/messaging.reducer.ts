import { createReducer, on } from '@ngrx/store';
import { initialMessagingState } from './messaging.state';
import { MessagingActions } from './messaging.actions';

export const messagingReducer = createReducer(
  initialMessagingState,

  on(MessagingActions.loadSummarySuccess, (state, { summary }) => ({
    ...state,
    unreadNotifications: summary.unread_notifications,
    unreadMessages: summary.unread_messages,
  })),

  on(MessagingActions.loadNotifications, (state) => ({ ...state, notificationsLoading: true })),
  on(MessagingActions.loadNotificationsSuccess, (state, { notifications }) => ({
    ...state,
    notifications,
    notificationsLoading: false,
  })),
  on(MessagingActions.loadNotificationsFailure, (state) => ({ ...state, notificationsLoading: false })),

  on(MessagingActions.markNotificationReadSuccess, (state, { id }) => {
    const target = state.notifications.find((n) => n.id === id);
    const wasUnread = !!target && !target.is_read;
    return {
      ...state,
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      unreadNotifications: Math.max(0, state.unreadNotifications - (wasUnread ? 1 : 0)),
    };
  }),

  on(MessagingActions.markAllNotificationsReadSuccess, (state) => ({
    ...state,
    notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
    unreadNotifications: 0,
  })),

  on(MessagingActions.resetMessaging, () => initialMessagingState),
);
