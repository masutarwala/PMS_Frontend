import { useState } from 'react';
import { errorMessage, fieldErrors } from '@/api/client';

/**
 * Maps an API error onto a react-hook-form instance: field errors go to their
 * fields, everything else is returned as a form-level message.
 */
export function useApiFormError(setError) {
  const [formError, setFormError] = useState(null);

  function handle(error, fieldMap = {}) {
    const fields = fieldErrors(error);
    let mapped = 0;
    for (const [apiField, msg] of Object.entries(fields)) {
      const name = fieldMap[apiField] ?? apiField;
      if (name) {
        setError(name, { type: 'server', message: msg });
        mapped += 1;
      }
    }
    setFormError(mapped && error?.response?.data?.code === 'VALIDATION_ERROR' ? null : errorMessage(error));
  }

  return { formError, setFormError, handleApiError: handle };
}
