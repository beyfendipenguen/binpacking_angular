import { MessagingActions as A } from './messaging.actions';
import { messagingReducer } from './messaging.reducer';
import { MessagingState, initialMessagingState } from './messaging.state';
import {
  selectNotifications,
  selectNotificationsLoading,
  selectUnreadMessages,
  selectUnreadNotifications,
} from './messaging.selectors';

const notif = (id: string, is_read = false) => ({ id, title: `t-${id}`, is_read } as any);

const reduce = (state: MessagingState, ...actions: any[]) =>
  actions.reduce((s, a) => messagingReducer(s, a), state);

describe('messaging store', () => {
  it('loadSummarySuccess okunmamış sayaçlarını yazar', () => {
    const s = reduce(
      initialMessagingState,
      A.loadSummarySuccess({ summary: { unread_notifications: 3, unread_messages: 5 } })
    );
    expect(s.unreadNotifications).toBe(3);
    expect(s.unreadMessages).toBe(5);
  });

  it('loadNotifications yükleniyor bayrağını açar, success kapatır ve listeyi yazar', () => {
    let s = reduce(initialMessagingState, A.loadNotifications());
    expect(s.notificationsLoading).toBeTrue();
    s = reduce(s, A.loadNotificationsSuccess({ notifications: [notif('1')] }));
    expect(s.notificationsLoading).toBeFalse();
    expect(s.notifications.length).toBe(1);
  });

  it('loadNotificationsFailure yükleniyor bayrağını kapatır', () => {
    const s = reduce(initialMessagingState, A.loadNotifications(), A.loadNotificationsFailure());
    expect(s.notificationsLoading).toBeFalse();
  });

  describe('markNotificationReadSuccess', () => {
    const base = (): MessagingState => ({
      ...initialMessagingState,
      unreadNotifications: 2,
      notifications: [notif('1'), notif('2'), notif('3', true)],
    });

    it('okunmamış bildirimi okundu yapar ve sayacı bir azaltır', () => {
      const s = reduce(base(), A.markNotificationReadSuccess({ id: '1' }));
      expect(s.notifications.find((n: any) => n.id === '1')!.is_read).toBeTrue();
      expect(s.unreadNotifications).toBe(1);
    });

    it('zaten okunmuş bildirimde sayacı azaltmaz', () => {
      const s = reduce(base(), A.markNotificationReadSuccess({ id: '3' }));
      expect(s.unreadNotifications).toBe(2);
    });

    it('listede olmayan id sayacı değiştirmez', () => {
      const s = reduce(base(), A.markNotificationReadSuccess({ id: 'yok' }));
      expect(s.unreadNotifications).toBe(2);
    });

    it('sayaç asla negatife düşmez', () => {
      const state: MessagingState = {
        ...initialMessagingState,
        unreadNotifications: 0,
        notifications: [notif('1')],
      };
      const s = reduce(state, A.markNotificationReadSuccess({ id: '1' }));
      expect(s.unreadNotifications).toBe(0);
    });
  });

  it('markAllNotificationsReadSuccess hepsini okundu yapar ve sayacı sıfırlar', () => {
    const state: MessagingState = {
      ...initialMessagingState,
      unreadNotifications: 2,
      notifications: [notif('1'), notif('2')],
    };
    const s = reduce(state, A.markAllNotificationsReadSuccess());
    expect(s.notifications.every((n: any) => n.is_read)).toBeTrue();
    expect(s.unreadNotifications).toBe(0);
  });

  it('markAllNotificationsReadSuccess mesaj sayacına dokunmaz', () => {
    const state: MessagingState = { ...initialMessagingState, unreadMessages: 4, unreadNotifications: 2 };
    expect(reduce(state, A.markAllNotificationsReadSuccess()).unreadMessages).toBe(4);
  });

  it('resetMessaging başlangıç durumuna döner (çıkışta temizlik)', () => {
    const state: MessagingState = { ...initialMessagingState, unreadMessages: 4, notifications: [notif('1')] };
    expect(reduce(state, A.resetMessaging())).toEqual(initialMessagingState);
  });

  describe('selectors', () => {
    const root = {
      messaging: {
        unreadNotifications: 2,
        unreadMessages: 7,
        notifications: [notif('1')],
        notificationsLoading: true,
      },
    } as any;

    it('değerleri döndürür', () => {
      expect(selectUnreadNotifications(root)).toBe(2);
      expect(selectUnreadMessages(root)).toBe(7);
      expect(selectNotifications(root).length).toBe(1);
      expect(selectNotificationsLoading(root)).toBeTrue();
    });
  });
});
