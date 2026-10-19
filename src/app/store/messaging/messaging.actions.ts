import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { AppNotification, MessagingSummary } from '@features/interfaces/messaging.interface';

export const MessagingActions = createActionGroup({
  source: 'Messaging',
  events: {
    // Header açılınca başlar, kapanınca durur (okunmamış sayaç polling'i)
    'Start Polling': emptyProps(),
    'Stop Polling': emptyProps(),

    'Load Summary': emptyProps(),
    'Load Summary Success': props<{ summary: MessagingSummary }>(),
    'Load Summary Failure': emptyProps(),

    'Load Notifications': emptyProps(),
    'Load Notifications Success': props<{ notifications: AppNotification[] }>(),
    'Load Notifications Failure': emptyProps(),

    'Mark Notification Read': props<{ id: string }>(),
    'Mark Notification Read Success': props<{ id: string }>(),
    'Mark All Notifications Read': emptyProps(),
    'Mark All Notifications Read Success': emptyProps(),

    'Reset Messaging': emptyProps(),
  },
});
