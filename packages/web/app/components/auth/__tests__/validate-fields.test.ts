import { describe, expect, it } from 'vite-plus/test';
import type { TFunction } from 'i18next';
import { tFromCatalog } from '@/app/__test-helpers__/i18n-mock';
import { validateLoginFields, validateRegisterFields, type LoginValues, type RegisterValues } from '../validate-fields';

const t = ((key: string, options?: Record<string, unknown>) =>
  tFromCatalog('auth', key, options)) as unknown as TFunction<'auth'>;

const validLogin: LoginValues = { email: 'climber@example.com', password: 'pa55word' };

const validRegister: RegisterValues = {
  name: 'Pinch Master',
  email: 'climber@example.com',
  password: 'pa55word!',
  confirmPassword: 'pa55word!',
};

describe('validateLoginFields', () => {
  it('returns no errors for a well-formed email + password', () => {
    expect(validateLoginFields(validLogin, t)).toEqual({});
  });

  it('flags an empty email with the emailRequired copy', () => {
    const errors = validateLoginFields({ ...validLogin, email: '' }, t);
    expect(errors.email).toBe('Please enter your email');
    expect(errors.password).toBeUndefined();
  });

  it('flags a malformed email with the emailInvalid copy', () => {
    const errors = validateLoginFields({ ...validLogin, email: 'not-an-email' }, t);
    expect(errors.email).toBe('Please enter a valid email');
  });

  it('flags an empty password with the passwordRequired copy', () => {
    const errors = validateLoginFields({ ...validLogin, password: '' }, t);
    expect(errors.password).toBe('Please enter your password');
  });

  it('reports both email and password errors when both are missing', () => {
    expect(validateLoginFields({ email: '', password: '' }, t)).toEqual({
      email: 'Please enter your email',
      password: 'Please enter your password',
    });
  });
});

describe('validateRegisterFields', () => {
  it('returns no errors for a well-formed registration', () => {
    expect(validateRegisterFields(validRegister, t)).toEqual({});
  });

  it('allows an empty name (auto-generated downstream)', () => {
    const errors = validateRegisterFields({ ...validRegister, name: '' }, t);
    expect(errors.name).toBeUndefined();
  });

  it('flags a name longer than 100 characters', () => {
    const errors = validateRegisterFields({ ...validRegister, name: 'a'.repeat(101) }, t);
    expect(errors.name).toBe('Name must be less than 100 characters');
  });

  it('flags a missing email with the emailRequired copy', () => {
    const errors = validateRegisterFields({ ...validRegister, email: '' }, t);
    expect(errors.email).toBe('Please enter your email');
  });

  it('flags a malformed email with the emailInvalid copy', () => {
    const errors = validateRegisterFields({ ...validRegister, email: 'climber@' }, t);
    expect(errors.email).toBe('Please enter a valid email');
  });

  it('flags a missing password with the passwordRequiredCreate copy', () => {
    const errors = validateRegisterFields({ ...validRegister, password: '', confirmPassword: '' }, t);
    expect(errors.password).toBe('Please enter a password');
  });

  it('flags a password shorter than 8 characters', () => {
    const errors = validateRegisterFields({ ...validRegister, password: 'short', confirmPassword: 'short' }, t);
    expect(errors.password).toBe('Password must be at least 8 characters');
  });

  it('flags a missing confirm password', () => {
    const errors = validateRegisterFields({ ...validRegister, confirmPassword: '' }, t);
    expect(errors.confirmPassword).toBe('Please confirm your password');
  });

  it('flags a confirm password that does not match', () => {
    const errors = validateRegisterFields({ ...validRegister, confirmPassword: 'different!' }, t);
    expect(errors.confirmPassword).toBe('Passwords do not match');
  });
});
