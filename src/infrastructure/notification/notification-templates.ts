/**
 * Canonical Notification Templates and Strongly-Typed Entities
 * 
 * Keep all push notification templates, payload schemas, and priority mappings
 * in this single authoritative file to make editing and maintenance effortless.
 */

export enum PushNotificationTypeValue {
  FRIEND_REQUEST = 'friend_request',
  FRIEND_REQUEST_ACCEPTED = 'friend_request_accepted',
  SELFIE_ACCEPTED = 'selfie_accepted',
  SELFIE_REJECTED = 'selfie_rejected',
  LIKE_USER = 'like_user',
}

export type PushNotificationPriority = 'high' | 'normal';

export interface PushNotificationData {
  userId: string;
  type: string;
  [key: string]: any;
}

export interface PushNotificationPayload<
  TData extends PushNotificationData = PushNotificationData,
> {
  title: string;
  body: string;
  userId: string;
  data: TData;
  priority: PushNotificationPriority;
}

// Strongly-typed parameters for each notification entity
export interface FriendRequestNotificationParams {
  recipientUserId: number | string;
  senderFullName: string;
}

export interface FriendRequestAcceptedNotificationParams {
  recipientUserId: number | string;
  otherUserFullName: string;
}

export interface LikeUserNotificationParams {
  recipientUserId: number | string;
  likerFullName: string;
}

export interface SelfieAcceptedNotificationParams {
  recipientUserId: number | string;
}

export interface SelfieRejectedNotificationParams {
  recipientUserId: number | string;
  rejectionReason: string;
}

export interface NotificationTemplateDefinition<TParams> {
  readonly type: PushNotificationTypeValue;
  readonly priority: PushNotificationPriority;
  build(params: TParams): PushNotificationPayload;
}

/**
 * All push notification templates centralized in one authoritative registry.
 */
export const NOTIFICATION_TEMPLATES = {
  FRIEND_REQUEST: {
    type: PushNotificationTypeValue.FRIEND_REQUEST,
    priority: 'normal' as PushNotificationPriority,
    build: (
      params: FriendRequestNotificationParams,
    ): PushNotificationPayload => {
      const senderName = params.senderFullName?.trim() || 'User';
      const recipientId = String(params.recipientUserId);
      return {
        title: senderName,
        body: `${senderName} sent you friend request`,
        userId: recipientId,
        data: {
          userId: recipientId,
          type: PushNotificationTypeValue.FRIEND_REQUEST,
        },
        priority: 'normal',
      };
    },
  },

  FRIEND_REQUEST_ACCEPTED: {
    type: PushNotificationTypeValue.FRIEND_REQUEST_ACCEPTED,
    priority: 'normal' as PushNotificationPriority,
    build: (
      params: FriendRequestAcceptedNotificationParams,
    ): PushNotificationPayload => {
      const otherName = params.otherUserFullName?.trim() || 'User';
      const recipientId = String(params.recipientUserId);
      return {
        title: otherName,
        body: `Now ${otherName} is your friend`,
        userId: recipientId,
        data: {
          userId: recipientId,
          type: PushNotificationTypeValue.FRIEND_REQUEST_ACCEPTED,
        },
        priority: 'normal',
      };
    },
  },

  LIKE_USER: {
    type: PushNotificationTypeValue.LIKE_USER,
    priority: 'normal' as PushNotificationPriority,
    build: (params: LikeUserNotificationParams): PushNotificationPayload => {
      const likerName = params.likerFullName?.trim() || 'User';
      const recipientId = String(params.recipientUserId);
      return {
        title: likerName,
        body: `user ${likerName} like your profile`,
        userId: recipientId,
        data: {
          userId: recipientId,
          type: PushNotificationTypeValue.LIKE_USER,
        },
        priority: 'normal',
      };
    },
  },

  SELFIE_ACCEPTED: {
    type: PushNotificationTypeValue.SELFIE_ACCEPTED,
    priority: 'normal' as PushNotificationPriority,
    build: (
      params: SelfieAcceptedNotificationParams,
    ): PushNotificationPayload => {
      const recipientId = String(params.recipientUserId);
      return {
        title: 'Selfie Accepted',
        body: 'your selfie accepted, now your profile completed',
        userId: recipientId,
        data: {
          userId: recipientId,
          type: PushNotificationTypeValue.SELFIE_ACCEPTED,
        },
        priority: 'normal',
      };
    },
  },

  SELFIE_REJECTED: {
    type: PushNotificationTypeValue.SELFIE_REJECTED,
    priority: 'normal' as PushNotificationPriority,
    build: (
      params: SelfieRejectedNotificationParams,
    ): PushNotificationPayload => {
      const recipientId = String(params.recipientUserId);
      const reason =
        params.rejectionReason?.trim() || 'Selfie verification was rejected';
      return {
        title: 'Selfie Rejected',
        body: reason,
        userId: recipientId,
        data: {
          userId: recipientId,
          type: PushNotificationTypeValue.SELFIE_REJECTED,
        },
        priority: 'normal',
      };
    },
  },
} as const;
