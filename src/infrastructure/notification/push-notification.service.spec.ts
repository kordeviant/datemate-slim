import { ConfigService } from '@nestjs/config';
import { PushNotificationService } from './push-notification.service';
import {
  NOTIFICATION_TEMPLATES,
  PushNotificationTypeValue,
} from './notification-templates';

describe('PushNotificationService and Templates', () => {
  let service: PushNotificationService;
  let mockConfigService: Partial<ConfigService>;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        if (key === 'PUSH_NOTIFICATION_BASE_URL') {
          return 'https://push.datemate.com';
        }
        if (key === 'PUSH_NOTIFICATION_API_KEY') {
          return 'secret-api-key-123';
        }
        return defaultValue;
      }),
    };
    service = new PushNotificationService(mockConfigService as ConfigService);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe('NOTIFICATION_TEMPLATES', () => {
    it('should build FRIEND_REQUEST template with correct title, body, priority and lowercase type', () => {
      const payload = NOTIFICATION_TEMPLATES.FRIEND_REQUEST.build({
        recipientUserId: 42,
        senderFullName: 'Parsa Moloudie',
      });

      expect(payload).toEqual({
        title: 'Parsa Moloudie',
        body: 'Parsa Moloudie sent you friend request',
        userId: '42',
        data: {
          userId: '42',
          type: 'friend_request',
        },
        priority: 'normal',
      });
    });

    it('should fallback to User when senderFullName is empty in FRIEND_REQUEST', () => {
      const payload = NOTIFICATION_TEMPLATES.FRIEND_REQUEST.build({
        recipientUserId: 42,
        senderFullName: '',
      });

      expect(payload.title).toBe('User');
      expect(payload.body).toBe('User sent you friend request');
    });

    it('should build FRIEND_REQUEST_ACCEPTED template with target fullName in title and body', () => {
      const payload = NOTIFICATION_TEMPLATES.FRIEND_REQUEST_ACCEPTED.build({
        recipientUserId: 10,
        otherUserFullName: 'Sarah Connor',
      });

      expect(payload).toEqual({
        title: 'Sarah Connor',
        body: 'Now Sarah Connor is your friend',
        userId: '10',
        data: {
          userId: '10',
          type: 'friend_request_accepted',
        },
        priority: 'normal',
      });
    });

    it('should build LIKE_USER template with liker fullName in body and title', () => {
      const payload = NOTIFICATION_TEMPLATES.LIKE_USER.build({
        recipientUserId: 55,
        likerFullName: 'Alex Mercer',
      });

      expect(payload).toEqual({
        title: 'Alex Mercer',
        body: 'user Alex Mercer like your profile',
        userId: '55',
        data: {
          userId: '55',
          type: 'like_user',
        },
        priority: 'normal',
      });
    });

    it('should build SELFIE_ACCEPTED template with static body and normal priority', () => {
      const payload = NOTIFICATION_TEMPLATES.SELFIE_ACCEPTED.build({
        recipientUserId: 101,
      });

      expect(payload).toEqual({
        title: 'Selfie Accepted',
        body: 'your selfie accepted, now your profile completed',
        userId: '101',
        data: {
          userId: '101',
          type: 'selfie_accepted',
        },
        priority: 'normal',
      });
    });

    it('should build SELFIE_REJECTED template with rejection reason and normal priority', () => {
      const payload = NOTIFICATION_TEMPLATES.SELFIE_REJECTED.build({
        recipientUserId: 101,
        rejectionReason: 'Face is not clearly visible in lighting',
      });

      expect(payload).toEqual({
        title: 'Selfie Rejected',
        body: 'Face is not clearly visible in lighting',
        userId: '101',
        data: {
          userId: '101',
          type: 'selfie_rejected',
        },
        priority: 'normal',
      });
    });
  });

  describe('PushNotificationService HTTP Dispatch', () => {
    it('should send HTTP POST request with X-API-Key and JSON body to normalized url', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('{"status":"ok"}'),
      });
      globalThis.fetch = mockFetch;

      const payload = NOTIFICATION_TEMPLATES.FRIEND_REQUEST.build({
        recipientUserId: 77,
        senderFullName: 'Parsa Moloudie',
      });

      const result = await service.sendPush(payload);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://push.datemate.com/v1/push');
      expect(options.method).toBe('POST');
      expect(options.headers).toEqual({
        'Content-Type': 'application/json',
        'X-API-Key': 'secret-api-key-123',
      });
      expect(JSON.parse(options.body)).toEqual(payload);
    });

    it('should correctly normalize baseUrl containing /v1 or trailing slashes', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('ok'),
      });
      globalThis.fetch = mockFetch;

      const customService = new PushNotificationService({
        get: jest.fn((key: string) => {
          if (key === 'PUSH_NOTIFICATION_BASE_URL') {
            return 'https://custom-gateway.io/v1/';
          }
          if (key === 'PUSH_NOTIFICATION_API_KEY') {
            return 'key-xyz';
          }
          return '';
        }),
      } as any);

      await customService.sendSelfieAcceptedNotification({ recipientUserId: 1 });
      expect(mockFetch.mock.calls[0][0]).toBe('https://custom-gateway.io/v1/push');
    });

    it('should correctly normalize baseUrl if already ending with /v1/push', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('ok'),
      });
      globalThis.fetch = mockFetch;

      const customService = new PushNotificationService({
        get: jest.fn((key: string) => {
          if (key === 'PUSH_NOTIFICATION_BASE_URL') {
            return 'https://custom-gateway.io/v1/push/';
          }
          if (key === 'PUSH_NOTIFICATION_API_KEY') {
            return 'key-xyz';
          }
          return '';
        }),
      } as any);

      await customService.sendSelfieAcceptedNotification({ recipientUserId: 1 });
      expect(mockFetch.mock.calls[0][0]).toBe('https://custom-gateway.io/v1/push');
    });

    it('should gracefully return false without throwing when base URL or API key is missing', async () => {
      const mockFetch = jest.fn();
      globalThis.fetch = mockFetch;

      const unconfiguredService = new PushNotificationService({
        get: jest.fn().mockReturnValue(''),
      } as any);

      const result = await unconfiguredService.sendFriendRequestNotification({
        recipientUserId: 1,
        senderFullName: 'Test',
      });

      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return false without throwing when external service returns error status', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: jest.fn().mockResolvedValue('Push gateway failure'),
      });
      globalThis.fetch = mockFetch;

      const result = await service.sendLikeUserNotification({
        recipientUserId: 99,
        likerFullName: 'Liker User',
      });

      expect(result).toBe(false);
    });

    it('should return false without throwing when network exception or timeout occurs', async () => {
      const mockFetch = jest
        .fn()
        .mockRejectedValue(new Error('Network connection timeout'));
      globalThis.fetch = mockFetch;

      const result = await service.sendSelfieRejectedNotification({
        recipientUserId: 100,
        rejectionReason: 'Blurry picture',
      });

      expect(result).toBe(false);
    });

    it('should invoke sendPush via helper methods', async () => {
      const sendPushSpy = jest.spyOn(service, 'sendPush').mockResolvedValue(true);

      await service.sendFriendRequestNotification({
        recipientUserId: 1,
        senderFullName: 'Alice',
      });
      expect(sendPushSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { userId: '1', type: 'friend_request' },
        }),
      );

      await service.sendFriendRequestAcceptedNotification({
        recipientUserId: 2,
        otherUserFullName: 'Bob',
      });
      expect(sendPushSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { userId: '2', type: 'friend_request_accepted' },
        }),
      );

      await service.sendLikeUserNotification({
        recipientUserId: 3,
        likerFullName: 'Charlie',
      });
      expect(sendPushSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { userId: '3', type: 'like_user' },
        }),
      );

      await service.sendSelfieAcceptedNotification({
        recipientUserId: 4,
      });
      expect(sendPushSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { userId: '4', type: 'selfie_accepted' },
        }),
      );

      await service.sendSelfieRejectedNotification({
        recipientUserId: 5,
        rejectionReason: 'Photo not clear',
      });
      expect(sendPushSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { userId: '5', type: 'selfie_rejected' },
        }),
      );
    });

    it('should normalize uppercase priority and legacy user_id to userId', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('ok'),
      });
      globalThis.fetch = mockFetch;

      await service.sendPush({
        title: 'Important Alert',
        body: 'Urgent notification',
        userId: '99',
        data: { userId: '99', type: 'custom' },
        priority: 'HIGH' as any,
      });

      const bodySent = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(bodySent.priority).toBe('high');
      expect(bodySent.userId).toBe('99');
      expect(bodySent.data.userId).toBe('99');
      expect(bodySent.user_id).toBeUndefined();
    });
  });
});
