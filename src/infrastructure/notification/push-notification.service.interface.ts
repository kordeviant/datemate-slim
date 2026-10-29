import {
  PushNotificationPayload,
  FriendRequestNotificationParams,
  FriendRequestAcceptedNotificationParams,
  LikeUserNotificationParams,
  SelfieAcceptedNotificationParams,
  SelfieRejectedNotificationParams,
} from './notification-templates';

export interface IPushNotificationService {
  /**
   * Dispatches a raw push notification payload to the external push notification service.
   * Returns true if successfully delivered to the push gateway, false otherwise.
   */
  sendPush(payload: PushNotificationPayload): Promise<boolean>;

  /**
   * Helper to send a FRIEND_REQUEST push notification.
   */
  sendFriendRequestNotification(
    params: FriendRequestNotificationParams,
  ): Promise<boolean>;

  /**
   * Helper to send a FRIEND_REQUEST_ACCEPTED push notification.
   */
  sendFriendRequestAcceptedNotification(
    params: FriendRequestAcceptedNotificationParams,
  ): Promise<boolean>;

  /**
   * Helper to send a LIKE_USER push notification when a user swipes right / likes another user.
   */
  sendLikeUserNotification(
    params: LikeUserNotificationParams,
  ): Promise<boolean>;

  /**
   * Helper to send a SELFIE_ACCEPTED push notification when admin approves identity verification.
   */
  sendSelfieAcceptedNotification(
    params: SelfieAcceptedNotificationParams,
  ): Promise<boolean>;

  /**
   * Helper to send a SELFIE_REJECTED push notification when admin rejects identity verification.
   */
  sendSelfieRejectedNotification(
    params: SelfieRejectedNotificationParams,
  ): Promise<boolean>;
}

export const PUSH_NOTIFICATION_SERVICE = Symbol('IPushNotificationService');
