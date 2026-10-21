import type { InputRequest } from './types';

/** A copy of the request with each option label prefixed by its 1-based position, as `1. The Matrix (1999)`. */
export const numberOptions = (request: InputRequest): InputRequest =>
  request.options === undefined
    ? request
    : {
        ...request,
        options: request.options.map((option, i) => ({
          ...option,
          label: `${i + 1}. ${option.label}`,
        })),
      };
