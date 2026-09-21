import { validateUsername } from './username.validator';

describe('UsernameValidator', () => {
  describe('Length and Format', () => {
    it('should reject usernames shorter than 3 characters', () => {
      const res = validateUsername('ab');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('between 3 and 30 characters');
    });

    it('should reject usernames longer than 30 characters', () => {
      const res = validateUsername('a'.repeat(31));
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('between 3 and 30 characters');
    });

    it('should reject usernames containing only numbers', () => {
      const res = validateUsername('123456');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('cannot contain only numbers');
    });

    it('should reject usernames containing spaces', () => {
      const res = validateUsername('john doe');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('cannot contain spaces');
    });

    it('should reject usernames starting or ending with special characters', () => {
      expect(validateUsername('_johndoe').isValid).toBe(false);
      expect(validateUsername('.johndoe').isValid).toBe(false);
      expect(validateUsername('-johndoe').isValid).toBe(false);
      expect(validateUsername('johndoe_').isValid).toBe(false);
      expect(validateUsername('johndoe.').isValid).toBe(false);
      expect(validateUsername('johndoe-').isValid).toBe(false);
    });

    it('should reject usernames with consecutive special characters', () => {
      expect(validateUsername('john__doe').isValid).toBe(false);
      expect(validateUsername('john..doe').isValid).toBe(false);
      expect(validateUsername('john--doe').isValid).toBe(false);
      expect(validateUsername('john._doe').isValid).toBe(false);
      expect(validateUsername('john_-doe').isValid).toBe(false);
    });
  });

  describe('Characters and Security', () => {
    it('should reject emojis', () => {
      const res = validateUsername('john🔥doe');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('cannot contain emojis');
    });

    it('should reject HTML, SQL, and script characters', () => {
      expect(validateUsername('<script>').isValid).toBe(false);
      expect(validateUsername('john;doe').isValid).toBe(false);
      expect(validateUsername("john'doe").isValid).toBe(false);
      expect(validateUsername('john"doe').isValid).toBe(false);
      expect(validateUsername('john--doe').isValid).toBe(false);
      expect(validateUsername('john{doe}').isValid).toBe(false);
    });

    it('should reject zero-width and invisible characters', () => {
      const res = validateUsername('john\u200Bdoe');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('invisible or zero-width');
    });

    it('should reject unsupported characters (like $, %, @, !)', () => {
      expect(validateUsername('john@doe').isValid).toBe(false);
      expect(validateUsername('john$doe').isValid).toBe(false);
      expect(validateUsername('john!doe').isValid).toBe(false);
    });
  });

  describe('Identity, Impersonation and Reserved Names', () => {
    it('should reject reserved staff and administrative names', () => {
      expect(validateUsername('admin').isValid).toBe(false);
      expect(validateUsername('ADMIN').isValid).toBe(false);
      expect(validateUsername('support').isValid).toBe(false);
      expect(validateUsername('moderator').isValid).toBe(false);
      expect(validateUsername('root').isValid).toBe(false);
      expect(validateUsername('official_team').isValid).toBe(false);
      expect(validateUsername('datemate').isValid).toBe(false);
    });

    it('should reject status suffixes like _verified and _official', () => {
      expect(validateUsername('john_verified').isValid).toBe(false);
      expect(validateUsername('anna_official').isValid).toBe(false);
      expect(validateUsername('user_admin').isValid).toBe(false);
    });

    it('should reject status prefixes like verified_ and official_', () => {
      expect(validateUsername('verified_john').isValid).toBe(false);
      expect(validateUsername('official_anna').isValid).toBe(false);
    });

    it('should reject known celebrity/impersonation usernames', () => {
      expect(validateUsername('taylor_swift').isValid).toBe(false);
      expect(validateUsername('elon_musk').isValid).toBe(false);
    });
  });

  describe('Valid Usernames', () => {
    it('should accept valid usernames', () => {
      expect(validateUsername('john_doe').isValid).toBe(true);
      expect(validateUsername('alex.99').isValid).toBe(true);
      expect(validateUsername('sarah-jones').isValid).toBe(true);
      expect(validateUsername('user123').isValid).toBe(true);
      expect(validateUsername('pro_coder_2026').isValid).toBe(true);
    });
  });
});
