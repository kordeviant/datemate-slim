export const DEFAULT_EXCHANGE = 'datemate.events';
export const DEFAULT_QUEUE = 'datemate.notifications.push';
export const DEFAULT_DLX = 'datemate.notifications.dlx';
export const DEFAULT_DLQ = 'datemate.notifications.dlq';

export const BOUND_ROUTING_KEYS = [
  'push.dispatch',
  'push.send',
  '*.push',
  'push.*',
  '*.created',
];
