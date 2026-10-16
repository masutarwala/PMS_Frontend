import { z } from 'zod';

// Same rule as the API (PASSWORD_PATTERN in the backend): any password, up to 128 characters.
export const passwordSchema = z.string().min(1, 'Enter a password').max(128, 'At most 128 characters');
