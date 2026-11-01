import { appConfig } from './app.config';
import { uploadConfig } from './upload.config';
import { chatConfig } from './chat.config';
import { notificationConfig } from './notification.config';
import { cassandraConfig } from './cassandra.config';
import { businessRulesConfig } from './business-rules.config';
import { securityConfig } from './security.config';

export const configuration = () => ({
  ...appConfig(),
  ...uploadConfig(),
  ...chatConfig(),
  ...notificationConfig(),
  ...cassandraConfig(),
  ...businessRulesConfig(),
  ...securityConfig(),
});

export default configuration;
